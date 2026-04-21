import {
  countPublicInactiveProducts,
  findWebAdminProductById,
  findPublicProductImageById,
  listPublicCategories,
  listPublicInactiveProducts,
  listPublicProducts,
  updateWebAdminProductById
} from './web.repository.js';

function createServiceError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const WEB_PRODUCTS_CACHE_TTL_MS = 30 * 1000;
const WEB_CATEGORIES_CACHE_TTL_MS = 60 * 1000;
const WEB_IMAGE_CACHE_TTL_MS = 10 * 60 * 1000;
const productsCache = new Map();
const categoriesCache = new Map();
const imagesCache = new Map();

function getNow() {
  return Date.now();
}

function getCachedValue(cache, key) {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= getNow()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function setCachedValue(cache, key, value, ttlMs) {
  cache.set(key, {
    value,
    expiresAt: getNow() + ttlMs
  });
}

function detectImageMime(bufferValue) {
  if (!Buffer.isBuffer(bufferValue) || bufferValue.length < 4) {
    return 'image/jpeg';
  }

  if (bufferValue[0] === 0xff && bufferValue[1] === 0xd8) {
    return 'image/jpeg';
  }
  if (bufferValue[0] === 0x89 && bufferValue[1] === 0x50 && bufferValue[2] === 0x4e && bufferValue[3] === 0x47) {
    return 'image/png';
  }
  if (bufferValue[0] === 0x47 && bufferValue[1] === 0x49 && bufferValue[2] === 0x46) {
    return 'image/gif';
  }
  if (
    bufferValue.length > 12
    && bufferValue.toString('ascii', 0, 4) === 'RIFF'
    && bufferValue.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return 'image/jpeg';
}

function looksLikeBinaryImageBuffer(bufferValue) {
  if (!Buffer.isBuffer(bufferValue) || bufferValue.length < 4) {
    return false;
  }

  return (
    (bufferValue[0] === 0xff && bufferValue[1] === 0xd8)
    || (bufferValue[0] === 0x89 && bufferValue[1] === 0x50 && bufferValue[2] === 0x4e && bufferValue[3] === 0x47)
    || (bufferValue[0] === 0x47 && bufferValue[1] === 0x49 && bufferValue[2] === 0x46)
    || (
      bufferValue.length > 12
      && bufferValue.toString('ascii', 0, 4) === 'RIFF'
      && bufferValue.toString('ascii', 8, 12) === 'WEBP'
    )
  );
}

function tryParseStringImagePayload(rawValue) {
  const normalizedValue = String(rawValue || '').trim();
  if (!normalizedValue) {
    return null;
  }

  if (/^data:image\//i.test(normalizedValue)) {
    const match = normalizedValue.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i);
    if (!match) {
      return null;
    }
    return {
      mime_type: match[1].toLowerCase(),
      buffer: Buffer.from(match[2], 'base64')
    };
  }

  const noWhitespace = normalizedValue.replace(/\s/g, '');
  const looksLikeBase64 = noWhitespace.length > 20 && /^[A-Za-z0-9+/=]+$/.test(noWhitespace);
  if (!looksLikeBase64) {
    return null;
  }

  const decoded = Buffer.from(noWhitespace, 'base64');
  if (!decoded.length) {
    return null;
  }

  return {
    mime_type: detectImageMime(decoded),
    buffer: decoded
  };
}

function parseImagePayload(imageValue) {
  if (Buffer.isBuffer(imageValue)) {
    if (looksLikeBinaryImageBuffer(imageValue)) {
      return {
        mime_type: detectImageMime(imageValue),
        buffer: imageValue
      };
    }

    // Some rows store base64/data-url text inside blob fields.
    const textBufferValue = imageValue.toString('utf8').trim();
    const parsedFromBufferText = tryParseStringImagePayload(textBufferValue);
    if (parsedFromBufferText) {
      return parsedFromBufferText;
    }

    return {
      mime_type: detectImageMime(imageValue),
      buffer: imageValue
    };
  }

  if (imageValue) {
    const parsedFromValue = tryParseStringImagePayload(String(imageValue));
    if (parsedFromValue) {
      return parsedFromValue;
    }
  }

  return null;
}

export async function getWebProducts(query = {}) {
  const rawLimit = Number(query?.limit);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 500;
  const rawOffset = Number(query?.offset);
  const offset = Number.isFinite(rawOffset) ? rawOffset : 0;
  const status = String(query?.status || 'activo').trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 500)));
  const category = String(query?.category || '').trim();

  if (limit <= 0 || offset < 0) {
    throw createServiceError('Parametros de paginacion invalidos', 400);
  }

  if (status !== 'activo' && status !== 'inactivo') {
    throw createServiceError('Parametro status invalido. Usar activo o inactivo', 400);
  }

  const cacheKey = `products:${status}:${category.toLowerCase().replace(/\s+/g, ' ').trim()}:${safeLimit}:${offset}`;
  const cached = getCachedValue(productsCache, cacheKey);
  if (cached) {
    return cached;
  }

  const items = await listPublicProducts({
    limit: safeLimit,
    offset,
    status,
    category
  });

  const payload = {
    items,
    page: {
      offset,
      limit: safeLimit,
      count: items.length,
      has_more: items.length === safeLimit
    }
  };

  setCachedValue(productsCache, cacheKey, payload, WEB_PRODUCTS_CACHE_TTL_MS);
  return payload;
}

export async function getWebInactiveProducts(query = {}) {
  const rawLimit = Number(query?.limit);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 500;
  const rawOffset = Number(query?.offset);
  const offset = Number.isFinite(rawOffset) ? rawOffset : 0;
  const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 500)));

  if (limit <= 0 || offset < 0) {
    throw createServiceError('Parametros de paginacion invalidos', 400);
  }

  const [items, total] = await Promise.all([
    listPublicInactiveProducts({ limit: safeLimit, offset }),
    countPublicInactiveProducts()
  ]);

  return {
    items,
    page: {
      offset,
      limit: safeLimit,
      total,
      count: items.length,
      has_more: items.length === safeLimit
    }
  };
}

export async function getWebCategories(query = {}) {
  const status = String(query?.status || 'activo').trim().toLowerCase();
  if (status !== 'activo' && status !== 'inactivo') {
    throw createServiceError('Parametro status invalido. Usar activo o inactivo', 400);
  }

  const cacheKey = `categories:${status}`;
  const cached = getCachedValue(categoriesCache, cacheKey);
  if (cached) {
    return cached;
  }

  const items = await listPublicCategories({ status });
  const payload = { items };
  setCachedValue(categoriesCache, cacheKey, payload, WEB_CATEGORIES_CACHE_TTL_MS);
  return payload;
}

export async function getWebProductImage(productId) {
  const parsedProductId = Number(productId);
  if (!Number.isFinite(parsedProductId) || parsedProductId <= 0) {
    throw createServiceError('Producto invalido', 400);
  }

  const imageCacheKey = `image:${parsedProductId}`;
  const cachedImage = getCachedValue(imagesCache, imageCacheKey);
  if (cachedImage) {
    return { item: cachedImage };
  }

  const item = await findPublicProductImageById(parsedProductId);
  if (!item) {
    throw createServiceError('Producto no encontrado', 404);
  }

  const parsed = parseImagePayload(item.imagen);
  if (!parsed) {
    throw createServiceError('Imagen no disponible', 404);
  }

  setCachedValue(imagesCache, imageCacheKey, parsed, WEB_IMAGE_CACHE_TTL_MS);
  return { item: parsed };
}

export async function getWebAdminProductById(productId) {
  const parsedProductId = Number(productId);
  if (!Number.isFinite(parsedProductId) || parsedProductId <= 0) {
    throw createServiceError('Producto invalido', 400);
  }

  const item = await findWebAdminProductById(parsedProductId);
  if (!item) {
    throw createServiceError('Producto no encontrado', 404);
  }

  return {
    item: {
      id: Number(item.id),
      nombre: String(item.nombre || ''),
      precio_venta: Number(item.precio_venta || 0),
      estado: String(item.estado || '').trim().toLowerCase() || 'inactivo',
      has_local_image: Boolean(Number(item.has_local_image || 0))
    }
  };
}

export async function updateWebAdminProduct(productId, payload = {}) {
  const parsedProductId = Number(productId);
  if (!Number.isFinite(parsedProductId) || parsedProductId <= 0) {
    throw createServiceError('Producto invalido', 400);
  }

  const hasNombre = Object.prototype.hasOwnProperty.call(payload, 'nombre');
  const hasPrecio = Object.prototype.hasOwnProperty.call(payload, 'precio_venta')
    || Object.prototype.hasOwnProperty.call(payload, 'precioVenta');
  const hasEstado = Object.prototype.hasOwnProperty.call(payload, 'estado');
  const hasImagen = Object.prototype.hasOwnProperty.call(payload, 'imagen_base64');

  const nombre = hasNombre ? String(payload.nombre || '').trim() : undefined;
  const precioVenta = hasPrecio ? Number(payload.precio_venta ?? payload.precioVenta) : undefined;
  const estado = hasEstado ? String(payload.estado || '').trim().toLowerCase() : undefined;
  const imagenBase64 = hasImagen ? String(payload.imagen_base64 || '').trim() : undefined;

  if (hasNombre && !nombre) {
    throw createServiceError('Nombre requerido', 400);
  }

  if (hasPrecio && (!Number.isFinite(precioVenta) || precioVenta <= 0)) {
    throw createServiceError('Precio valido requerido', 400);
  }

  if (hasEstado && estado !== 'activo' && estado !== 'inactivo') {
    throw createServiceError('Estado invalido. Usar activo o inactivo', 400);
  }

  if (hasImagen && !imagenBase64) {
    throw createServiceError('Imagen invalida', 400);
  }

  if (!hasNombre && !hasPrecio && !hasEstado && !hasImagen) {
    throw createServiceError('No hay cambios para actualizar', 400);
  }

  const updated = await updateWebAdminProductById({
    productId: parsedProductId,
    nombre,
    precioVenta,
    estado,
    hasImagenValue: hasImagen,
    imagenValue: hasImagen ? imagenBase64 : undefined,
    tieneImagen: hasImagen ? 1 : undefined
  });

  if (!updated) {
    throw createServiceError('Producto no encontrado', 404);
  }

  productsCache.clear();
  categoriesCache.clear();
  imagesCache.delete(`image:${parsedProductId}`);

  return {
    item: {
      id: Number(updated.id),
      nombre: String(updated.nombre || ''),
      precio_venta: Number(updated.precio_venta || 0),
      estado: String(updated.estado || '').trim().toLowerCase() || 'inactivo',
      has_local_image: Boolean(Number(updated.has_local_image || 0))
    }
  };
}
