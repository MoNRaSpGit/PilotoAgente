import { pool } from '../../config/db.js';

const EXPENSE_COLUMNS = `
  id,
  name,
  amount,
  frequency,
  scope,
  active,
  notes,
  DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
  DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
`;

const DEFAULT_EXPENSES = [
  { name: 'Alquiler negocio', amount: 7000, frequency: 'monthly', scope: 'business', notes: 'Gasto fijo negocio' },
  { name: 'Luz negocio', amount: 7000, frequency: 'monthly', scope: 'business', notes: 'Gasto fijo negocio' },
  { name: 'Sueldos', amount: 600, frequency: 'daily', scope: 'business', notes: 'Estimado diario' },
  { name: 'Alquiler hogar', amount: 18000, frequency: 'monthly', scope: 'home', notes: 'Gasto fijo hogar' },
  { name: 'Luz hogar', amount: 2500, frequency: 'monthly', scope: 'home', notes: 'Gasto fijo hogar' },
  { name: 'Agua hogar', amount: 1500, frequency: 'monthly', scope: 'home', notes: 'Gasto fijo hogar' },
  { name: 'Facultad', amount: 16000, frequency: 'monthly', scope: 'home', notes: 'Gasto personal' },
  { name: 'Comida', amount: 10000, frequency: 'monthly', scope: 'home', notes: 'Gasto personal' },
  { name: 'Random', amount: 5000, frequency: 'monthly', scope: 'home', notes: 'Gasto variable' }
];

const EXPENSE_CACHE_TTL_MS = 60 * 1000;
const expenseListCache = { value: null, expiresAt: 0 };
const expenseSummaryCache = { value: null, expiresAt: 0 };

function normalizeExpenseFrequency(value) {
  const frequency = String(value || 'monthly').toLowerCase();

  if (['daily', 'weekly', 'monthly'].includes(frequency)) {
    return frequency;
  }

  return 'monthly';
}

function normalizeExpenseScope(value) {
  const scope = String(value || 'business').toLowerCase();

  if (['business', 'home'].includes(scope)) {
    return scope;
  }

  return 'business';
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calcDailyEquivalent(amount, frequency) {
  const numericAmount = toNumber(amount);

  if (frequency === 'daily') {
    return numericAmount;
  }

  if (frequency === 'weekly') {
    return numericAmount / 7;
  }

  return numericAmount / 30;
}

function calcMonthlyEquivalent(amount, frequency) {
  const numericAmount = toNumber(amount);

  if (frequency === 'daily') {
    return numericAmount * 30;
  }

  if (frequency === 'weekly') {
    return numericAmount * (52 / 12);
  }

  return numericAmount;
}

function toExpenseViewModel(row) {
  if (!row) {
    return null;
  }

  const amount = toNumber(row.amount);
  const frequency = normalizeExpenseFrequency(row.frequency);
  const scope = normalizeExpenseScope(row.scope);
  const dailyEquivalent = Number(calcDailyEquivalent(amount, frequency).toFixed(2));
  const monthlyEquivalent = Number(calcMonthlyEquivalent(amount, frequency).toFixed(2));

  return {
    ...row,
    amount,
    frequency,
    scope,
    active: Boolean(Number(row.active)),
    daily_equivalent: dailyEquivalent,
    monthly_equivalent: monthlyEquivalent
  };
}

function buildExpenseSummary(items = []) {
  return items.reduce(
    (accumulator, item) => {
      const daily = toNumber(item.daily_equivalent);
      const monthly = toNumber(item.monthly_equivalent);
      const scope = item.scope || 'business';

      accumulator.daily_total += daily;
      accumulator.monthly_total += monthly;

      if (scope === 'home') {
        accumulator.home_daily_total += daily;
        accumulator.home_monthly_total += monthly;
      } else {
        accumulator.business_daily_total += daily;
        accumulator.business_monthly_total += monthly;
      }

      return accumulator;
    },
    {
      daily_total: 0,
      monthly_total: 0,
      business_daily_total: 0,
      business_monthly_total: 0,
      home_daily_total: 0,
      home_monthly_total: 0
    }
  );
}

function isCacheValid(cacheEntry) {
  return cacheEntry.value && cacheEntry.expiresAt > Date.now();
}

function setExpenseCache(cacheEntry, value) {
  cacheEntry.value = value;
  cacheEntry.expiresAt = Date.now() + EXPENSE_CACHE_TTL_MS;
}

function invalidateExpenseCache() {
  expenseListCache.value = null;
  expenseListCache.expiresAt = 0;
  expenseSummaryCache.value = null;
  expenseSummaryCache.expiresAt = 0;
}

export async function ensureExpenseTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ops_gastos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
      scope VARCHAR(20) NOT NULL DEFAULT 'business',
      active TINYINT(1) NOT NULL DEFAULT 1,
      notes VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_gastos_active_scope (active, scope),
      INDEX idx_gastos_frequency (frequency)
    )
  `);

  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM ops_gastos');

  if (Number(rows[0]?.total || 0) === 0) {
    await pool.query(
      `
        INSERT INTO ops_gastos (name, amount, frequency, scope, notes)
        VALUES ?
      `,
      [
        DEFAULT_EXPENSES.map((expense) => [
          expense.name,
          expense.amount,
          expense.frequency,
          expense.scope,
          expense.notes
        ])
      ]
    );
  }
}

export async function listExpenses() {
  if (isCacheValid(expenseListCache)) {
    return expenseListCache.value;
  }

  await ensureExpenseTables();

  const [rows] = await pool.query(
    `
      SELECT ${EXPENSE_COLUMNS}
      FROM ops_gastos
      ORDER BY active DESC, scope ASC, frequency ASC, name ASC, id DESC
    `
  );

  const items = rows.map(toExpenseViewModel);
  setExpenseCache(expenseListCache, items);
  return items;
}

export async function getExpenseSummary() {
  if (isCacheValid(expenseSummaryCache)) {
    return expenseSummaryCache.value;
  }

  await ensureExpenseTables();

  const [rows] = await pool.query(
    `
      SELECT ${EXPENSE_COLUMNS}
      FROM ops_gastos
      WHERE active = 1
      ORDER BY scope ASC, frequency ASC, name ASC, id DESC
    `
  );

  const items = rows.map(toExpenseViewModel);
  const totals = buildExpenseSummary(items);
  const result = {
    items,
    totals
  };

  setExpenseCache(expenseSummaryCache, result);

  return result;
}

function validateExpensePayload(payload = {}) {
  const name = String(payload?.name || '').trim();
  const amount = Number(payload?.amount ?? 0);
  const frequency = normalizeExpenseFrequency(payload?.frequency);
  const scope = normalizeExpenseScope(payload?.scope);
  const notes = String(payload?.notes || '').trim();
  const active = payload?.active === undefined ? true : Boolean(payload.active);

  if (!name) {
    const error = new Error('El nombre del gasto es requerido');
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error('El monto del gasto es requerido');
    error.status = 400;
    throw error;
  }

  return {
    name,
    amount: Number(amount.toFixed(2)),
    frequency,
    scope,
    notes: notes || null,
    active
  };
}

export async function createExpense(payload) {
  await ensureExpenseTables();

  const data = validateExpensePayload(payload);
  const [result] = await pool.query(
    `
      INSERT INTO ops_gastos (name, amount, frequency, scope, active, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [data.name, data.amount, data.frequency, data.scope, data.active ? 1 : 0, data.notes]
  );

  const [rows] = await pool.query(
    `
      SELECT ${EXPENSE_COLUMNS}
      FROM ops_gastos
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  invalidateExpenseCache();
  return toExpenseViewModel(rows[0] || null);
}

export async function updateExpense(expenseId, payload) {
  await ensureExpenseTables();

  const [existingRows] = await pool.query(
    `
      SELECT ${EXPENSE_COLUMNS}
      FROM ops_gastos
      WHERE id = ?
      LIMIT 1
    `,
    [expenseId]
  );

  const existing = existingRows[0];

  if (!existing) {
    const error = new Error('No se encontró el gasto');
    error.status = 404;
    throw error;
  }

  const next = validateExpensePayload({
    name: payload?.name ?? existing.name,
    amount: payload?.amount ?? existing.amount,
    frequency: payload?.frequency ?? existing.frequency,
    scope: payload?.scope ?? existing.scope,
    notes: payload?.notes ?? existing.notes,
    active: payload?.active ?? existing.active
  });

  await pool.query(
    `
      UPDATE ops_gastos
      SET name = ?,
          amount = ?,
          frequency = ?,
          scope = ?,
          active = ?,
          notes = ?
      WHERE id = ?
    `,
    [next.name, next.amount, next.frequency, next.scope, next.active ? 1 : 0, next.notes, expenseId]
  );

  invalidateExpenseCache();
  const [rows] = await pool.query(
    `
      SELECT ${EXPENSE_COLUMNS}
      FROM ops_gastos
      WHERE id = ?
      LIMIT 1
    `,
    [expenseId]
  );

  return toExpenseViewModel(rows[0] || null);
}

export async function deactivateExpense(expenseId) {
  await ensureExpenseTables();

  await pool.query(
    `
      UPDATE ops_gastos
      SET active = 0
      WHERE id = ?
    `,
    [expenseId]
  );

  invalidateExpenseCache();
  const [rows] = await pool.query(
    `
      SELECT ${EXPENSE_COLUMNS}
      FROM ops_gastos
      WHERE id = ?
      LIMIT 1
    `,
    [expenseId]
  );

  return toExpenseViewModel(rows[0] || null);
}
