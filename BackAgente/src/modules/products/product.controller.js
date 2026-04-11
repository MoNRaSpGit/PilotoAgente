import { createManualProduct, scanProduct, updateProduct } from './product.service.js';

function handleServiceError(res, error, fallbackMessage) {
  const status = error.status || 500;

  return res.status(status).json({
    message: error.message || fallbackMessage,
    ...(error.meta ? { meta: error.meta } : {}),
    ...(error.item ? { item: error.item } : {}),
    ...(status === 500 && error.error ? { error: error.error } : {})
  });
}

export async function scanProductController(req, res) {
  try {
    const data = await scanProduct(req.params.barcode);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo escanear el producto');
  }
}

export async function createManualProductController(req, res) {
  try {
    const data = await createManualProduct(req.body?.barcode, Number(req.body?.precioVenta));
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo guardar el producto manual');
  }
}

export async function updateProductController(req, res) {
  try {
    const data = await updateProduct(req.params.productId, req.body);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo actualizar el producto');
  }
}
