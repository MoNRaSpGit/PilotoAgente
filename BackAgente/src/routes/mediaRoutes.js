import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import {
  getMediaStatusController,
  migrateProductImagesController,
  uploadProductImageController
} from '../modules/media/media.controller.js';

const router = Router();

router.get('/media/status', authMiddleware, requireRole('admin'), getMediaStatusController);
router.post('/media/upload/product-image', authMiddleware, requireRole('admin'), uploadProductImageController);
router.post('/media/migrate/products-images', authMiddleware, requireRole('admin'), migrateProductImagesController);

export default router;
