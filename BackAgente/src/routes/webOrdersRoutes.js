import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import { webAuthMiddleware } from '../modules/webAuth/webAuth.middleware.js';
import {
  changeWebOrderStatusController,
  createWebOrderController,
  listAdminIncomingWebOrdersController,
  listMyWebOrdersController
} from '../modules/webOrders/webOrders.controller.js';

const router = Router();

router.post('/web/orders', webAuthMiddleware, createWebOrderController);
router.get('/web/orders/mine', webAuthMiddleware, listMyWebOrdersController);

router.get('/web/admin/orders', authMiddleware, requireRole('admin'), listAdminIncomingWebOrdersController);
router.patch('/web/admin/orders/:orderId/status', authMiddleware, requireRole('admin'), changeWebOrderStatusController);

export default router;