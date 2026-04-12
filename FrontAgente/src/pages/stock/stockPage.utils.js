export const WEEK_DAYS = [
  { value: 'monday', label: 'Lun' },
  { value: 'tuesday', label: 'Mar' },
  { value: 'wednesday', label: 'Mie' },
  { value: 'thursday', label: 'Jue' },
  { value: 'friday', label: 'Vie' },
  { value: 'saturday', label: 'Sab' },
  { value: 'sunday', label: 'Dom' }
];

export const INITIAL_STOCK_DASHBOARD = {
  items: [],
  expected_today: [],
  totals: {
    tracked: 0,
    alerts: 0,
    critical: 0,
    warning: 0
  }
};

export const INITIAL_STOCK_CONTROL_FORM = {
  product_id: '',
  supplier_name: '',
  delivery_days: ['tuesday', 'friday'],
  order_days: ['monday', 'thursday'],
  critical_threshold: '1',
  warning_threshold: '4',
  target_leftover: '2'
};

export const INITIAL_STOCK_ENTRY_FORM = {
  stock_control_id: '',
  quantity: '',
  notes: ''
};

export function statusLabel(value) {
  if (value === 'critical') {
    return 'Rojo';
  }

  if (value === 'warning') {
    return 'Amarillo';
  }

  return 'Ok';
}

export function buildAvailableControls(controls = [], expectedToday = []) {
  const todayIds = new Set((Array.isArray(expectedToday) ? expectedToday : []).map((item) => item.id));
  return [...(Array.isArray(controls) ? controls : [])].sort((a, b) => {
    const aToday = todayIds.has(a.id) ? 1 : 0;
    const bToday = todayIds.has(b.id) ? 1 : 0;

    if (aToday !== bToday) {
      return bToday - aToday;
    }

    return String(a.product?.name || '').localeCompare(String(b.product?.name || ''));
  });
}
