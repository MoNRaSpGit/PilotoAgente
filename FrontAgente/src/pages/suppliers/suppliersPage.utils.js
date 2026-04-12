export const DAY_NAME_BY_INDEX = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado'
];

export const DAY_ALIAS_TO_SPANISH = {
  monday: 'lunes',
  martes: 'martes',
  tuesday: 'martes',
  miercoles: 'miercoles',
  'miercoles': 'miercoles',
  wednesday: 'miercoles',
  thursday: 'jueves',
  jueves: 'jueves',
  friday: 'viernes',
  viernes: 'viernes',
  saturday: 'sabado',
  sabado: 'sabado',
  'sabado': 'sabado',
  sunday: 'domingo',
  domingo: 'domingo',
  lunes: 'lunes'
};

export const INITIAL_SUPPLIERS_AGENDA = (today) => ({
  selected_date: today,
  today: {
    total_amount: 0,
    items: []
  },
  week: []
});

export const INITIAL_SUPPLIER_ORDER_FORM = {
  supplier_id: '',
  expected_amount: '',
  delivery_date: '',
  notes: ''
};

export function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export function normalizeISODate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

export function addDays(dateString, deltaDays) {
  const baseDate = new Date(`${normalizeISODate(dateString)}T00:00:00Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + deltaDays);
  return baseDate.toISOString().slice(0, 10);
}

export function formatDateShort(dateString) {
  const date = new Date(`${normalizeISODate(dateString)}T00:00:00Z`);
  return date.toLocaleDateString('es-UY', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit'
  });
}

export function normalizeDayToken(value) {
  const token = String(value || '').trim().toLowerCase();
  if (!token) {
    return '';
  }

  return DAY_ALIAS_TO_SPANISH[token] || token;
}

export function parseCsvDays(csv) {
  return String(csv || '')
    .split(',')
    .map((entry) => normalizeDayToken(entry))
    .filter(Boolean);
}

export function getSpanishDayName(dateString) {
  const date = new Date(`${normalizeISODate(dateString)}T00:00:00Z`);
  return DAY_NAME_BY_INDEX[date.getUTCDay()] || '';
}
