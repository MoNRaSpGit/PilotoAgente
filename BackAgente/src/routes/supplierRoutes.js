import { Router } from 'express';
import { authMiddleware, requireRole } from '../modules/auth/auth.middleware.js';
import {
  assignProductSupplierController,
  createSupplierOrderController,
  createSupplierController,
  confirmSupplierPickupController,
  upsertSupplierOrderFromProviderController,
  getSupplierAgendaController,
  getSupplierInvoiceIncidentsController,
  getSupplierOrderDetailController,
  getSupplierOrdersController,
  listUnassignedCriticalSupplierProductsController,
  listSupplierProductsController,
  listSuppliersController,
  receiveSupplierOrderController
} from '../modules/suppliers/supplier.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/suppliers', requireRole('admin', 'operario'), listSuppliersController);
router.get('/suppliers/unassigned-critical-products', requireRole('admin'), listUnassignedCriticalSupplierProductsController);
router.post('/suppliers', requireRole('admin'), createSupplierController);
router.get('/suppliers/:supplierId/products', requireRole('admin', 'operario'), listSupplierProductsController);
router.patch('/products/:productId/supplier', requireRole('admin'), assignProductSupplierController);
router.get('/suppliers/agenda', requireRole('admin', 'operario'), getSupplierAgendaController);
router.get('/suppliers/orders', requireRole('admin', 'operario'), getSupplierOrdersController);
router.get('/suppliers/invoice-incidents', requireRole('admin'), getSupplierInvoiceIncidentsController);
router.get('/suppliers/orders/:orderId', requireRole('admin', 'operario'), getSupplierOrderDetailController);
router.post('/suppliers/orders', requireRole('admin'), createSupplierOrderController);
router.post('/suppliers/orders/upsert-from-provider', requireRole('admin'), upsertSupplierOrderFromProviderController);
router.post('/suppliers/orders/:orderId/confirm-pickup', requireRole('operario'), confirmSupplierPickupController);
router.post('/suppliers/orders/:orderId/receive', requireRole('operario'), receiveSupplierOrderController);

export default router;
