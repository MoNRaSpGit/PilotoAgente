import { Router } from 'express';
import {
  createManualProductController,
  listProductsController,
  scanProductController
} from '../modules/products/product.controller.js';

const router = Router();

router.get('/products', listProductsController);
router.get('/products/scan/:barcode', scanProductController);
router.post('/products/manual-from-scan', createManualProductController);

export default router;
