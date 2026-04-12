const BUSINESS_TIMEZONE = 'America/Montevideo';

function getBusinessDateParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return null;
  }

  return { year, month, day };
}

export function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export function trendClass(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'is-neutral';
  }

  const next = Number(value);

  if (next > 0) {
    return 'is-positive';
  }

  if (next < 0) {
    return 'is-negative';
  }

  return 'is-neutral';
}

export function trendLabel(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'Sin referencia';
  }

  const next = Number(value);
  const sign = next > 0 ? '+' : '';
  return `${sign}${next.toFixed(2)}%`;
}

export function todayDate() {
  const parts = getBusinessDateParts(new Date());

  if (!parts) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function yesterdayDate() {
  const today = todayDate();
  const baseDate = new Date(`${today}T00:00:00`);
  baseDate.setDate(baseDate.getDate() - 1);
  const parts = getBusinessDateParts(baseDate);

  if (!parts) {
    return baseDate.toISOString().slice(0, 10);
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatShortDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return todayDate();
  }

  return date.toLocaleDateString('es-UY', {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function metricValue(current, previous) {
  return `${money(current)} - ${money(previous)}`;
}

export function formatLongDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Hoy';
  }

  return date.toLocaleDateString('es-UY', {
    timeZone: BUSINESS_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

function parseApiDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();

  if (!raw) {
    return null;
  }

  const hasTimezone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const iso = hasTimezone ? normalized : `${normalized}Z`;
  const parsed = new Date(iso);
  const isValid = !Number.isNaN(parsed.getTime());

  return isValid ? parsed : null;
}

export function formatClock(value) {
  const date = parseApiDate(value);

  if (!date) {
    return 'Ahora';
  }

  return date.toLocaleTimeString('es-UY', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function formatDateTime(value) {
  const date = parseApiDate(value);

  if (!date) {
    return 'Ahora';
  }

  const day = date.toLocaleDateString('es-UY', {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const time = date.toLocaleTimeString('es-UY', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return `${day} · ${time}`;
}

function getScannerIdleMinutes(updatedAt, now = new Date()) {
  const updatedAtDate = parseApiDate(updatedAt);
  const updatedAtMs = updatedAtDate?.getTime() || Number.NaN;
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

  if (Number.isNaN(updatedAtMs) || Number.isNaN(nowMs)) {
    return null;
  }

  return Math.max(0, (nowMs - updatedAtMs) / 60000);
}

function normalizeLiveSale(payload) {
  const items = Array.isArray(payload?.items)
    ? payload.items.map((item) => ({
        barcode: item.barcode || null,
        name: item.product_name || item.name || 'Producto',
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unit_price || item.price || 0),
        total: Number(item.total || 0)
      }))
    : [];

  return {
    id: payload?.movement_id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: payload?.type || 'sale',
    amount: Number(payload?.amount || 0),
    description: payload?.description || (payload?.type === 'payment' ? 'Pago registrado' : 'Venta desde escaner'),
    source: payload?.source || 'scanner',
    operatorName: payload?.operator?.name || payload?.operator_name || 'Operario',
    operatorRole: payload?.operator?.role || payload?.operator_role || null,
    items,
    createdAt: payload?.created_at || payload?.createdAt || new Date().toISOString()
  };
}

export function normalizeRecentMovements(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((payload) => normalizeLiveSale({
    movement_id: payload?.movement_id || payload?.id,
    type: payload?.type,
    amount: payload?.amount,
    description: payload?.description,
    source: payload?.source,
    operator: payload?.operator || {
      name: payload?.operator_name,
      role: payload?.operator_role
    },
    items: payload?.items,
    created_at: payload?.created_at
  }));
}

function resolveProductImage(imageValue) {
  if (!imageValue) {
    return '';
  }

  if (
    imageValue.startsWith('http://') ||
    imageValue.startsWith('https://') ||
    imageValue.startsWith('data:image/')
  ) {
    return imageValue;
  }

  return `data:image/jpeg;base64,${imageValue}`;
}

export function normalizeRankingItems(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => ({
    rank: Number(item?.rank || index + 1),
    productName: item?.product_name || 'Producto',
    barcode: item?.barcode || null,
    totalQuantity: Number(item?.total_quantity || 0),
    imageUrl: resolveProductImage(item?.product_image),
    hasImage: Boolean(item?.has_image && item?.product_image)
  }));
}

export function formatMovementAmount(value, type = 'sale') {
  const formatted = money(value);
  return type === 'payment' ? `- ${formatted}` : `+ ${formatted}`;
}

export function getScannerStatusBadge(updatedAt, hasItems, now = new Date()) {
  const idleMinutes = getScannerIdleMinutes(updatedAt, now);

  if (idleMinutes === null && hasItems) {
    return { label: 'Activo', bg: 'success', text: 'light', tone: 'active' };
  }

  if (idleMinutes !== null && idleMinutes < 5) {
    return { label: 'Activo', bg: 'success', text: 'light', tone: 'active' };
  }

  return { label: 'Inactivo', bg: 'secondary', text: 'light', tone: 'idle' };
}

