export function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export function frequencyLabel(value) {
  if (value === 'daily') return 'Diario';
  if (value === 'weekly') return 'Semanal';
  return 'Mensual';
}

export const EMPTY_EXPENSE_FORM = {
  name: '',
  amount: '',
  frequency: 'monthly',
  scope: 'business',
  notes: '',
  active: true
};

export const EMPTY_EXPENSE_SUMMARY = {
  totals: {
    daily_total: 0,
    monthly_total: 0,
    business_daily_total: 0,
    business_monthly_total: 0,
    home_daily_total: 0,
    home_monthly_total: 0
  }
};

export function sanitizeAmountInput(value) {
  return String(value || '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
}
