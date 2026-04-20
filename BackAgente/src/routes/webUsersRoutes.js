import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import { webAuthMiddleware } from '../modules/webAuth/webAuth.middleware.js';
import {
  getAdminUserDetailController,
  getAdminUsersSummaryController,
  getWebMyProfileController,
  listAdminUsersController
} from '../modules/webUsers/webUsers.controller.js';

const router = Router();

router.get('/web/users/me/profile', webAuthMiddleware, getWebMyProfileController);

router.get('/web/admin/users/summary', authMiddleware, requireRole('admin'), getAdminUsersSummaryController);
router.get('/web/admin/users', authMiddleware, requireRole('admin'), listAdminUsersController);
router.get('/web/admin/users/:webUserId', authMiddleware, requireRole('admin'), getAdminUserDetailController);

export default router;