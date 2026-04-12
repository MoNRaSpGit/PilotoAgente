import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import {
  assignProductSupplierController,
  createSupplierOrderController,
  createSupplierController,
  getSupplierAgendaController,
  getSupplierOrdersController,
  listSupplierProductsController,
  listSuppliersController
} from '../modules/suppliers/supplier.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/suppliers', requireRole('admin', 'operario'), listSuppliersController);
router.post('/suppliers', requireRole('admin'), createSupplierController);
router.get('/suppliers/:supplierId/products', requireRole('admin', 'operario'), listSupplierProductsController);
router.patch('/products/:productId/supplier', requireRole('admin'), assignProductSupplierController);
router.get('/suppliers/agenda', requireRole('admin', 'operario'), getSupplierAgendaController);
router.get('/suppliers/orders', requireRole('admin', 'operario'), getSupplierOrdersController);
router.post('/suppliers/orders', requireRole('admin', 'operario'), createSupplierOrderController);

export default router;
