import { pool } from '../../config/db.js';

export async function listSupplierOrdersByDateRangeQuery({
  ensureSupplierTables,
  fromDate,
  toDate,
  status = 'pendiente',
  dateField = 'delivery_date'
}) {
  await ensureSupplierTables();
  const safeDateField = dateField === 'order_date' ? 'order_date' : 'delivery_date';
  const [rows] = await pool.query(
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
      WHERE so.${safeDateField} >= ?
        AND so.${safeDateField} <= ?
        AND so.status = ?
      ORDER BY so.delivery_date ASC, s.nombre ASC, so.id ASC
    `,
    [fromDate, toDate, status]
  );

  return rows;
}

export async function listSupplierOrdersQuery({
  ensureSupplierTables,
  limit = 50
} = {}) {
  await ensureSupplierTables();
  const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 50)));
  const [rows] = await pool.query(
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
      ORDER BY so.delivery_date DESC, so.id DESC
      LIMIT ?
    `,
    [safeLimit]
  );

  return rows;
}

export async function findSupplierOrderByIdQuery({
  ensureSupplierTables,
  orderId
}) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
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

  return rows[0] || null;
}

export async function listSupplierInvoiceIncidentsQuery({
  ensureSupplierTables,
  date = null,
  limit = 50
} = {}) {
  await ensureSupplierTables();
  const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 50)));
  const normalizedDate = String(date || '').trim();
  const hasDateFilter = Boolean(normalizedDate);

  const baseQuery = `
      SELECT
        so.id,
        so.supplier_id,
        s.nombre AS supplier_name,
        DATE_FORMAT(so.order_date, '%Y-%m-%d') AS order_date,
        DATE_FORMAT(so.delivery_date, '%Y-%m-%d') AS delivery_date,
        DATE_FORMAT(so.received_at, '%Y-%m-%d %H:%i:%s') AS received_at,
        so.expected_amount,
        so.invoice_amount,
        so.invoice_diff,
        so.invoice_reference,
        so.status
      FROM ops_supplier_orders so
      INNER JOIN ops_proveedores s ON s.id = so.supplier_id
      WHERE so.status = 'recibido'
        AND (
          ABS(COALESCE(so.invoice_diff, 0)) > 0.009
          OR EXISTS (
            SELECT 1
            FROM ops_supplier_order_receipts r
            WHERE r.order_id = so.id
              AND (
                r.received_quantity < r.ordered_quantity
                OR (r.discrepancy_note IS NOT NULL AND TRIM(r.discrepancy_note) <> '')
              )
          )
        )
  `;

  const dateClause = hasDateFilter
    ? ` AND DATE(COALESCE(so.received_at, so.delivery_date)) = ? `
    : '';
  const tailClause = `
      ORDER BY COALESCE(so.received_at, so.updated_at) DESC, so.id DESC
      LIMIT ?
  `;

  const query = `${baseQuery}${dateClause}${tailClause}`;
  const params = hasDateFilter
    ? [normalizedDate, safeLimit]
    : [safeLimit];

  const [orderRows] = await pool.query(query, params);

  if (!orderRows.length) {
    return [];
  }

  const orderIds = orderRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
  const placeholders = orderIds.map(() => '?').join(', ');
  const [receiptRows] = await pool.query(
    `
      SELECT
        r.id,
        r.order_id,
        r.order_item_id,
        r.product_id,
        r.product_name,
        r.ordered_quantity,
        r.received_quantity,
        r.discrepancy_note,
        DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM ops_supplier_order_receipts r
      WHERE r.order_id IN (${placeholders})
        AND (
          r.received_quantity < r.ordered_quantity
          OR (r.discrepancy_note IS NOT NULL AND TRIM(r.discrepancy_note) <> '')
        )
      ORDER BY r.order_id ASC, r.id ASC
    `,
    orderIds
  );

  const detailsByOrderId = new Map();
  for (const row of receiptRows) {
    const orderId = Number(row.order_id);
    const current = detailsByOrderId.get(orderId) || [];
    current.push(row);
    detailsByOrderId.set(orderId, current);
  }

  return orderRows.map((row) => ({
    ...row,
    details: detailsByOrderId.get(Number(row.id)) || []
  }));
}

export async function listSupplierOrderItemsByOrderIdsQuery({
  ensureSupplierTables,
  orderIds = []
} = {}) {
  await ensureSupplierTables();
  const safeIds = Array.isArray(orderIds)
    ? orderIds.map((id) => Number.parseInt(id, 10)).filter((id) => Number.isFinite(id) && id > 0)
    : [];

  if (!safeIds.length) {
    return [];
  }

  const placeholders = safeIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `
      SELECT
        soi.id,
        soi.order_id,
        soi.product_id,
        soi.product_name,
        soi.quantity,
        soi.unit_cost,
        soi.line_total,
        soi.notes,
        DATE_FORMAT(soi.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(soi.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_items soi
      WHERE soi.order_id IN (${placeholders})
      ORDER BY soi.order_id ASC, soi.id ASC
    `,
    safeIds
  );

  return rows;
}
