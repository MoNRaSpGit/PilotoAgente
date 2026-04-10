import {
  createExpense,
  deactivateExpense,
  getExpenseSummary,
  listExpenses,
  updateExpense
} from './gastos.repository.js';

function createServiceError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function fetchExpenses() {
  return listExpenses();
}

export async function fetchExpensesSummary() {
  return getExpenseSummary();
}

export async function addExpense(payload) {
  const item = await createExpense(payload);
  return { item };
}

export async function editExpense(expenseId, payload) {
  if (!expenseId) {
    throw createServiceError('Gasto inválido', 400);
  }

  const item = await updateExpense(expenseId, payload);
  return { item };
}

export async function archiveExpense(expenseId) {
  if (!expenseId) {
    throw createServiceError('Gasto inválido', 400);
  }

  const item = await deactivateExpense(expenseId);
  return { item };
}
