import { pool } from '../../config/db.js';

let supplierTablesPromise = null;

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName]
  );

  return Boolean(rows[0]?.count);
}

async function indexExists(tableName, indexName) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [tableName, indexName]
  );

  return Boolean(rows[0]?.count);
}

export async function ensureSupplierTables() {
  if (supplierTablesPromise) {
    return supplierTablesPromise;
  }

  supplierTablesPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_proveedores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(140) NOT NULL,
        telefono VARCHAR(60) NULL,
        email VARCHAR(190) NULL,
        dias_pedido_csv VARCHAR(80) NULL,
        dias_entrega_csv VARCHAR(80) NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'activo',
        notas VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_proveedor_nombre (nombre),
        INDEX idx_proveedor_estado (estado)
      )
    `);

    const hasSupplierId = await columnExists('ops_producto', 'supplier_id');
    if (!hasSupplierId) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD COLUMN supplier_id INT NULL AFTER categoria
      `);
    }

    const hasSupplierIndex = await indexExists('ops_producto', 'idx_producto_supplier_id');
    if (!hasSupplierIndex) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD INDEX idx_producto_supplier_id (supplier_id)
      `);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_supplier_orders (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        supplier_id INT NOT NULL,
        order_date DATE NOT NULL,
        delivery_date DATE NOT NULL,
        expected_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        notes VARCHAR(255) NULL,
        operator_id INT NULL,
        operator_name VARCHAR(140) NULL,
        operator_role VARCHAR(20) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_supplier_orders_delivery_status (delivery_date, status),
        INDEX idx_supplier_orders_supplier_delivery (supplier_id, delivery_date),
        CONSTRAINT fk_supplier_orders_supplier
          FOREIGN KEY (supplier_id) REFERENCES ops_proveedores(id)
          ON DELETE CASCADE
      )
    `);
  })();

  try {
    await supplierTablesPromise;
  } catch (error) {
    supplierTablesPromise = null;
    throw error;
  }
}

export async function listSuppliers() {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        nombre,
        telefono,
        email,
        dias_pedido_csv,
        dias_entrega_csv,
        estado,
        notas,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_proveedores
      ORDER BY nombre ASC
    `
  );

  return rows;
}

export async function createSupplier(payload) {
  await ensureSupplierTables();
  const [result] = await pool.query(
    `
      INSERT INTO ops_proveedores (
        nombre,
        telefono,
        email,
        dias_pedido_csv,
        dias_entrega_csv,
        estado,
        notas
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.nombre,
      payload.telefono || null,
      payload.email || null,
      payload.dias_pedido_csv || null,
      payload.dias_entrega_csv || null,
      payload.estado || 'activo',
      payload.notas || null
    ]
  );

  const [rows] = await pool.query(
    `
      SELECT
        id,
        nombre,
        telefono,
        email,
        dias_pedido_csv,
        dias_entrega_csv,
        estado,
        notas,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_proveedores
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return rows[0] || null;
}

export async function assignSupplierToProduct({ productId, supplierId }) {
  await ensureSupplierTables();

  await pool.query(
    `
      UPDATE ops_producto
      SET supplier_id = ?
      WHERE id = ?
    `,
    [supplierId, productId]
  );

  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.nombre,
        p.categoria,
        p.barcode,
        p.barcode_normalized,
        p.stock_actual,
        p.supplier_id,
        s.nombre AS supplier_name
      FROM ops_producto p
      LEFT JOIN ops_proveedores s ON s.id = p.supplier_id
      WHERE p.id = ?
      LIMIT 1
    `,
    [productId]
  );

  return rows[0] || null;
}

export async function findSupplierById(id) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        nombre,
        telefono,
        email,
        dias_pedido_csv,
        dias_entrega_csv,
        estado,
        notas,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_proveedores
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

export async function findProductById(productId) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT id, nombre, supplier_id
      FROM ops_producto
      WHERE id = ?
      LIMIT 1
    `,
    [productId]
  );

  return rows[0] || null;
}

export async function listProductsBySupplier(supplierId) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.nombre,
        p.categoria,
        p.precio_venta,
        p.stock_actual,
        p.barcode,
        p.barcode_normalized,
        p.supplier_id
      FROM ops_producto p
      WHERE p.supplier_id = ?
      ORDER BY p.nombre ASC
    `,
    [supplierId]
  );

  return rows;
}

export async function createSupplierOrder(payload) {
  await ensureSupplierTables();
  const [result] = await pool.query(
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.supplier_id,
      payload.order_date,
      payload.delivery_date,
      payload.expected_amount,
      payload.status || 'pendiente',
      payload.notes || null,
      payload.operator_id || null,
      payload.operator_name || null,
      payload.operator_role || null
    ]
  );

  const [rows] = await pool.query(
    `
      SELECT
        so.id,
        so.supplier_id,
        s.nombre AS supplier_name,
        DATE_FORMAT(so.order_date, '%Y-%m-%d') AS order_date,
        DATE_FORMAT(so.delivery_date, '%Y-%m-%d') AS delivery_date,
        so.expected_amount,
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
    [result.insertId]
  );

  return rows[0] || null;
}

export async function listSupplierOrdersByDateRange({ fromDate, toDate, status = 'pendiente' }) {
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
        so.status,
        so.notes,
        so.operator_id,
        so.operator_name,
        so.operator_role,
        DATE_FORMAT(so.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(so.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_orders so
      INNER JOIN ops_proveedores s ON s.id = so.supplier_id
      WHERE so.delivery_date >= ?
        AND so.delivery_date <= ?
        AND so.status = ?
      ORDER BY so.delivery_date ASC, s.nombre ASC, so.id ASC
    `,
    [fromDate, toDate, status]
  );

  return rows;
}

export async function listSupplierOrders({ limit = 50 } = {}) {
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
