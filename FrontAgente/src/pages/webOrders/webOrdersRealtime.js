export function normalizeWebOrderStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-\s]+/g, '_');

  if (!normalized) {
    return 'pendiente';
  }
  if (normalized === 'nuevo' || normalized === 'visto') {
    return 'pendiente';
  }
  if (normalized === 'preparando') {
    return 'en_proceso';
  }
  if (normalized === 'listo_para_cobrar') {
    return 'listo';
  }
  return normalized;
}

const ADMIN_ACTIVE_STATUSES = new Set(['pendiente', 'en_proceso', 'listo', 'entregado']);

export function isAdminOrderVisible(order) {
  const status = normalizeWebOrderStatus(order?.estado);
  const adminVisible = Number(order?.admin_visible ?? 1) === 1;
  return adminVisible && ADMIN_ACTIVE_STATUSES.has(status);
}

export function applyAdminWebOrderEvent(currentOrders, payload) {
  const list = Array.isArray(currentOrders) ? currentOrders : [];
  const order = payload?.order || null;
  const eventType = String(payload?.type || '');
  const eventOrderId = Number(payload?.order_id || order?.id || 0);

  if (!eventOrderId) {
    return list;
  }

  if (!order) {
    if (eventType === 'order_hidden_by_admin') {
      return list.filter((item) => Number(item.id) !== eventOrderId);
    }
    return list;
  }

  const normalizedOrder = {
    ...order,
    id: Number(order.id),
    estado: normalizeWebOrderStatus(order.estado)
  };

  const visible = isAdminOrderVisible(normalizedOrder);
  const index = list.findIndex((item) => Number(item.id) === normalizedOrder.id);

  if (!visible) {
    if (index < 0) {
      return list;
    }
    const next = [...list];
    next.splice(index, 1);
    return next;
  }

  if (index < 0) {
    return [normalizedOrder, ...list];
  }

  const next = [...list];
  next[index] = {
    ...next[index],
    ...normalizedOrder
  };
  return next;
}
