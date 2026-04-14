import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import {
  assignProductSupplierController,
  createSupplierOrderController,
  createSupplierController,
  upsertSupplierOrderFromProviderController,
  getSupplierAgendaController,
  getSupplierOrderDetailController,
  getSupplierOrdersController,
  listSupplierProductsController,
  listSuppliersController,
  receiveSupplierOrderController
} from '../modules/suppliers/supplier.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/suppliers', requireRole('admin'), listSuppliersController);
router.post('/suppliers', requireRole('admin'), createSupplierController);
router.get('/suppliers/:supplierId/products', requireRole('admin'), listSupplierProductsController);
router.patch('/products/:productId/supplier', requireRole('admin'), assignProductSupplierController);
router.get('/suppliers/agenda', requireRole('admin'), getSupplierAgendaController);
router.get('/suppliers/orders', requireRole('admin'), getSupplierOrdersController);
router.get('/suppliers/orders/:orderId', requireRole('admin'), getSupplierOrderDetailController);
router.post('/suppliers/orders', requireRole('admin'), createSupplierOrderController);
router.post('/suppliers/orders/upsert-from-provider', requireRole('admin'), upsertSupplierOrderFromProviderController);
router.post('/suppliers/orders/:orderId/receive', requireRole('admin'), receiveSupplierOrderController);

export default router;
