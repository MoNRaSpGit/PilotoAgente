import { getWebCategories, getWebInactiveProducts, getWebProductImage, getWebProducts } from './web.service.js';

function handleServiceError(res, error, fallbackMessage) {
  const status = error.status || 500;

  return res.status(status).json({
    message: error.message || fallbackMessage
  });
}

export async function getWebProductsController(req, res) {
  try {
    const data = await getWebProducts(req.query);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudieron cargar los productos web');
  }
}

export async function getWebInactiveProductsController(req, res) {
  try {
    const data = await getWebInactiveProducts(req.query);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudieron cargar los productos web inactivos');
  }
}

export async function getWebCategoriesController(req, res) {
  try {
    const data = await getWebCategories(req.query);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudieron cargar las categorias web');
  }
}

export async function getWebProductImageController(req, res) {
  try {
    const data = await getWebProductImage(req.params?.productId);
    const imageItem = data?.item || {};

    if (!imageItem.buffer) {
      return res.status(404).json({ message: 'Imagen no disponible' });
    }

    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Type', imageItem.mime_type || 'image/jpeg');
    res.setHeader('Content-Length', String(imageItem.buffer.length || 0));
    return res.send(imageItem.buffer);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo cargar la imagen del producto');
  }
}
