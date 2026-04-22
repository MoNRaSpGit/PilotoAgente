import { pool } from '../../config/db.js';
import { runMigrations } from '../../bootstrap/migrations/runMigrations.js';
import { ensureWebUsersTable } from '../webAuth/webAuth.repository.js';

let webOrdersTablesPromise = null;

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
    await ensureWebUsersTable();
    await runMigrations();
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

export async function createWebOrder({ webUserId, items, notes = null, paymentMethod = 'efectivo', deliveryMode = 'pickup' }) {
  await ensureWebOrdersTables();

  return withTransaction(async (connection) => {
    const normalizedItems = items.map((item) => {
      const unitPrice = Number(item.unit_price || 0);
      const quantity = Number(item.quantity || 0);
      const lineTotal = Number.isFinite(Number(item.line_total))
        ? Number(item.line_total || 0)
        : Number((unitPrice * quantity).toFixed(2));

      return {
        ...item,
        unit_price: unitPrice,
        quantity,
        line_total: Number(lineTotal.toFixed(2))
      };
    });

    const totalEstimado = normalizedItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
    const safeTotalEstimado = Number(totalEstimado.toFixed(2));

    const [orderResult] = await connection.query(
      `
        INSERT INTO ops_web_pedidos (
          web_usuario_id,
          estado,
          cliente_visible,
          notas,
          payment_method,
          delivery_mode,
          total_estimado
        )
        VALUES (?, 'pendiente', 1, ?, ?, ?, ?)
      `,
      [webUserId, notes || null, paymentMethod, deliveryMode, safeTotalEstimado]
    );

    if (normalizedItems.length > 0) {
      const placeholders = normalizedItems.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const values = [];

      for (const item of normalizedItems) {
        values.push(
          orderResult.insertId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit_price,
          item.line_total
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

      const aggregatedByProduct = new Map();
      for (const item of normalizedItems) {
        const productId = Number(item.product_id || 0);
        if (!Number.isFinite(productId) || productId <= 0) {
          continue;
        }
        const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
        const unitPrice = Number(Number(item.unit_price || 0).toFixed(2));
        const current = aggregatedByProduct.get(productId) || {
          productId,
          timesOrdered: 0,
          quantityTotal: 0,
          lastUnitPrice: 0
        };
        current.timesOrdered += 1;
        current.quantityTotal += quantity;
        current.lastUnitPrice = unitPrice;
        aggregatedByProduct.set(productId, current);
      }

      if (aggregatedByProduct.size > 0) {
        const historyRows = [...aggregatedByProduct.values()];
        const historyPlaceholders = historyRows.map(() => '(?, ?, ?, ?, ?, NOW())').join(', ');
        const historyValues = [];

        for (const row of historyRows) {
          historyValues.push(
            webUserId,
            row.productId,
            row.timesOrdered,
            row.quantityTotal,
            row.lastUnitPrice
          );
        }

        await connection.query(
          `
            INSERT INTO ops_web_usuario_producto_historial (
              web_usuario_id,
              product_id,
              times_ordered,
              quantity_total,
              last_unit_price,
              last_order_at
            )
            VALUES ${historyPlaceholders}
            ON DUPLICATE KEY UPDATE
              times_ordered = times_ordered + VALUES(times_ordered),
              quantity_total = quantity_total + VALUES(quantity_total),
              last_unit_price = VALUES(last_unit_price),
              last_order_at = VALUES(last_order_at),
              updated_at = CURRENT_TIMESTAMP
          `,
          historyValues
        );
      }
    }

    return {
      id: Number(orderResult.insertId),
      total_estimado: safeTotalEstimado
    };
  });
}

export async function listWebUserTopProducts(webUserId, { limit = 10 } = {}) {
  await ensureWebOrdersTables();

  const safeLimit = Math.max(1, Math.min(50, Math.floor(Number(limit) || 10)));

  const [rows] = await pool.query(
    `
      SELECT
        h.product_id,
        p.nombre AS product_name,
        p.precio_venta AS unit_price,
        p.estado AS product_status,
        h.times_ordered AS purchase_count,
        h.quantity_total,
        DATE_FORMAT(h.last_order_at, '%Y-%m-%d %H:%i:%s') AS last_order_at
      FROM ops_web_usuario_producto_historial h
      INNER JOIN ops_producto p ON p.id = h.product_id
      WHERE h.web_usuario_id = ?
        AND p.estado = 'activo'
      ORDER BY h.times_ordered DESC, h.quantity_total DESC, h.last_order_at DESC, h.product_id DESC
      LIMIT ?
    `,
    [webUserId, safeLimit]
  );

  return rows;
}

export async function getWebOrderById(orderId) {
  await ensureWebOrdersTables();

  const [orderRows] = await pool.query(
    `
      SELECT
        p.id,
        p.web_usuario_id,
        p.estado,
        p.cliente_visible,
        p.admin_visible,
        p.notas,
        p.payment_method,
        p.delivery_mode,
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
        cliente_visible,
        admin_visible,
        notas,
        payment_method,
        delivery_mode,
        total_estimado,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_web_pedidos
      WHERE web_usuario_id = ?
        AND cliente_visible = 1
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
        p.cliente_visible,
        p.admin_visible,
        p.notas,
        p.payment_method,
        p.delivery_mode,
        p.total_estimado,
        DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(p.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
        u.nombre AS web_usuario_nombre,
        u.email AS web_usuario_email
      FROM ops_web_pedidos p
      INNER JOIN ops_web_usuarios u ON u.id = p.web_usuario_id
      WHERE p.admin_visible = 1
        AND p.estado IN (
        'pendiente',
        'en_proceso',
        'en proceso',
        'listo',
        'entregado',
        'nuevo',
        'visto',
        'preparando',
        'listo_para_cobrar'
      )
      ORDER BY p.id DESC
      LIMIT ?
    `,
    [safeLimit]
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

export async function hideWebOrderForUser({ orderId, webUserId }) {
  await ensureWebOrdersTables();

  const [result] = await pool.query(
    `
      UPDATE ops_web_pedidos
      SET cliente_visible = 0
      WHERE id = ?
        AND web_usuario_id = ?
    `,
    [orderId, webUserId]
  );

  return Number(result?.affectedRows || 0) > 0;
}

export async function hideWebOrderForAdmin({ orderId }) {
  await ensureWebOrdersTables();

  const [result] = await pool.query(
    `
      UPDATE ops_web_pedidos
      SET admin_visible = 0
      WHERE id = ?
    `,
    [orderId]
  );

  return Number(result?.affectedRows || 0) > 0;
}
