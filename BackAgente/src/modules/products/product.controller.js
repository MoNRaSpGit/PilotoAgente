import { createManualProduct, getProducts, scanProduct } from './product.service.js';

function handleServiceError(res, error, fallbackMessage) {
  const status = error.status || 500;

  return res.status(status).json({
    message: error.message || fallbackMessage,
    ...(error.meta ? { meta: error.meta } : {}),
    ...(error.item ? { item: error.item } : {}),
    ...(status === 500 && error.error ? { error: error.error } : {})
  });
}

export async function listProductsController(_req, res) {
  try {
    const data = await getProducts();
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudieron obtener los productos');
  }
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
