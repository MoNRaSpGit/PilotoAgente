import { pool } from '../../config/db.js';

let webOrdersTablesPromise = null;

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

async function withTransaction(work) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function ensureWebOrdersTables() {
  if (webOrdersTablesPromise) {
    return webOrdersTablesPromise;
  }

  webOrdersTablesPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_web_pedidos (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        web_usuario_id BIGINT NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'nuevo',
        notas VARCHAR(255) NULL,
        total_estimado DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_web_pedidos_estado_fecha (estado, created_at),
        INDEX idx_web_pedidos_usuario_fecha (web_usuario_id, created_at),
        CONSTRAINT fk_web_pedido_usuario
          FOREIGN KEY (web_usuario_id) REFERENCES ops_web_usuarios(id)
          ON DELETE CASCADE
      )
    `);

    const hasEstadoIdIndex = await indexExists('ops_web_pedidos', 'idx_web_pedidos_estado_id');
    if (!hasEstadoIdIndex) {
      await pool.query(`
        ALTER TABLE ops_web_pedidos
        ADD INDEX idx_web_pedidos_estado_id (estado, id)
      `);
    }

    const hasUsuarioIdIndex = await indexExists('ops_web_pedidos', 'idx_web_pedidos_usuario_id');
    if (!hasUsuarioIdIndex) {
      await pool.query(`
        ALTER TABLE ops_web_pedidos
        ADD INDEX idx_web_pedidos_usuario_id (web_usuario_id, id)
      `);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_web_pedido_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        pedido_id BIGINT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(190) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        line_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_web_pedido_items_pedido (pedido_id),
        INDEX idx_web_pedido_items_product (product_id),
        CONSTRAINT fk_web_pedido_item_pedido
          FOREIGN KEY (pedido_id) REFERENCES ops_web_pedidos(id)
          ON DELETE CASCADE
      )
    `);
  })();

  try {
    await webOrdersTablesPromise;
  } catch (error) {
    webOrdersTablesPromise = null;
    throw error;
  }
}

export async function findProductsForWebOrderItems(productIds = []) {
  await ensureWebOrdersTables();

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return [];
  }

  const placeholders = productIds.map(() => '?').join(', ');

  const [rows] = await pool.query(
    `
      SELECT
        id,
        nombre,
        precio_venta,
        estado
      FROM ops_producto
      WHERE id IN (${placeholders})
    `,
    productIds
  );

  return rows;
}

export async function createWebOrder({ webUserId, items, notes = null }) {
  await ensureWebOrdersTables();

  return withTransaction(async (connection) => {
    const totalEstimado = items.reduce((sum, item) => {
      const lineTotal = Number((Number(item.unit_price) * Number(item.quantity)).toFixed(2));
      return sum + lineTotal;
    }, 0);
    const safeTotalEstimado = Number(totalEstimado.toFixed(2));

    const [orderResult] = await connection.query(
      `
        INSERT INTO ops_web_pedidos (web_usuario_id, estado, notas, total_estimado)
        VALUES (?, 'nuevo', ?, ?)
      `,
      [webUserId, notes || null, safeTotalEstimado]
    );

    if (items.length > 0) {
      const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const values = [];

      for (const item of items) {
        const lineTotal = Number((Number(item.unit_price) * Number(item.quantity)).toFixed(2));
        values.push(
          orderResult.insertId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit_price,
          lineTotal
        );
      }

      await connection.query(
        `
          INSERT INTO ops_web_pedido_items (
            pedido_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            line_total
          )
          VALUES ${placeholders}
        `,
        values
      );
    }

    return {
      id: Number(orderResult.insertId),
      total_estimado: safeTotalEstimado
    };
  });
}

export async function getWebOrderById(orderId) {
  await ensureWebOrdersTables();

  const [orderRows] = await pool.query(
    `
      SELECT
        p.id,
        p.web_usuario_id,
        p.estado,
        p.notas,
        p.total_estimado,
        DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(p.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
        u.nombre AS web_usuario_nombre,
        u.email AS web_usuario_email
      FROM ops_web_pedidos p
      INNER JOIN ops_web_usuarios u ON u.id = p.web_usuario_id
      WHERE p.id = ?
      LIMIT 1
    `,
    [orderId]
  );

  const order = orderRows[0] || null;

  if (!order) {
    return null;
  }

  const [itemRows] = await pool.query(
    `
      SELECT
        id,
        pedido_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        line_total,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM ops_web_pedido_items
      WHERE pedido_id = ?
      ORDER BY id ASC
    `,
    [orderId]
  );

  return {
    ...order,
    items: itemRows
  };
}

export async function listWebOrdersByUserId(webUserId, { limit = 20 } = {}) {
  await ensureWebOrdersTables();

  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 20)));

  const [rows] = await pool.query(
    `
      SELECT
        id,
        web_usuario_id,
        estado,
        notas,
        total_estimado,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_web_pedidos
      WHERE web_usuario_id = ?
      ORDER BY id DESC
      LIMIT ?
    `,
    [webUserId, safeLimit]
  );

  if (rows.length === 0) {
    return rows;
  }

  const orderIds = rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
  const placeholders = orderIds.map(() => '?').join(', ');

  const [itemRows] = await pool.query(
    `
      SELECT
        id,
        pedido_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        line_total
      FROM ops_web_pedido_items
      WHERE pedido_id IN (${placeholders})
      ORDER BY pedido_id DESC, id ASC
    `,
    orderIds
  );

  const itemsByOrderId = new Map();
  for (const item of itemRows) {
    const orderId = Number(item.pedido_id);
    if (!itemsByOrderId.has(orderId)) {
      itemsByOrderId.set(orderId, []);
    }
    itemsByOrderId.get(orderId).push(item);
  }

  return rows.map((order) => ({
    ...order,
    items: itemsByOrderId.get(Number(order.id)) || []
  }));
}

export async function listPendingWebOrders({ limit = 40 } = {}) {
  await ensureWebOrdersTables();

  const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 40)));

  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.web_usuario_id,
        p.estado,
        p.notas,
        p.total_estimado,
        DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(p.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
        u.nombre AS web_usuario_nombre,
        u.email AS web_usuario_email
      FROM ops_web_pedidos p
      INNER JOIN ops_web_usuarios u ON u.id = p.web_usuario_id
      WHERE p.estado IN ('nuevo', 'visto', 'preparando', 'listo_para_cobrar')
      ORDER BY p.id DESC
      LIMIT ?
    `,
    [safeLimit]
  );

  return rows;
}

export async function updateWebOrderStatus({ orderId, status }) {
  await ensureWebOrdersTables();

  await pool.query(
    `
      UPDATE ops_web_pedidos
      SET estado = ?
      WHERE id = ?
    `,
    [status, orderId]
  );

  return getWebOrderById(orderId);
}
