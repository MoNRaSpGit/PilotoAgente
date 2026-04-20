import { Router } from 'express';
import { getWebInactiveProductsController, getWebProductsController } from '../modules/web/web.controller.js';

const router = Router();

router.get('/web/products', getWebProductsController);
router.get('/web/products/inactive', getWebInactiveProductsController);

export default router;
