import { pool } from '../../config/db.js';
import { ensureWebUsersTable } from '../webAuth/webAuth.repository.js';
import { getRequestContext } from '../../observability/telemetry.js';

let webOrdersTablesPromise = null;
const ORDER_STAGE_LOG_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.OBS_ORDER_STAGE_LOG_ENABLED || '').trim().toLowerCase()
);
const ORDER_STAGE_SLOW_MS = Math.max(1, Number(process.env.OBS_ORDER_STAGE_SLOW_MS || 250));

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function logOrderStage(stage, startedAtMs, extra = {}, options = {}) {
  const durationMs = Number((nowMs() - Number(startedAtMs || 0)).toFixed(2));
  if (!ORDER_STAGE_LOG_ENABLED) {
    return durationMs;
  }

  const forceLog = Boolean(options?.force);
  if (!forceLog && durationMs < ORDER_STAGE_SLOW_MS) {
    return durationMs;
  }

  const requestId = getRequestContext()?.requestId || 'no-req';
  const extras = Object.entries(extra || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(' | ');
  const suffix = extras ? ` | ${extras}` : '';

  console.log(`[OBS][ORDER] ${stage} | ${durationMs}ms | req=${requestId}${suffix}`);
  return durationMs;
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
    await ensureWebUsersTable();
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

function createRepoError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function createWebOrder({ webUserId, items, notes = null, paymentMethod = 'efectivo', deliveryMode = 'pickup' }) {
  await ensureWebOrdersTables();

  return withTransaction(async (connection) => {
    const txStartedAtMs = nowMs();
    let stageStartedAtMs = nowMs();
    let resolvedItemsCount = 0;
    try {
      const quantityByProductId = new Map();
      for (const item of items) {
        const productId = Number(item?.product_id || 0);
        const quantity = Math.max(1, Math.floor(Number(item?.quantity) || 1));
        if (!Number.isFinite(productId) || productId <= 0) {
          continue;
        }
        quantityByProductId.set(productId, (quantityByProductId.get(productId) || 0) + quantity);
      }

      const normalizedItems = [...quantityByProductId.entries()].map(([product_id, quantity]) => ({
        product_id: Number(product_id),
        quantity: Number(quantity)
      }));
      if (normalizedItems.length === 0) {
        throw createRepoError('El pedido debe incluir al menos un producto valido', 400);
      }
      logOrderStage('normalize_items', stageStartedAtMs, {
        raw_items: Array.isArray(items) ? items.length : 0,
        distinct_items: normalizedItems.length
      });

      const productIds = normalizedItems.map((item) => item.product_id);
      const productPlaceholders = productIds.map(() => '?').join(', ');
      stageStartedAtMs = nowMs();
      const [productRows] = await connection.query(
        `
          SELECT
            p.id,
            p.nombre,
            p.precio_venta,
            p.estado
          FROM ops_producto p
          WHERE p.id IN (${productPlaceholders})
        `,
        productIds
      );
      logOrderStage('select_products', stageStartedAtMs, {
        requested_products: productIds.length,
        found_products: Array.isArray(productRows) ? productRows.length : 0
      });

      const productMap = new Map(
        (Array.isArray(productRows) ? productRows : [])
          .map((row) => [Number(row.id), row])
      );

      const missingOrInactive = [];
      const resolvedItems = normalizedItems.map((item) => {
        const product = productMap.get(item.product_id);
        if (!product || String(product.estado || '').trim().toLowerCase() !== 'activo') {
          missingOrInactive.push(item.product_id);
          return null;
        }

        const unitPrice = Number(product.precio_venta || 0);
        const lineTotal = Number((unitPrice * Number(item.quantity || 0)).toFixed(2));

        return {
          product_id: item.product_id,
          product_name: String(product.nombre || '').trim(),
          quantity: Number(item.quantity || 0),
          unit_price: unitPrice,
          line_total: lineTotal
        };
      }).filter(Boolean);
      resolvedItemsCount = resolvedItems.length;

      if (missingOrInactive.length > 0 || resolvedItems.length !== normalizedItems.length) {
        throw createRepoError(`Producto no disponible: ${missingOrInactive[0] || ''}`.trim(), 409);
      }

      const totalEstimado = resolvedItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
      const safeTotalEstimado = Number(totalEstimado.toFixed(2));
      if (deliveryMode === 'delivery' && safeTotalEstimado < 200) {
        throw createRepoError('Delivery habilitado con compra igual o mayor a $200', 409);
      }

      stageStartedAtMs = nowMs();
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
      logOrderStage('insert_order', stageStartedAtMs, {
        order_id: Number(orderResult?.insertId || 0),
        total: safeTotalEstimado
      });

      if (resolvedItems.length > 0) {
        const placeholders = resolvedItems.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const values = [];

        for (const item of resolvedItems) {
          values.push(
            orderResult.insertId,
            item.product_id,
            item.product_name,
            item.quantity,
            item.unit_price,
            item.line_total
          );
        }

        stageStartedAtMs = nowMs();
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
        logOrderStage('insert_order_items', stageStartedAtMs, {
          item_rows: resolvedItems.length
        });
      }

      return {
        id: Number(orderResult.insertId),
        total_estimado: safeTotalEstimado,
        items: resolvedItems
      };
    } finally {
      logOrderStage('tx_total', txStartedAtMs, {
        item_rows: resolvedItemsCount
      }, { force: true });
    }
  });
}

export async function upsertWebUserProductHistory({ webUserId, items = [] } = {}) {
  await ensureWebOrdersTables();

  const parsedWebUserId = Number(webUserId);
  if (!Number.isFinite(parsedWebUserId) || parsedWebUserId <= 0 || !Array.isArray(items) || items.length === 0) {
    return 0;
  }

  const aggregatedByProduct = new Map();
  for (const item of items) {
    const productId = Number(item?.product_id || 0);
    if (!Number.isFinite(productId) || productId <= 0) {
      continue;
    }
    const quantity = Math.max(0, Math.floor(Number(item?.quantity) || 0));
    const unitPrice = Number(Number(item?.unit_price || 0).toFixed(2));
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

  if (aggregatedByProduct.size === 0) {
    return 0;
  }

  const historyRows = [...aggregatedByProduct.values()];
  const historyPlaceholders = historyRows.map(() => '(?, ?, ?, ?, ?, NOW())').join(', ');
  const historyValues = [];

  for (const row of historyRows) {
    historyValues.push(
      parsedWebUserId,
      row.productId,
      row.timesOrdered,
      row.quantityTotal,
      row.lastUnitPrice
    );
  }

  await pool.query(
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

  return historyRows.length;
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
