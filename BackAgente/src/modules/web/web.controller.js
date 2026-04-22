import {
  getWebAdminProductById,
  getWebCategories,
  getWebProductImagesBatch,
  getWebInactiveProducts,
  getWebProductImage,
  getWebProducts,
  updateWebAdminProduct
} from './web.service.js';

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

    const incomingIfNoneMatch = String(req.headers['if-none-match'] || '').trim();
    const normalizedIncomingEtag = incomingIfNoneMatch.replace(/^W\//i, '').replace(/^"|"$/g, '');
    const normalizedCurrentEtag = String(imageItem.etag || '').replace(/^W\//i, '').replace(/^"|"$/g, '');
    if (normalizedIncomingEtag && normalizedCurrentEtag && normalizedIncomingEtag === normalizedCurrentEtag) {
      res.status(304);
      if (imageItem.etag) {
        res.setHeader('ETag', imageItem.etag);
      }
      return res.end();
    }

    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    if (imageItem.etag) {
      res.setHeader('ETag', imageItem.etag);
    }
    if (imageItem.last_modified) {
      res.setHeader('Last-Modified', new Date(imageItem.last_modified).toUTCString());
    }
    res.setHeader('Content-Type', imageItem.mime_type || 'image/jpeg');
    res.setHeader('Content-Length', String(imageItem.buffer.length || 0));
    return res.send(imageItem.buffer);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo cargar la imagen del producto');
  }
}

export async function getWebProductImagesBatchController(req, res) {
  try {
    const data = await getWebProductImagesBatch(req.body || {});
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudieron cargar imagenes de productos');
  }
}

export async function getWebAdminProductByIdController(req, res) {
  try {
    const data = await getWebAdminProductById(req.params?.productId);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo obtener el producto');
  }
}

export async function updateWebAdminProductController(req, res) {
  try {
    const data = await updateWebAdminProduct(req.params?.productId, req.body || {});
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo actualizar el producto');
  }
}
