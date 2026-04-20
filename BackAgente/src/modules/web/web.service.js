import { listPublicInactiveProducts, listPublicProducts } from './web.repository.js';

function createServiceError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function getWebProducts(query = {}) {
  const rawLimit = Number(query?.limit);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 50;
  const rawOffset = Number(query?.offset);
  const offset = Number.isFinite(rawOffset) ? rawOffset : 0;
  const status = String(query?.status || 'activo').trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 50)));

  if (limit <= 0 || offset < 0) {
    throw createServiceError('Parametros de paginacion invalidos', 400);
  }

  if (status !== 'activo' && status !== 'inactivo') {
    throw createServiceError('Parametro status invalido. Usar activo o inactivo', 400);
  }

  const items = await listPublicProducts({ limit: safeLimit, offset, status });

  return {
    items,
    page: {
      offset,
      limit: safeLimit,
      count: items.length,
      has_more: items.length === safeLimit
    }
  };
}

export async function getWebInactiveProducts(query = {}) {
  const rawLimit = Number(query?.limit);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 50;
  const rawOffset = Number(query?.offset);
  const offset = Number.isFinite(rawOffset) ? rawOffset : 0;
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 50)));

  if (limit <= 0 || offset < 0) {
    throw createServiceError('Parametros de paginacion invalidos', 400);
  }

  const items = await listPublicInactiveProducts({ limit: safeLimit, offset });

  return {
    items,
    page: {
      offset,
      limit: safeLimit,
      count: items.length,
      has_more: items.length === safeLimit
    }
  };
}
