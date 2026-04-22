import { normalizeWebOrderStatus, ALLOWED_WEB_ORDER_STATUSES } from './webOrders.status.js';

function createContractError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizePaymentMethod(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return '';
  }
  if (raw === 'pos' || raw === 'efectivo' || raw === 'cuenta' || raw === 'puntos') {
    return raw;
  }
  return '';
}

function normalizeDeliveryMode(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return '';
  }
  if (raw === 'delivery' || raw === 'pickup') {
    return raw;
  }
  if (raw === 'yo_voy' || raw === 'yo voy' || raw === 'retiro') {
    return 'pickup';
  }
  return '';
}

export function parseOrderId(orderId) {
  const parsedOrderId = Number(orderId);
  if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
    throw createContractError('Pedido invalido', 400);
  }
  return parsedOrderId;
}

export function parseCreateOrderPayload(payload = {}) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const notes = String(payload?.notes || '').trim();
  const paymentMethod = normalizePaymentMethod(payload?.payment_method ?? payload?.paymentMethod);
  const deliveryMode = normalizeDeliveryMode(payload?.delivery_mode ?? payload?.deliveryMode);

  if (items.length === 0) {
    throw createContractError('El pedido debe incluir al menos un producto', 400);
  }
  if (!paymentMethod) {
    throw createContractError('Selecciona un tipo de pago', 400);
  }
  if (!deliveryMode) {
    throw createContractError('Selecciona un tipo de entrega', 400);
  }

  const normalizedItems = items.map((item) => ({
    product_id: Number(item?.product_id ?? item?.productId),
    quantity: Math.max(1, Math.floor(Number(item?.quantity) || 1))
  }));

  const hasInvalidProductId = normalizedItems.some((item) => !Number.isFinite(item.product_id) || item.product_id <= 0);
  if (hasInvalidProductId) {
    throw createContractError('Hay productos invalidos en el pedido', 400);
  }

  return {
    items: normalizedItems,
    notes: notes || null,
    paymentMethod,
    deliveryMode
  };
}

export function parseOrderStatusPayload(payload = {}) {
  const status = normalizeWebOrderStatus(payload?.status || '');
  if (!ALLOWED_WEB_ORDER_STATUSES.has(status)) {
    throw createContractError('Estado de pedido invalido', 400);
  }
  return { status };
}
