import {
  createWebOrder,
  findProductsForWebOrderItems,
  getWebOrderById,
  hideWebOrderForAdmin,
  hideWebOrderForUser,
  listWebUserTopProducts,
  listPendingWebOrders,
  listWebOrdersByUserId,
  updateWebOrderStatus
} from './webOrders.repository.js';
import { awardWebPointsOnOrderDelivered, registerWebOrderMetrics } from '../webUsers/webUsers.repository.js';
import { invalidateWebAuthProfileCache } from '../webUsers/webUsers.service.js';
import { emitWebOrderEvent } from './webOrders.events.js';
import { canHideWebOrder, normalizeWebOrderStatus } from './webOrders.status.js';
import { parseCreateOrderPayload, parseOrderId, parseOrderStatusPayload } from './webOrders.contract.js';

const WEB_MY_ORDERS_CACHE_TTL_MS = 30 * 1000;
const webMyOrdersCache = new Map();
const webMyOrdersInFlight = new Map();

function createServiceError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getNow() {
  return Date.now();
}

function getMyOrdersCacheKey(webUserId, limit) {
  return `${Number(webUserId)}:${Number(limit)}`;
}

function getCachedMyOrders(webUserId, limit) {
  const cacheKey = getMyOrdersCacheKey(webUserId, limit);
  const entry = webMyOrdersCache.get(cacheKey);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= getNow()) {
    webMyOrdersCache.delete(cacheKey);
    return null;
  }
  return entry.value;
}

function setCachedMyOrders(webUserId, limit, value) {
  const cacheKey = getMyOrdersCacheKey(webUserId, limit);
  webMyOrdersCache.set(cacheKey, {
    value,
    expiresAt: getNow() + WEB_MY_ORDERS_CACHE_TTL_MS
  });
}

function runMyOrdersSingleFlight(webUserId, limit, factory) {
  const cacheKey = getMyOrdersCacheKey(webUserId, limit);
  if (webMyOrdersInFlight.has(cacheKey)) {
    return webMyOrdersInFlight.get(cacheKey);
  }

  const task = Promise.resolve()
    .then(factory)
    .finally(() => {
      webMyOrdersInFlight.delete(cacheKey);
    });

  webMyOrdersInFlight.set(cacheKey, task);
  return task;
}

function invalidateMyOrdersCacheForUser(webUserId) {
  const userIdPrefix = `${Number(webUserId)}:`;
  for (const key of webMyOrdersCache.keys()) {
    if (String(key).startsWith(userIdPrefix)) {
      webMyOrdersCache.delete(key);
    }
  }
}

export async function createOrderFromWebUser(webUser, payload = {}) {
  if (!webUser?.id) {
    throw createServiceError('Usuario web invalido', 401);
  }

  const {
    items: normalizedItems,
    notes,
    paymentMethod,
    deliveryMode
  } = parseCreateOrderPayload(payload);

  const productIds = [...new Set(normalizedItems.map((item) => item.product_id))];
  const products = await findProductsForWebOrderItems(productIds);
  const productMap = new Map(products.map((product) => [Number(product.id), product]));

  const resolvedItems = normalizedItems.map((item) => {
    const product = productMap.get(item.product_id);

    if (!product || product.estado !== 'activo') {
      throw createServiceError(`Producto no disponible: ${item.product_id}`, 409);
    }

    const unitPrice = Number(product.precio_venta || 0);
    const lineTotal = Number((unitPrice * Number(item.quantity || 0)).toFixed(2));

    return {
      product_id: item.product_id,
      product_name: product.nombre,
      quantity: item.quantity,
      unit_price: unitPrice,
      line_total: lineTotal
    };
  });

  const orderTotal = resolvedItems.reduce(
    (sum, item) => sum + Number(item.line_total || 0),
    0
  );
  const safeOrderTotal = Number(orderTotal.toFixed(2));
  if (deliveryMode === 'delivery' && safeOrderTotal < 200) {
    throw createServiceError('Delivery habilitado con compra igual o mayor a $200', 409);
  }

  const createdOrder = await createWebOrder({
    webUserId: webUser.id,
    items: resolvedItems,
    notes,
    paymentMethod,
    deliveryMode
  });
  registerWebOrderMetrics({
    webUserId: webUser.id,
    orderId: createdOrder.id,
    orderTotal: safeOrderTotal,
    awardedPoints: 0
  }).catch(() => {});
  invalidateMyOrdersCacheForUser(webUser.id);
  invalidateWebAuthProfileCache(webUser.id);

  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const item = {
    id: createdOrder.id,
    web_usuario_id: webUser.id,
    estado: 'pendiente',
    cliente_visible: 1,
    admin_visible: 1,
    notas: notes,
    payment_method: paymentMethod,
    delivery_mode: deliveryMode,
    total_estimado: safeOrderTotal,
    created_at: timestamp,
    updated_at: timestamp,
    web_usuario_nombre: webUser.nombre,
    web_usuario_email: webUser.email,
    items: resolvedItems.map((itemRow) => ({
      product_id: itemRow.product_id,
      product_name: itemRow.product_name,
      quantity: itemRow.quantity,
      unit_price: Number(itemRow.unit_price || 0),
      line_total: Number(itemRow.line_total || 0)
    }))
  };

  emitWebOrderEvent({
    type: 'order_created',
    orderId: createdOrder.id,
    status: 'pendiente',
    webUserId: webUser.id,
    order: item
  });

  return {
    item,
    meta: {
      notification_text: `${webUser.nombre} te hizo un pedido`,
      awarded_points: 0,
      order_total: safeOrderTotal
    }
  };
}

export async function listMyWebOrders(webUser, query = {}) {
  if (!webUser?.id) {
    throw createServiceError('Usuario web invalido', 401);
  }

  const parsedLimit = Math.max(1, Math.min(100, Math.floor(Number(query?.limit) || 20)));
  const cached = getCachedMyOrders(webUser.id, parsedLimit);
  if (cached) {
    return { items: cached };
  }

  return runMyOrdersSingleFlight(webUser.id, parsedLimit, async () => {
    const secondCached = getCachedMyOrders(webUser.id, parsedLimit);
    if (secondCached) {
      return { items: secondCached };
    }

    const items = await listWebOrdersByUserId(webUser.id, { limit: parsedLimit });
    setCachedMyOrders(webUser.id, parsedLimit, items);
    return { items };
  });
}

export async function listMyRepeatProducts(webUser, query = {}) {
  if (!webUser?.id) {
    throw createServiceError('Usuario web invalido', 401);
  }

  const items = await listWebUserTopProducts(webUser.id, {
    limit: query?.limit
  });

  return { items };
}

export async function listAdminIncomingWebOrders(query = {}) {
  const items = await listPendingWebOrders({
    limit: query?.limit
  });

  return {
    items: items.map((item) => ({
      ...item,
      alert_text: `${item.web_usuario_nombre} te hizo un pedido`
    }))
  };
}

export async function changeWebOrderStatus(orderId, payload = {}) {
  const parsedOrderId = parseOrderId(orderId);
  const { status } = parseOrderStatusPayload(payload);

  const previousOrder = await getWebOrderById(parsedOrderId);
  if (!previousOrder) {
    throw createServiceError('Pedido no encontrado', 404);
  }

  const previousStatus = normalizeWebOrderStatus(previousOrder.estado);
  const item = await updateWebOrderStatus({
    orderId: parsedOrderId,
    status
  });

  if (!item) {
    throw createServiceError('Pedido no encontrado', 404);
  }

  let pointsMeta = {
    awarded_points: 0,
    points_applied: false
  };

  if (status === 'entregado' && previousStatus !== 'entregado') {
    const pointsResult = await awardWebPointsOnOrderDelivered({
      webUserId: item.web_usuario_id,
      orderId: parsedOrderId,
      orderTotal: item.total_estimado
    });

    pointsMeta = {
      awarded_points: Number(pointsResult?.awardedPoints || 0),
      points_applied: Boolean(pointsResult?.applied)
    };
  }

  emitWebOrderEvent({
    type: 'order_status_changed',
    orderId: parsedOrderId,
    status,
    webUserId: item.web_usuario_id,
    order: item
  });
  invalidateMyOrdersCacheForUser(item.web_usuario_id);
  invalidateWebAuthProfileCache(item.web_usuario_id);

  return {
    item,
    meta: pointsMeta
  };
}

export async function hideMyWebOrder(webUser, orderId) {
  if (!webUser?.id) {
    throw createServiceError('Usuario web invalido', 401);
  }

  const parsedOrderId = parseOrderId(orderId);

  const order = await getWebOrderById(parsedOrderId);
  if (!order || Number(order.web_usuario_id) !== Number(webUser.id)) {
    throw createServiceError('Pedido no encontrado', 404);
  }

  const normalizedStatus = normalizeWebOrderStatus(order.estado);
  if (!canHideWebOrder(normalizedStatus)) {
    throw createServiceError('Solo podes eliminar pedidos entregados', 409);
  }

  const updated = await hideWebOrderForUser({
    orderId: parsedOrderId,
    webUserId: webUser.id
  });

  if (!updated) {
    throw createServiceError('Pedido no encontrado', 404);
  }

  emitWebOrderEvent({
    type: 'order_hidden_by_user',
    orderId: parsedOrderId,
    status: normalizedStatus,
    webUserId: webUser.id,
    order: {
      ...order,
      cliente_visible: 0
    }
  });
  invalidateMyOrdersCacheForUser(webUser.id);

  return {
    item: {
      id: parsedOrderId,
      hidden: true
    }
  };
}

export async function hideAdminWebOrder(orderId) {
  const parsedOrderId = parseOrderId(orderId);

  const order = await getWebOrderById(parsedOrderId);
  if (!order) {
    throw createServiceError('Pedido no encontrado', 404);
  }

  const normalizedStatus = normalizeWebOrderStatus(order.estado);
  if (!canHideWebOrder(normalizedStatus)) {
    throw createServiceError('Solo podes eliminar pedidos entregados', 409);
  }

  const updated = await hideWebOrderForAdmin({
    orderId: parsedOrderId
  });

  if (!updated) {
    throw createServiceError('Pedido no encontrado', 404);
  }

  emitWebOrderEvent({
    type: 'order_hidden_by_admin',
    orderId: parsedOrderId,
    status: normalizedStatus,
    webUserId: order.web_usuario_id,
    order: {
      ...order,
      admin_visible: 0
    }
  });
  invalidateMyOrdersCacheForUser(order.web_usuario_id);

  return {
    item: {
      id: parsedOrderId,
      hidden: true
    }
  };
}
