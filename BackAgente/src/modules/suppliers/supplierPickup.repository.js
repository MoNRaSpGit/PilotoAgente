export async function confirmSupplierOrderPickupQuery({
  ensureSupplierTables,
  withTransaction,
  orderId,
  confirmedBy = null
}) {
  await ensureSupplierTables();

  return withTransaction(async (connection) => {
    const [orderRows] = await connection.query(
      `
        SELECT
          so.id,
          so.status,
          DATE_FORMAT(so.pickup_confirmed_at, '%Y-%m-%d %H:%i:%s') AS pickup_confirmed_at
        FROM ops_supplier_orders so
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
      return { ...order, already_closed: true };
    }

    if (order.pickup_confirmed_at) {
      return { ...order, already_confirmed: true };
    }

    await connection.query(
      `
        UPDATE ops_supplier_orders
        SET pickup_confirmed_at = CURRENT_TIMESTAMP,
            pickup_confirmed_by_name = ?,
            pickup_confirmed_by_role = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        confirmedBy?.name || null,
        confirmedBy?.role || null,
        orderId
      ]
    );

    const [updatedRows] = await connection.query(
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

    return updatedRows[0] || null;
  });
}
