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

router.use(authMiddleware, requireRole('admin'));

router.get('/clients', listClientsController);
router.get('/clients/:id/history', listClientHistoryController);
router.post('/clients', createClientController);
router.patch('/clients/:id/delivery', updateClientDeliveryController);
router.patch('/clients/:id/charge', updateClientChargeController);
router.patch('/clients/:id/payment', updateClientPaymentController);

export default router;
