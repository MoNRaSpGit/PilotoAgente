import {
  addSupplierDraftItemFromStock,
  changeSupplierDraftItemQuantity,
  confirmSupplierDraft,
  createSupplierRecord,
  fetchOpenSupplierDrafts,
  fetchSupplierOrderDetail,
  fetchRecentSupplierOrders,
  fetchSupplierAgenda,
  fetchProductsFromSupplier,
  fetchSuppliers,
  linkSupplierToProduct,
  removeSupplierDraftItem,
  receiveSupplierOrder,
  registerSupplierOrder,
  upsertSupplierOrderFromProvider
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

export async function upsertSupplierOrderFromProviderController(req, res) {
  try {
    const data = await upsertSupplierOrderFromProvider(req.body, req.user);
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo guardar pedido desde proveedor');
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

export async function getSupplierOrderDetailController(req, res) {
  try {
    const data = await fetchSupplierOrderDetail(req.params.orderId);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo cargar el detalle del pedido');
  }
}

export async function receiveSupplierOrderController(req, res) {
  try {
    const data = await receiveSupplierOrder(req.params.orderId, req.body, req.user);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo confirmar recepcion del pedido');
  }
}

export async function addSupplierDraftItemFromStockController(req, res) {
  try {
    const data = await addSupplierDraftItemFromStock(req.body, req.user);
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo agregar item al borrador');
  }
}

export async function listOpenSupplierDraftsController(_req, res) {
  try {
    const data = await fetchOpenSupplierDrafts();
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo cargar borradores de pedidos');
  }
}

export async function confirmSupplierDraftController(req, res) {
  try {
    const data = await confirmSupplierDraft(req.params.draftId, req.body, req.user);
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo confirmar el borrador');
  }
}

export async function updateSupplierDraftItemController(req, res) {
  try {
    const data = await changeSupplierDraftItemQuantity({
      draftId: req.params.draftId,
      itemId: req.params.itemId,
      quantity: req.body?.quantity
    });
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo actualizar item del borrador');
  }
}

export async function deleteSupplierDraftItemController(req, res) {
  try {
    const data = await removeSupplierDraftItem({
      draftId: req.params.draftId,
      itemId: req.params.itemId
    });
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo eliminar item del borrador');
  }
}
