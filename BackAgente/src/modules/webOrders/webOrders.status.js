export const ALLOWED_WEB_ORDER_STATUSES = new Set([
  'pendiente',
  'en_proceso',
  'listo',
  'nuevo',
  'visto',
  'preparando',
  'listo_para_cobrar',
  'entregado',
  'cobrado_en_scanner',
  'cancelado'
]);

export function normalizeWebOrderStatus(status) {
  const rawStatus = String(status || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-\s]+/g, '_');
  if (!rawStatus) {
    return '';
  }

  if (rawStatus === 'nuevo' || rawStatus === 'visto') {
    return 'pendiente';
  }
  if (rawStatus === 'preparando' || rawStatus === 'en_proceso') {
    return 'en_proceso';
  }
  if (rawStatus === 'listo_para_cobrar' || rawStatus === 'listo') {
    return 'listo';
  }
  if (rawStatus === 'entregado') {
    return 'entregado';
  }

  return rawStatus;
}

export function canHideWebOrder(status) {
  return normalizeWebOrderStatus(status) === 'entregado';
}
