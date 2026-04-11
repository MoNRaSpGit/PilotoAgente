import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import {
  createManualProductController,
  scanProductController,
  updateProductController
} from '../modules/products/product.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/products/scan/:barcode', requireRole('admin', 'operario'), scanProductController);
router.post('/products/manual-from-scan', requireRole('admin', 'operario'), createManualProductController);
router.patch('/products/:productId', requireRole('admin', 'operario'), updateProductController);

export default router;
