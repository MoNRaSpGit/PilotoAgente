import {
  addExpense,
  archiveExpense,
  editExpense,
  fetchExpenses,
  fetchExpensesSummary
} from './gastos.service.js';

function handleServiceError(res, error, fallbackMessage) {
  return res.status(error.status || 500).json({
    message: error.message || fallbackMessage,
    ...(error.item ? { item: error.item } : {})
  });
}

export async function listExpensesController(_req, res) {
  try {
    const items = await fetchExpenses();
    return res.json({ items });
  } catch (error) {
    return handleServiceError(res, error, 'No se pudieron obtener los gastos');
  }
}

export async function summaryExpensesController(_req, res) {
  try {
    const data = await fetchExpensesSummary();
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo obtener el resumen de gastos');
  }
}

export async function createExpenseController(req, res) {
  try {
    const data = await addExpense(req.body);
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo crear el gasto');
  }
}

export async function updateExpenseController(req, res) {
  try {
    const data = await editExpense(req.params.id, req.body);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo actualizar el gasto');
  }
}

export async function deleteExpenseController(req, res) {
  try {
    const data = await archiveExpense(req.params.id);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo desactivar el gasto');
  }
}
