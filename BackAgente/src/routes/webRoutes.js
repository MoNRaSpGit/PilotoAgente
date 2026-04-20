import { Router } from 'express';
import {
  getWebCategoriesController,
  getWebInactiveProductsController,
  getWebProductImageController,
  getWebProductsController
} from '../modules/web/web.controller.js';

const router = Router();

router.get('/web/products', getWebProductsController);
router.get('/web/products/inactive', getWebInactiveProductsController);
router.get('/web/products/:productId/image', getWebProductImageController);
router.get('/web/categories', getWebCategoriesController);

export default router;
