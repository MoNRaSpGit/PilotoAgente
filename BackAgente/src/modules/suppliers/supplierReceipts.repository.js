export async function receiveSupplierOrderAndApplyStockQuery({
  ensureSupplierTables,
  withTransaction,
  orderId,
  receivedItems = [],
  receivedBy = null,
  invoiceAmount = null,
  invoiceReference = null
}) {
  await ensureSupplierTables();

  return withTransaction(async (connection) => {
    const [orderRows] = await connection.query(
      `
        SELECT
          so.id,
          so.supplier_id,
          s.nombre AS supplier_name,
          DATE_FORMAT(so.order_date, '%Y-%m-%d') AS order_date,
          DATE_FORMAT(so.delivery_date, '%Y-%m-%d') AS delivery_date,
          so.expected_amount,
          so.invoice_amount,
          so.invoice_diff,
          so.invoice_reference,
          DATE_FORMAT(so.received_at, '%Y-%m-%d %H:%i:%s') AS received_at,
          DATE_FORMAT(so.pickup_confirmed_at, '%Y-%m-%d %H:%i:%s') AS pickup_confirmed_at,
          so.pickup_confirmed_by_name,
          so.pickup_confirmed_by_role,
          so.status,
          so.notes,
          so.operator_id,
          so.operator_name,
          so.operator_role,
          DATE_FORMAT(so.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(so.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_orders so
        INNER JOIN ops_proveedores s ON s.id = so.supplier_id
        WHERE so.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [orderId]
    );
    const order = orderRows[0] || null;
    if (!order) {
      return null;
    }

    if (String(order.status || '').trim().toLowerCase() !== 'pendiente') {
      return {
        order,
        items: [],
        already_received: true
      };
    }

    const [itemRows] = await connection.query(
      `
        SELECT
          id,
          order_id,
          product_id,
          product_name,
          quantity,
          unit_cost,
          line_total,
          notes,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_order_items
        WHERE order_id = ?
        ORDER BY id ASC
      `,
      [orderId]
    );

    const orderedByItemId = new Map(
      itemRows.map((item) => [Number(item.id), Number(item.quantity || 0)])
    );
    const receivedByItemId = new Map();
    const noteByItemId = new Map();

    if (Array.isArray(receivedItems) && receivedItems.length > 0) {
      for (const entry of receivedItems) {
        const itemId = Number(entry?.item_id);
        const quantityReceived = Number(entry?.quantity_received);

        if (!Number.isFinite(itemId) || itemId <= 0 || !orderedByItemId.has(itemId)) {
          const error = new Error('Item de recepcion invalido');
          error.status = 400;
          throw error;
        }
        if (!Number.isFinite(quantityReceived) || quantityReceived < 0) {
          const error = new Error('Cantidad recibida invalida');
          error.status = 400;
          throw error;
        }

        const orderedQuantity = Number(orderedByItemId.get(itemId) || 0);
        if (quantityReceived > orderedQuantity) {
          const error = new Error('La cantidad recibida no puede superar la pedida');
          error.status = 400;
          throw error;
        }

        receivedByItemId.set(itemId, Number(quantityReceived.toFixed(3)));
        const note = String(entry?.note || entry?.discrepancy_note || '').trim();
        noteByItemId.set(itemId, note || null);
      }

      for (const [itemId] of orderedByItemId.entries()) {
        if (!receivedByItemId.has(itemId)) {
          receivedByItemId.set(itemId, 0);
          noteByItemId.set(itemId, null);
        }
      }
    } else {
      for (const [itemId, orderedQuantity] of orderedByItemId.entries()) {
        receivedByItemId.set(itemId, Number(Number(orderedQuantity || 0).toFixed(3)));
        noteByItemId.set(itemId, null);
      }
    }

    const stockUpdates = [];
    const qtyByProductId = new Map();
    for (const row of itemRows) {
      const productId = Number(row?.product_id || 0);
      const itemId = Number(row?.id || 0);
      const quantityToAdd = Number(receivedByItemId.get(itemId) || 0);
      if (!productId || !Number.isFinite(quantityToAdd) || quantityToAdd <= 0) {
        continue;
      }

      const current = Number(qtyByProductId.get(productId) || 0);
      qtyByProductId.set(productId, Number((current + quantityToAdd).toFixed(3)));
    }

    for (const [productId, quantityToAdd] of qtyByProductId.entries()) {
      if (!Number.isFinite(quantityToAdd) || quantityToAdd <= 0) {
        continue;
      }

      await connection.query(
        `
          UPDATE ops_producto
          SET stock_actual = stock_actual + ?
          WHERE id = ?
        `,
        [quantityToAdd, productId]
      );

      stockUpdates.push({
        product_id: productId,
        quantity_added: Number(quantityToAdd.toFixed(3))
      });
    }

    await connection.query(
      `
        DELETE FROM ops_supplier_order_receipts
        WHERE order_id = ?
      `,
      [orderId]
    );

    for (const row of itemRows) {
      const itemId = Number(row?.id || 0);
      const orderedQuantity = Number(row?.quantity || 0);
      const receivedQuantity = Number(receivedByItemId.get(itemId) || 0);
      await connection.query(
        `
          INSERT INTO ops_supplier_order_receipts (
            order_id,
            order_item_id,
            product_id,
            product_name,
            ordered_quantity,
            received_quantity,
            discrepancy_note,
            operator_id,
            operator_name,
            operator_role
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          itemId,
          row?.product_id || null,
          row?.product_name || '',
          Number(orderedQuantity.toFixed(3)),
          Number(receivedQuantity.toFixed(3)),
          noteByItemId.get(itemId) || null,
          receivedBy?.id || null,
          receivedBy?.name || null,
          receivedBy?.role || null
        ]
      );
    }

    const expectedAmount = Number(order.expected_amount || 0);
    const hasInvoiceAmount = Number.isFinite(Number(invoiceAmount)) && Number(invoiceAmount) >= 0;
    const normalizedInvoiceAmount = hasInvoiceAmount ? Number(Number(invoiceAmount).toFixed(2)) : null;
    const invoiceDiff = hasInvoiceAmount ? Number((normalizedInvoiceAmount - expectedAmount).toFixed(2)) : null;

    await connection.query(
      `
        UPDATE ops_supplier_orders
        SET status = 'recibido',
            invoice_amount = ?,
            invoice_diff = ?,
            invoice_reference = ?,
            received_at = CURRENT_TIMESTAMP,
            notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        normalizedInvoiceAmount,
        invoiceDiff,
        invoiceReference || null,
        order.notes || (receivedBy?.name ? `Recepcion confirmado por ${receivedBy.name}` : null),
        orderId
      ]
    );

    const [updatedOrderRows] = await connection.query(
      `
        SELECT
          so.id,
          so.supplier_id,
          s.nombre AS supplier_name,
          DATE_FORMAT(so.order_date, '%Y-%m-%d') AS order_date,
          DATE_FORMAT(so.delivery_date, '%Y-%m-%d') AS delivery_date,
          so.expected_amount,
          so.invoice_amount,
          so.invoice_diff,
          so.invoice_reference,
          DATE_FORMAT(so.received_at, '%Y-%m-%d %H:%i:%s') AS received_at,
          DATE_FORMAT(so.pickup_confirmed_at, '%Y-%m-%d %H:%i:%s') AS pickup_confirmed_at,
          so.pickup_confirmed_by_name,
          so.pickup_confirmed_by_role,
          so.status,
          so.notes,
          so.operator_id,
          so.operator_name,
          so.operator_role,
          DATE_FORMAT(so.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(so.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_orders so
        INNER JOIN ops_proveedores s ON s.id = so.supplier_id
        WHERE so.id = ?
        LIMIT 1
      `,
      [orderId]
    );

    return {
      order: updatedOrderRows[0] || order,
      items: itemRows,
      stock_updates: stockUpdates
    };
  });
}
