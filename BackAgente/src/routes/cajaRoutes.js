import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import {
  addCashboxPaymentController,
  addCashboxSaleController,
  closeCashboxController,
  cashboxStreamController,
  getCashboxSummaryController,
  openCashboxController
} from '../modules/caja/caja.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/caja/stream', requireRole('admin', 'operario'), cashboxStreamController);
router.get('/caja', requireRole('admin'), getCashboxSummaryController);
router.post('/caja/open', requireRole('admin'), openCashboxController);
router.post('/caja/close', requireRole('admin'), closeCashboxController);
router.post('/caja/payments', requireRole('admin'), addCashboxPaymentController);
router.post('/caja/sales', requireRole('admin', 'operario'), addCashboxSaleController);

export default router;
