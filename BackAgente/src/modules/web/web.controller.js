import { getWebInactiveProducts, getWebProducts } from './web.service.js';

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
