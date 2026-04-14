import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import {
  createClientController,
  listClientHistoryController,
  listClientsController,
  updateClientChargeController,
  updateClientDeliveryController,
  updateClientPaymentController
} from '../modules/clients/client.controller.js';

const router = Router();

router.get('/clients', authMiddleware, requireRole('admin'), listClientsController);
router.get('/clients/:id/history', authMiddleware, requireRole('admin'), listClientHistoryController);
router.post('/clients', authMiddleware, requireRole('admin'), createClientController);
router.patch('/clients/:id/delivery', authMiddleware, requireRole('admin'), updateClientDeliveryController);
router.patch('/clients/:id/charge', authMiddleware, requireRole('admin'), updateClientChargeController);
router.patch('/clients/:id/payment', authMiddleware, requireRole('admin'), updateClientPaymentController);

export default router;
