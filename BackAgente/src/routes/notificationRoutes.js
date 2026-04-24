import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import {
  getPushPublicConfigController,
  registerPushSubscriptionController,
  unregisterPushSubscriptionController
} from '../modules/notifications/notifications.controller.js';

const router = Router();

router.get('/notifications/push/public-key', authMiddleware, requireRole('admin', 'operario'), getPushPublicConfigController);
router.post('/notifications/push/subscribe', authMiddleware, requireRole('admin', 'operario'), registerPushSubscriptionController);
router.post('/notifications/push/unsubscribe', authMiddleware, requireRole('admin', 'operario'), unregisterPushSubscriptionController);

export default router;
