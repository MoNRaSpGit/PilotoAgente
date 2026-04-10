import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import {
  createManualProductController,
  scanProductController
} from '../modules/products/product.controller.js';

const router = Router();

router.use(authMiddleware);

if (process.env.NODE_ENV !== 'production') {
  console.log('[routes:products] scanner routes loaded', {
    scan: '/products/scan/:barcode',
    manual: '/products/manual-from-scan',
    allowedRoles: ['admin', 'operario']
  });
}

router.get('/products/scan/:barcode', requireRole('admin', 'operario'), scanProductController);
router.post('/products/manual-from-scan', requireRole('admin', 'operario'), createManualProductController);

export default router;
