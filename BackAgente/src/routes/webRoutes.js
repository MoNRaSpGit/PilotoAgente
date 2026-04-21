import { Router } from 'express';
import { webAuthMiddleware } from '../modules/webAuth/webAuth.middleware.js';
import { requireWebRole } from '../modules/webAuth/webAuth.role.middleware.js';
import { sendWebWhatsappTestController } from '../modules/webNotifications/webWhatsapp.controller.js';
import {
  getWebCategoriesController,
  getWebAdminProductByIdController,
  getWebInactiveProductsController,
  getWebProductImageController,
  getWebProductsController,
  updateWebAdminProductController
} from '../modules/web/web.controller.js';

const router = Router();

router.get('/web/products', getWebProductsController);
router.get('/web/products/inactive', getWebInactiveProductsController);
router.get('/web/products/:productId/image', getWebProductImageController);
router.get('/web/categories', getWebCategoriesController);
router.get('/web/admin/products/:productId', webAuthMiddleware, requireWebRole('admin'), getWebAdminProductByIdController);
router.patch('/web/admin/products/:productId', webAuthMiddleware, requireWebRole('admin'), updateWebAdminProductController);
router.post('/web/admin/notifications/whatsapp/test', webAuthMiddleware, requireWebRole('admin'), sendWebWhatsappTestController);

export default router;
