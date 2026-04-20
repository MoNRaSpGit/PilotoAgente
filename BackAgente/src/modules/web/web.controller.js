import { getWebCategories, getWebInactiveProducts, getWebProductImage, getWebProducts } from './web.service.js';

function handleServiceError(res, error, fallbackMessage) {
  const status = error.status || 500;

  return res.status(status).json({
    message: error.message || fallbackMessage
  });
}

function toAbsoluteUrl(req, pathOrUrl) {
  if (!pathOrUrl) {
    return null;
  }
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const protocol = req.protocol || 'http';
  const host = req.get('host');
  if (!host) {
    return pathOrUrl;
  }
  return `${protocol}://${host}${pathOrUrl}`;
}

function attachProductImageUrls(req, data) {
  if (!Array.isArray(data?.items)) {
    return data;
  }

  return {
    ...data,
    items: data.items.map((item) => ({
      ...item,
      image_local_url: item.image_local_url || toAbsoluteUrl(req, item.image_path)
    }))
  };
}

export async function getWebProductsController(req, res) {
  try {
    const data = await getWebProducts(req.query);
    return res.json(attachProductImageUrls(req, data));
  } catch (error) {
    return handleServiceError(res, error, 'No se pudieron cargar los productos web');
  }
}

export async function getWebInactiveProductsController(req, res) {
  try {
    const data = await getWebInactiveProducts(req.query);
    return res.json(attachProductImageUrls(req, data));
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

    if (imageItem.redirect_url) {
      return res.redirect(imageItem.redirect_url);
    }

    if (!imageItem.buffer) {
      return res.status(404).json({ message: 'Imagen no disponible' });
    }

    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Type', imageItem.mime_type || 'image/jpeg');
    return res.send(imageItem.buffer);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo cargar la imagen del producto');
  }
}
