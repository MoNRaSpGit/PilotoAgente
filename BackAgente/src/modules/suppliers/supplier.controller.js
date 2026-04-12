import {
  createSupplierRecord,
  fetchRecentSupplierOrders,
  fetchSupplierAgenda,
  fetchProductsFromSupplier,
  fetchSuppliers,
  linkSupplierToProduct,
  registerSupplierOrder
} from './supplier.service.js';

function handleServiceError(res, error, fallbackMessage) {
  const status = error.status || 500;
  return res.status(status).json({
    message: error.message || fallbackMessage,
    ...(error.item ? { item: error.item } : {})
  });
}

export async function listSuppliersController(_req, res) {
  try {
    const data = await fetchSuppliers();
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudieron obtener proveedores');
  }
}

export async function createSupplierController(req, res) {
  try {
    const data = await createSupplierRecord(req.body);
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo crear el proveedor');
  }
}

export async function assignProductSupplierController(req, res) {
  try {
    const data = await linkSupplierToProduct({
      productId: req.params.productId,
      supplierId: req.body?.supplier_id
    });
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo vincular proveedor a producto');
  }
}

export async function listSupplierProductsController(req, res) {
  try {
    const data = await fetchProductsFromSupplier(req.params.supplierId);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo obtener productos del proveedor');
  }
}

export async function createSupplierOrderController(req, res) {
  try {
    const data = await registerSupplierOrder(req.body, req.user);
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo registrar el pedido al proveedor');
  }
}

export async function getSupplierAgendaController(req, res) {
  try {
    const data = await fetchSupplierAgenda(req.query);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo cargar la agenda de proveedores');
  }
}

export async function getSupplierOrdersController(req, res) {
  try {
    const data = await fetchRecentSupplierOrders(req.query);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo cargar pedidos de proveedores');
  }
}
