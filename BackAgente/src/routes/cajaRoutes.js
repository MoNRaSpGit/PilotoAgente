import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import {
  addCashboxPaymentController,
  addCashboxSaleController,
  closeCashboxController,
  cashboxStreamController,
  getCashboxMovementsController,
  getCashboxObjectivesController,
  getScannerLiveStateController,
  getCashboxSummaryController,
  openCashboxController,
  syncScannerLiveStateController
} from '../modules/caja/caja.controller.js';
import { getCashboxRankingController } from '../modules/ranking/ranking.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/caja/stream', requireRole('admin', 'operario'), cashboxStreamController);
router.get('/caja/live-state', requireRole('admin', 'operario'), getScannerLiveStateController);
router.post('/caja/live-state', requireRole('admin', 'operario'), syncScannerLiveStateController);
router.get('/caja/objetivos', requireRole('admin', 'operario'), getCashboxObjectivesController);
router.get('/caja', requireRole('admin'), getCashboxSummaryController);
router.get('/caja/movements', requireRole('admin'), getCashboxMovementsController);
router.get('/caja/ranking', requireRole('admin'), getCashboxRankingController);
router.post('/caja/open', requireRole('admin'), openCashboxController);
router.post('/caja/close', requireRole('admin'), closeCashboxController);
router.post('/caja/payments', requireRole('admin'), addCashboxPaymentController);
router.post('/caja/sales', requireRole('admin', 'operario'), addCashboxSaleController);

export default router;
