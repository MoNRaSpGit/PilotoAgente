import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import { webAuthMiddleware } from '../modules/webAuth/webAuth.middleware.js';
import {
  changeWebOrderStatusController,
  createWebOrderController,
  hideAdminWebOrderController,
  hideMyWebOrderController,
  listAdminIncomingWebOrdersController,
  listMyWebOrdersController,
  streamAdminWebOrdersController,
  streamMyWebOrdersController
} from '../modules/webOrders/webOrders.controller.js';

const router = Router();

router.post('/web/orders', webAuthMiddleware, createWebOrderController);
router.get('/web/orders/mine', webAuthMiddleware, listMyWebOrdersController);
router.patch('/web/orders/:orderId/hide', webAuthMiddleware, hideMyWebOrderController);
router.get('/web/orders/stream', webAuthMiddleware, streamMyWebOrdersController);

router.get('/web/admin/orders', authMiddleware, requireRole('admin', 'operario'), listAdminIncomingWebOrdersController);
router.patch('/web/admin/orders/:orderId/status', authMiddleware, requireRole('admin', 'operario'), changeWebOrderStatusController);
router.patch('/web/admin/orders/:orderId/hide', authMiddleware, requireRole('admin', 'operario'), hideAdminWebOrderController);
router.get('/web/admin/orders/stream', authMiddleware, requireRole('admin', 'operario'), streamAdminWebOrdersController);

export default router;
