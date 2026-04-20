import {
  createWebOrder,
  findProductsForWebOrderItems,
  getWebOrderById,
  listPendingWebOrders,
  listWebOrdersByUserId,
  updateWebOrderStatus
} from './webOrders.repository.js';
import { registerWebOrderMetrics } from '../webUsers/webUsers.repository.js';
import { env } from '../../config/env.js';

const ALLOWED_STATUSES = new Set([
  'nuevo',
  'visto',
  'preparando',
  'listo_para_cobrar',
  'cobrado_en_scanner',
  'cancelado'
]);

function createServiceError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function calculateWebOrderPoints(orderTotal) {
  if (!env.webPointsEnabled) {
    return 0;
  }

  const stepAmount = Number(env.webPointsStepAmount || 0);
  const pointsPerStep = Number(env.webPointsPerStep || 0);

  if (stepAmount <= 0 || pointsPerStep <= 0) {
    return 0;
  }

  const steps = Math.floor(Number(orderTotal || 0) / stepAmount);
  return Math.max(0, steps * Math.floor(pointsPerStep));
}

export async function createOrderFromWebUser(webUser, payload = {}) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const notes = String(payload?.notes || '').trim();

  if (!webUser?.id) {
    throw createServiceError('Usuario web invalido', 401);
  }

  if (items.length === 0) {
    throw createServiceError('El pedido debe incluir al menos un producto', 400);
  }

  const normalizedItems = items.map((item) => ({
    product_id: Number(item?.product_id ?? item?.productId),
    quantity: Math.max(1, Math.floor(Number(item?.quantity) || 1))
  }));

  const hasInvalidProductId = normalizedItems.some((item) => !Number.isFinite(item.product_id) || item.product_id <= 0);

  if (hasInvalidProductId) {
    throw createServiceError('Hay productos invalidos en el pedido', 400);
  }

  const productIds = [...new Set(normalizedItems.map((item) => item.product_id))];
  const products = await findProductsForWebOrderItems(productIds);
  const productMap = new Map(products.map((product) => [Number(product.id), product]));

  const resolvedItems = normalizedItems.map((item) => {
    const product = productMap.get(item.product_id);

    if (!product || product.estado !== 'activo') {
      throw createServiceError(`Producto no disponible: ${item.product_id}`, 409);
    }

    return {
      product_id: item.product_id,
      product_name: product.nombre,
      quantity: item.quantity,
      unit_price: Number(product.precio_venta || 0)
    };
  });

  const orderId = await createWebOrder({
    webUserId: webUser.id,
    items: resolvedItems,
    notes: notes || null
  });

  const item = await getWebOrderById(orderId);
  const awardedPoints = calculateWebOrderPoints(item?.total_estimado || 0);

  await registerWebOrderMetrics({
    webUserId: webUser.id,
    orderId,
    orderTotal: item?.total_estimado || 0,
    awardedPoints
  });

  return {
    item,
    meta: {
      notification_text: `${webUser.nombre} te hizo un pedido`,
      awarded_points: awardedPoints
    }
  };
}

export async function listMyWebOrders(webUser, query = {}) {
  if (!webUser?.id) {
    throw createServiceError('Usuario web invalido', 401);
  }

  const items = await listWebOrdersByUserId(webUser.id, {
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
  const parsedOrderId = Number(orderId);
  const status = String(payload?.status || '').trim();

  if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
    throw createServiceError('Pedido invalido', 400);
  }

  if (!ALLOWED_STATUSES.has(status)) {
    throw createServiceError('Estado de pedido invalido', 400);
  }

  const item = await updateWebOrderStatus({
    orderId: parsedOrderId,
    status
  });

  if (!item) {
    throw createServiceError('Pedido no encontrado', 404);
  }

  return { item };
}
