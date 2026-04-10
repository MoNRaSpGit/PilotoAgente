import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import {
  createExpenseController,
  deleteExpenseController,
  listExpensesController,
  summaryExpensesController,
  updateExpenseController
} from '../modules/gastos/gastos.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/gastos', requireRole('admin', 'operario'), listExpensesController);
router.get('/gastos/summary', requireRole('admin', 'operario'), summaryExpensesController);
router.use(requireRole('admin'));
router.post('/gastos', createExpenseController);
router.patch('/gastos/:id', updateExpenseController);
router.delete('/gastos/:id', deleteExpenseController);

export default router;
