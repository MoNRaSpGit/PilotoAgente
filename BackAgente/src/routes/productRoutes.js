import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import {
  createManualProductController,
  scanProductController
} from '../modules/products/product.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/products/scan/:barcode', requireRole('admin', 'operario'), scanProductController);
router.post('/products/manual-from-scan', requireRole('admin', 'operario'), createManualProductController);

export default router;
