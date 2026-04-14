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
router.post('/gastos', requireRole('admin'), createExpenseController);
router.patch('/gastos/:id', requireRole('admin'), updateExpenseController);
router.delete('/gastos/:id', requireRole('admin'), deleteExpenseController);

export default router;
