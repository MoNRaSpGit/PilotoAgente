import { pool } from '../../config/db.js';

export async function findOpenSupplierDraftBySupplierIdQuery({ ensureSupplierTables, supplierId }) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        d.id,
        d.supplier_id,
        s.nombre AS supplier_name,
        d.status,
        d.source,
        d.notes,
        d.operator_id,
        d.operator_name,
        d.operator_role,
        DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(d.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_drafts d
      INNER JOIN ops_proveedores s ON s.id = d.supplier_id
      WHERE d.supplier_id = ?
        AND d.status = 'open'
      ORDER BY d.updated_at DESC, d.id DESC
      LIMIT 1
    `,
    [supplierId]
  );

  return rows[0] || null;
}

export async function createSupplierOrderDraftQuery({ ensureSupplierTables, payload }) {
  await ensureSupplierTables();
  const [result] = await pool.query(
    `
      INSERT INTO ops_supplier_order_drafts (
        supplier_id,
        status,
        source,
        notes,
        operator_id,
        operator_name,
        operator_role
      )
      VALUES (?, 'open', ?, ?, ?, ?, ?)
    `,
    [
      payload.supplier_id,
      payload.source || 'stock',
      payload.notes || null,
      payload.operator_id || null,
      payload.operator_name || null,
      payload.operator_role || null
    ]
  );

  const [rows] = await pool.query(
    `
      SELECT
        d.id,
        d.supplier_id,
        s.nombre AS supplier_name,
        d.status,
        d.source,
        d.notes,
        d.operator_id,
        d.operator_name,
        d.operator_role,
        DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(d.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_drafts d
      INNER JOIN ops_proveedores s ON s.id = d.supplier_id
      WHERE d.id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return rows[0] || null;
}

export async function upsertSupplierOrderDraftItemQuery({
  ensureSupplierTables,
  withTransaction,
  draftId,
  productId = null,
  productName,
  quantity,
  unitCost = 0,
  lineTotal = 0,
  source = 'stock_alert',
  notes = null
}) {
  await ensureSupplierTables();

  return withTransaction(async (connection) => {
    let existing = null;

    if (productId) {
      const [existingRows] = await connection.query(
        `
          SELECT id, quantity, unit_cost
          FROM ops_supplier_order_draft_items
          WHERE draft_id = ?
            AND product_id = ?
          LIMIT 1
        `,
        [draftId, productId]
      );
      existing = existingRows[0] || null;
    }

    if (existing) {
      const nextQuantity = Number(existing.quantity || 0) + Number(quantity || 0);
      const nextUnitCost = Number(unitCost || existing.unit_cost || 0);
      const nextLineTotal = Number((nextQuantity * nextUnitCost).toFixed(2));

      await connection.query(
        `
          UPDATE ops_supplier_order_draft_items
          SET quantity = ?,
              unit_cost = ?,
              line_total = ?,
              product_name = ?,
              source = ?,
              notes = ?
          WHERE id = ?
        `,
        [nextQuantity, nextUnitCost, nextLineTotal, productName, source, notes, existing.id]
      );
    } else {
      await connection.query(
        `
          INSERT INTO ops_supplier_order_draft_items (
            draft_id,
            product_id,
            product_name,
            quantity,
            unit_cost,
            line_total,
            source,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [draftId, productId || null, productName, quantity, unitCost, lineTotal, source, notes]
      );
    }

    const [rows] = await connection.query(
      `
        SELECT
          id,
          draft_id,
          product_id,
          product_name,
          quantity,
          unit_cost,
          line_total,
          source,
          notes,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_order_draft_items
        WHERE draft_id = ?
        ORDER BY id ASC
      `,
      [draftId]
    );

    return rows;
  });
}

export async function listSupplierOrderDraftItemsByDraftIdQuery({ ensureSupplierTables, draftId }) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        draft_id,
        product_id,
        product_name,
        quantity,
        unit_cost,
        line_total,
        source,
        notes,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_draft_items
      WHERE draft_id = ?
      ORDER BY id ASC
    `,
    [draftId]
  );

  return rows;
}

export async function listOpenSupplierOrderDraftsQuery({ ensureSupplierTables }) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        d.id,
        d.supplier_id,
        s.nombre AS supplier_name,
        d.status,
        d.source,
        d.notes,
        d.operator_id,
        d.operator_name,
        d.operator_role,
        DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(d.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_drafts d
      INNER JOIN ops_proveedores s ON s.id = d.supplier_id
      WHERE d.status = 'open'
      ORDER BY d.updated_at DESC, d.id DESC
    `
  );

  return rows;
}

export async function findSupplierOrderDraftByIdQuery({ ensureSupplierTables, draftId }) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        d.id,
        d.supplier_id,
        s.nombre AS supplier_name,
        d.status,
        d.source,
        d.notes,
        d.operator_id,
        d.operator_name,
        d.operator_role,
        DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(d.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_drafts d
      INNER JOIN ops_proveedores s ON s.id = d.supplier_id
      WHERE d.id = ?
      LIMIT 1
    `,
    [draftId]
  );

  return rows[0] || null;
}

export async function confirmSupplierOrderDraftQuery({
  ensureSupplierTables,
  withTransaction,
  draftId,
  orderDate,
  deliveryDate,
  notes = null,
  operator = null
}) {
  await ensureSupplierTables();

  return withTransaction(async (connection) => {
    const [draftRows] = await connection.query(
      `
        SELECT
          d.id,
          d.supplier_id,
          d.status,
          d.notes,
          s.nombre AS supplier_name
        FROM ops_supplier_order_drafts d
        INNER JOIN ops_proveedores s ON s.id = d.supplier_id
        WHERE d.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [draftId]
    );
    const draft = draftRows[0] || null;
    if (!draft) {
      return null;
    }

    if (draft.status !== 'open') {
      return {
        draft,
        order: null,
        items: [],
        already_confirmed: true
      };
    }

    const [itemRows] = await connection.query(
      `
        SELECT
          id,
          product_id,
          product_name,
          quantity,
          unit_cost,
          line_total,
          notes
        FROM ops_supplier_order_draft_items
        WHERE draft_id = ?
        ORDER BY id ASC
      `,
      [draftId]
    );

    if (!itemRows.length) {
      return {
        draft,
        order: null,
        items: [],
        empty_draft: true
      };
    }

    const expectedAmount = Number(
      itemRows.reduce((acc, item) => acc + Number(item.line_total || 0), 0).toFixed(2)
    );
    await connection.query(
      `
        SELECT id
        FROM ops_proveedores
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [draft.supplier_id]
    );

    const [existingOrderRows] = await connection.query(
      `
        SELECT id
        FROM ops_supplier_orders
        WHERE supplier_id = ?
          AND delivery_date = ?
          AND status = 'pendiente'
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [draft.supplier_id, deliveryDate]
    );

    const existingOrder = existingOrderRows[0] || null;
    let orderId = null;

    if (existingOrder) {
      orderId = Number(existingOrder.id);

      await connection.query(
        `
          UPDATE ops_supplier_orders
          SET order_date = ?,
              expected_amount = ?,
              notes = ?,
              pickup_confirmed_at = NULL,
              pickup_confirmed_by_name = NULL,
              pickup_confirmed_by_role = NULL,
              operator_id = ?,
              operator_name = ?,
              operator_role = ?
          WHERE id = ?
        `,
        [
          orderDate,
          expectedAmount,
          notes || draft.notes || null,
          operator?.id || null,
          operator?.name || null,
          operator?.role || null,
          orderId
        ]
      );

      await connection.query(
        `
          DELETE FROM ops_supplier_order_items
          WHERE order_id = ?
        `,
        [orderId]
      );
    } else {
      const [orderResult] = await connection.query(
        `
          INSERT INTO ops_supplier_orders (
            supplier_id,
            order_date,
            delivery_date,
            expected_amount,
            status,
            notes,
            operator_id,
            operator_name,
            operator_role
          )
          VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?, ?)
        `,
        [
          draft.supplier_id,
          orderDate,
          deliveryDate,
          expectedAmount,
          notes || draft.notes || null,
          operator?.id || null,
          operator?.name || null,
          operator?.role || null
        ]
      );
      orderId = Number(orderResult.insertId);
    }

    for (const item of itemRows) {
      await connection.query(
        `
          INSERT INTO ops_supplier_order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_cost,
            line_total,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          item.product_id || null,
          item.product_name,
          item.quantity,
          item.unit_cost,
          item.line_total,
          item.notes || null
        ]
      );
    }

    await connection.query(
      `
        UPDATE ops_supplier_order_drafts
        SET status = 'confirmed',
            notes = ?,
            operator_id = ?,
            operator_name = ?,
            operator_role = ?
        WHERE id = ?
      `,
      [
        notes || draft.notes || null,
        operator?.id || null,
        operator?.name || null,
        operator?.role || null,
        draftId
      ]
    );

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
      `,
      [orderId]
    );

    return {
      draft: {
        ...draft,
        status: 'confirmed'
      },
      order: orderRows[0] || null,
      items: itemRows
    };
  });
}

export async function findSupplierDraftItemByIdQuery({ ensureSupplierTables, draftId, itemId }) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        draft_id,
        product_id,
        product_name,
        quantity,
        unit_cost,
        line_total,
        source,
        notes,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_draft_items
      WHERE draft_id = ?
        AND id = ?
      LIMIT 1
    `,
    [draftId, itemId]
  );

  return rows[0] || null;
}

export async function updateSupplierDraftItemQuantityQuery({
  ensureSupplierTables,
  withTransaction,
  draftId,
  itemId,
  quantity
}) {
  await ensureSupplierTables();

  return withTransaction(async (connection) => {
    const [rows] = await connection.query(
      `
        SELECT id, quantity, unit_cost
        FROM ops_supplier_order_draft_items
        WHERE draft_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [draftId, itemId]
    );
    const item = rows[0] || null;
    if (!item) {
      return null;
    }

    const nextQuantity = Number(quantity);
    const nextLineTotal = Number((nextQuantity * Number(item.unit_cost || 0)).toFixed(2));

    await connection.query(
      `
        UPDATE ops_supplier_order_draft_items
        SET quantity = ?,
            line_total = ?
        WHERE id = ?
      `,
      [nextQuantity, nextLineTotal, itemId]
    );

    await connection.query(
      `
        UPDATE ops_supplier_order_drafts
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [draftId]
    );

    const [updatedRows] = await connection.query(
      `
        SELECT
          id,
          draft_id,
          product_id,
          product_name,
          quantity,
          unit_cost,
          line_total,
          source,
          notes,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_order_draft_items
        WHERE id = ?
        LIMIT 1
      `,
      [itemId]
    );

    return updatedRows[0] || null;
  });
}

export async function deleteSupplierDraftItemQuery({
  ensureSupplierTables,
  withTransaction,
  draftId,
  itemId
}) {
  await ensureSupplierTables();

  return withTransaction(async (connection) => {
    const [existingRows] = await connection.query(
      `
        SELECT id
        FROM ops_supplier_order_draft_items
        WHERE draft_id = ?
          AND id = ?
        LIMIT 1
      `,
      [draftId, itemId]
    );
    const existing = existingRows[0] || null;
    if (!existing) {
      return false;
    }

    await connection.query(
      `
        DELETE FROM ops_supplier_order_draft_items
        WHERE id = ?
      `,
      [itemId]
    );

    await connection.query(
      `
        UPDATE ops_supplier_order_drafts
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [draftId]
    );

    return true;
  });
}
