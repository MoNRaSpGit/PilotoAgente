import { pool } from '../../config/db.js';

const CLIENT_COLUMNS = `
  id,
  nombre,
  saldo,
  entregas_count,
  DATE_FORMAT(ultima_fecha_pago, '%Y-%m-%d') AS ultima_fecha_pago,
  DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
  estado
`;

const CLIENT_HISTORY_COLUMNS = `
  id,
  client_id,
  tipo,
  DATE_FORMAT(fecha_movimiento, '%Y-%m-%d') AS fecha_movimiento,
  articulo,
  cantidad,
  precio_unitario,
  total,
  detalle
`;

export async function ensureClientsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ops_clientes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(140) NOT NULL,
      saldo DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      entregas_count INT NOT NULL DEFAULT 0,
      ultima_fecha_pago DATE NOT NULL,
      fecha_vencimiento DATE NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'activo',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const [columns] = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ops_clientes'
        AND COLUMN_NAME = 'entregas_count'
    `
  );

  if (!columns[0]?.count) {
    await pool.query(`
      ALTER TABLE ops_clientes
      ADD COLUMN entregas_count INT NOT NULL DEFAULT 0
    `);
  }
}

export async function ensureClientHistoryTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ops_clientes_historial (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      tipo VARCHAR(20) NOT NULL,
      fecha_movimiento DATE NOT NULL,
      articulo VARCHAR(190) NOT NULL,
      cantidad INT NOT NULL DEFAULT 1,
      precio_unitario DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      detalle VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_client_fecha (client_id, fecha_movimiento),
      CONSTRAINT fk_client_history_client
        FOREIGN KEY (client_id) REFERENCES ops_clientes(id)
        ON DELETE CASCADE
    )
  `);
}

export async function listClients() {
  await ensureClientsTable();

  const [rows] = await pool.query(
    `
      SELECT ${CLIENT_COLUMNS}
      FROM ops_clientes
      ORDER BY id DESC
    `
  );

  return rows;
}

export async function insertClient({ nombre, saldo, ultimaFechaPago, fechaVencimiento }) {
  await ensureClientsTable();

  const [result] = await pool.query(
    `
      INSERT INTO ops_clientes (
        nombre,
        saldo,
        entregas_count,
        ultima_fecha_pago,
        fecha_vencimiento
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [nombre, saldo, 0, ultimaFechaPago, fechaVencimiento]
  );

  const [rows] = await pool.query(
    `
      SELECT ${CLIENT_COLUMNS}
      FROM ops_clientes
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return rows[0] || null;
}

export async function updateClientPaymentById({ clientId, ultimaFechaPago, fechaVencimiento }) {
  await ensureClientsTable();

  const [result] = await pool.query(
    `
      UPDATE ops_clientes
      SET saldo = 0,
          entregas_count = 0,
          ultima_fecha_pago = ?,
          fecha_vencimiento = ?
      WHERE id = ?
    `,
    [ultimaFechaPago, fechaVencimiento, clientId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `
      SELECT ${CLIENT_COLUMNS}
      FROM ops_clientes
      WHERE id = ?
      LIMIT 1
    `,
    [clientId]
  );

  return rows[0] || null;
}

export async function updateClientDeliveryById({ clientId, entregaMonto, ultimaFechaPago, fechaVencimiento }) {
  await ensureClientsTable();

  const [result] = await pool.query(
    `
      UPDATE ops_clientes
      SET saldo = GREATEST(saldo - ?, 0),
          entregas_count = CASE
            WHEN GREATEST(saldo - ?, 0) = 0 THEN 0
            ELSE entregas_count + 1
          END,
          ultima_fecha_pago = ?,
          fecha_vencimiento = ?
      WHERE id = ?
    `,
    [entregaMonto, entregaMonto, ultimaFechaPago, fechaVencimiento, clientId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `
      SELECT ${CLIENT_COLUMNS}
      FROM ops_clientes
      WHERE id = ?
      LIMIT 1
    `,
    [clientId]
  );

  return rows[0] || null;
}

export async function updateClientChargeById({ clientId, chargeAmount, ultimaFechaPago, fechaVencimiento }) {
  await ensureClientsTable();

  const [result] = await pool.query(
    `
      UPDATE ops_clientes
      SET saldo = saldo + ?,
          ultima_fecha_pago = ?,
          fecha_vencimiento = ?,
          estado = 'activo'
      WHERE id = ?
    `,
    [chargeAmount, ultimaFechaPago, fechaVencimiento, clientId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `
      SELECT ${CLIENT_COLUMNS}
      FROM ops_clientes
      WHERE id = ?
      LIMIT 1
    `,
    [clientId]
  );

  return rows[0] || null;
}

export async function insertClientHistoryEntries({ clientId, items = [], fechaMovimiento, detalle }) {
  await ensureClientsTable();
  await ensureClientHistoryTable();

  const safeItems = Array.isArray(items)
    ? items
        .map((item) => ({
          articulo: String(item?.articulo || item?.name || 'Producto').trim() || 'Producto',
          cantidad: Number(item?.cantidad || item?.quantity || 1),
          precioUnitario: Number(item?.precio_unitario || item?.price || 0),
          total: Number(item?.total || 0)
        }))
        .filter((item) => Number.isFinite(item.cantidad) && item.cantidad > 0)
    : [];

  if (safeItems.length === 0) {
    return [];
  }

  const movementDate = fechaMovimiento || new Date().toISOString().slice(0, 10);
  const values = safeItems.map((item) => [
    clientId,
    'cargo',
    movementDate,
    item.articulo,
    item.cantidad,
    item.precioUnitario,
    item.total,
    detalle || null
  ]);

  const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const flattenedValues = values.flat();

  await pool.query(
    `
      INSERT INTO ops_clientes_historial (
        client_id,
        tipo,
        fecha_movimiento,
        articulo,
        cantidad,
        precio_unitario,
        total,
        detalle
      )
      VALUES ${placeholders}
    `,
    flattenedValues
  );

  return values;
}

export async function listClientHistory({ clientId, fromDate, toDate }) {
  await ensureClientsTable();
  await ensureClientHistoryTable();

  const conditions = ['client_id = ?'];
  const params = [clientId];

  if (fromDate) {
    conditions.push('fecha_movimiento >= ?');
    params.push(fromDate);
  }

  if (toDate) {
    conditions.push('fecha_movimiento <= ?');
    params.push(toDate);
  }

  const [rows] = await pool.query(
    `
      SELECT ${CLIENT_HISTORY_COLUMNS}
      FROM ops_clientes_historial
      WHERE ${conditions.join(' AND ')}
      ORDER BY fecha_movimiento DESC, id DESC
    `,
    params
  );

  return rows;
}
