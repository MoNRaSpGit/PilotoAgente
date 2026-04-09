import { Router } from 'express';
import {
  createClientController,
  listClientHistoryController,
  listClientsController,
  updateClientChargeController,
  updateClientDeliveryController,
  updateClientPaymentController
} from '../modules/clients/client.controller.js';

const router = Router();

router.get('/clients', listClientsController);
router.get('/clients/:id/history', listClientHistoryController);
router.post('/clients', createClientController);
router.patch('/clients/:id/delivery', updateClientDeliveryController);
router.patch('/clients/:id/charge', updateClientChargeController);
router.patch('/clients/:id/payment', updateClientPaymentController);

export default router;
