import crypto from 'crypto';
import {
  countPublicInactiveProducts,
  deleteProductMediaByProductId,
  findWebAdminProductById,
  findProductMediaByProductId,
  findProductMediaByProductIds,
  findPublicProductImagesByIds,
  findPublicProductImageById,
  listPublicCategories,
  listPublicInactiveProducts,
  listPublicProducts,
  upsertProductMediaBatch,
  upsertProductMediaByProductId,
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
const WEB_IMAGE_CACHE_MAX_ITEMS = 300;
const WEB_IMAGE_CACHE_MAX_BYTES = 64 * 1024 * 1024;
const WEB_IMAGE_BATCH_LIMIT = 40;
const WEB_IMAGE_HYDRATE_CHUNK_SIZE = 8;
const productsCache = new Map();
const categoriesCache = new Map();
const imagesCache = new Map();
const imageLoadInFlight = new Map();
const productsLoadInFlight = new Map();
const categoriesLoadInFlight = new Map();
const imageHydrateInFlight = new Set();
const imageHydrateQueue = [];
let imageHydrateWorkerActive = false;
let imagesCacheBytes = 0;

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

function getImageCacheSizeBytes(imageValue) {
  const size = Number(imageValue?.buffer?.length || 0);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

function deleteImageCacheEntry(key) {
  const existing = imagesCache.get(key);
  if (!existing) {
    return;
  }
  imagesCacheBytes = Math.max(0, imagesCacheBytes - Number(existing.sizeBytes || 0));
  imagesCache.delete(key);
}

function clearExpiredImageCacheEntries() {
  const now = getNow();
  for (const [key, entry] of imagesCache.entries()) {
    if (entry.expiresAt <= now) {
      deleteImageCacheEntry(key);
    }
  }
}

function getCachedImageValue(key) {
  const entry = imagesCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= getNow()) {
    deleteImageCacheEntry(key);
    return null;
  }

  // Refresh LRU order on hit.
  imagesCache.delete(key);
  imagesCache.set(key, entry);
  return entry.value;
}

function setCachedImageValue(key, value, ttlMs) {
  clearExpiredImageCacheEntries();

  const sizeBytes = getImageCacheSizeBytes(value);
  if (imagesCache.has(key)) {
    deleteImageCacheEntry(key);
  }

  imagesCache.set(key, {
    value,
    expiresAt: getNow() + ttlMs,
    sizeBytes
  });
  imagesCacheBytes += sizeBytes;

  while (imagesCache.size > WEB_IMAGE_CACHE_MAX_ITEMS || imagesCacheBytes > WEB_IMAGE_CACHE_MAX_BYTES) {
    const oldestKey = imagesCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    deleteImageCacheEntry(oldestKey);
  }
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

function normalizeEtag(value = '') {
  return String(value || '').trim().replace(/^W\//i, '').replace(/^"|"$/g, '');
}

function computeImageHash(bufferValue) {
  if (!Buffer.isBuffer(bufferValue) || bufferValue.length === 0) {
    return '';
  }
  return crypto.createHash('sha1').update(bufferValue).digest('hex');
}

function buildEtagFromHash(hashValue = '') {
  const normalizedHash = String(hashValue || '').trim();
  return normalizedHash ? `"${normalizedHash}"` : '';
}

function toImageCacheItem({
  buffer,
  mimeType,
  sourceHash = '',
  updatedAt = ''
}) {
  const safeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.alloc(0);
  const hash = sourceHash || computeImageHash(safeBuffer);
  const etag = buildEtagFromHash(hash);
  return {
    buffer: safeBuffer,
    mime_type: mimeType || detectImageMime(safeBuffer),
    source_hash: hash,
    etag,
    last_modified: String(updatedAt || '').trim()
  };
}

function parseMediaThumbPayload(mediaRow) {
  if (!mediaRow) {
    return null;
  }

  const parsed = parseImagePayload(mediaRow.thumb_small);
  if (!parsed || !Buffer.isBuffer(parsed.buffer) || parsed.buffer.length === 0) {
    return null;
  }

  return toImageCacheItem({
    buffer: parsed.buffer,
    mimeType: mediaRow.mime_type || parsed.mime_type,
    sourceHash: String(mediaRow.source_hash || '').trim(),
    updatedAt: mediaRow.updated_at
  });
}

function runImageSingleFlight(cacheKey, factory) {
  if (imageLoadInFlight.has(cacheKey)) {
    return imageLoadInFlight.get(cacheKey);
  }

  const task = Promise.resolve()
    .then(factory)
    .finally(() => {
      imageLoadInFlight.delete(cacheKey);
    });

  imageLoadInFlight.set(cacheKey, task);
  return task;
}

function runSingleFlight(inFlightMap, cacheKey, factory) {
  if (inFlightMap.has(cacheKey)) {
    return inFlightMap.get(cacheKey);
  }

  const task = Promise.resolve()
    .then(factory)
    .finally(() => {
      inFlightMap.delete(cacheKey);
    });

  inFlightMap.set(cacheKey, task);
  return task;
}

function scheduleAsync(task) {
  setTimeout(() => {
    Promise.resolve()
      .then(task)
      .catch(() => {});
  }, 0);
}

function enqueueHydrateTask(productIds = []) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return;
  }

  imageHydrateQueue.push(productIds);
  if (!imageHydrateWorkerActive) {
    runHydrateWorker();
  }
}

function runHydrateWorker() {
  if (imageHydrateWorkerActive) {
    return;
  }
  imageHydrateWorkerActive = true;

  scheduleAsync(async () => {
    try {
      while (imageHydrateQueue.length > 0) {
        const ids = imageHydrateQueue.shift();
        if (!Array.isArray(ids) || ids.length === 0) {
          continue;
        }

        try {
          const chunks = chunkArray(ids, WEB_IMAGE_HYDRATE_CHUNK_SIZE);
          for (const batchIds of chunks) {
            const productRows = await findPublicProductImagesByIds(batchIds);
            const upserts = [];
            for (const row of productRows) {
              const productId = Number(row?.id || 0);
              if (!Number.isFinite(productId) || productId <= 0) {
                continue;
              }
              const parsed = parseImagePayload(row.imagen);
              if (!parsed) {
                continue;
              }
              const imageItem = toImageCacheItem({
                buffer: parsed.buffer,
                mimeType: parsed.mime_type
              });
              setCachedImageValue(`image:${productId}`, imageItem, WEB_IMAGE_CACHE_TTL_MS);
              upserts.push({
                productId,
                thumbSmall: imageItem.buffer,
                mimeType: imageItem.mime_type,
                etag: imageItem.etag,
                sourceHash: imageItem.source_hash,
                sourceSize: imageItem.buffer.length
              });
            }
            if (upserts.length > 0) {
              await upsertProductMediaBatch(upserts);
            }
          }
        } catch {
          // noop
        } finally {
          for (const id of ids) {
            imageHydrateInFlight.delete(id);
          }
        }
      }
    } finally {
      imageHydrateWorkerActive = false;
      if (imageHydrateQueue.length > 0) {
        runHydrateWorker();
      }
    }
  });
}

function chunkArray(items = [], size = 10) {
  const safeSize = Math.max(1, Math.floor(Number(size) || 10));
  const chunks = [];
  for (let i = 0; i < items.length; i += safeSize) {
    chunks.push(items.slice(i, i + safeSize));
  }
  return chunks;
}

function scheduleHydrateProductMedia(productIds = []) {
  const ids = [...new Set(
    (Array.isArray(productIds) ? productIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
  )].filter((id) => !imageHydrateInFlight.has(id));

  if (!ids.length) {
    return;
  }

  for (const id of ids) {
    imageHydrateInFlight.add(id);
  }

  enqueueHydrateTask(ids);
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

  return runSingleFlight(productsLoadInFlight, cacheKey, async () => {
    const secondCached = getCachedValue(productsCache, cacheKey);
    if (secondCached) {
      return secondCached;
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
  });
}

export async function warmWebCatalogCache() {
  await Promise.allSettled([
    getWebCategories({ status: 'activo' }),
    getWebProducts({ status: 'activo', limit: 500, offset: 0 })
  ]);
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

  return runSingleFlight(categoriesLoadInFlight, cacheKey, async () => {
    const secondCached = getCachedValue(categoriesCache, cacheKey);
    if (secondCached) {
      return secondCached;
    }

    const items = await listPublicCategories({ status });
    const payload = { items };
    setCachedValue(categoriesCache, cacheKey, payload, WEB_CATEGORIES_CACHE_TTL_MS);
    return payload;
  });
}

export async function getWebProductImage(productId) {
  const parsedProductId = Number(productId);
  if (!Number.isFinite(parsedProductId) || parsedProductId <= 0) {
    throw createServiceError('Producto invalido', 400);
  }

  const imageCacheKey = `image:${parsedProductId}`;
  const cachedImage = getCachedImageValue(imageCacheKey);
  if (cachedImage) {
    return { item: cachedImage };
  }

  const item = await runImageSingleFlight(imageCacheKey, async () => {
    const mediaRow = await findProductMediaByProductId(parsedProductId);
    const parsedMedia = parseMediaThumbPayload(mediaRow);
    if (parsedMedia) {
      setCachedImageValue(imageCacheKey, parsedMedia, WEB_IMAGE_CACHE_TTL_MS);
      return parsedMedia;
    }

    const productRow = await findPublicProductImageById(parsedProductId);
    if (!productRow) {
      throw createServiceError('Producto no encontrado', 404);
    }

    const parsed = parseImagePayload(productRow.imagen);
    if (!parsed) {
      throw createServiceError('Imagen no disponible', 404);
    }

    const imageItem = toImageCacheItem({
      buffer: parsed.buffer,
      mimeType: parsed.mime_type
    });

    setCachedImageValue(imageCacheKey, imageItem, WEB_IMAGE_CACHE_TTL_MS);

    // Persistimos thumb/local-cache en tabla media para evitar leer blob grande de ops_producto.
    upsertProductMediaByProductId({
      productId: parsedProductId,
      thumbSmall: imageItem.buffer,
      mimeType: imageItem.mime_type,
      etag: imageItem.etag,
      sourceHash: imageItem.source_hash,
      sourceSize: imageItem.buffer.length
    }).catch(() => {});

    return imageItem;
  });

  return { item };
}

export async function getWebProductImagesBatch(payload = {}) {
  const rawIds = Array.isArray(payload?.ids) ? payload.ids : [];
  const productIds = [...new Set(
    rawIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
  )].slice(0, WEB_IMAGE_BATCH_LIMIT);

  if (!productIds.length) {
    return { items: [] };
  }

  const imageItemsById = new Map();
  const idsToResolve = [];

  for (const productId of productIds) {
    const cacheKey = `image:${productId}`;
    const cached = getCachedImageValue(cacheKey);
    if (cached) {
      imageItemsById.set(productId, cached);
      continue;
    }
    idsToResolve.push(productId);
  }

  if (idsToResolve.length > 0) {
    const mediaRows = await findProductMediaByProductIds(idsToResolve);
    const mediaFoundIds = new Set();

    for (const mediaRow of mediaRows) {
      const productId = Number(mediaRow?.product_id || 0);
      if (!Number.isFinite(productId) || productId <= 0) {
        continue;
      }

      const parsedMedia = parseMediaThumbPayload(mediaRow);
      if (!parsedMedia) {
        continue;
      }

      mediaFoundIds.add(productId);
      imageItemsById.set(productId, parsedMedia);
      setCachedImageValue(`image:${productId}`, parsedMedia, WEB_IMAGE_CACHE_TTL_MS);
    }

    const missingIds = idsToResolve.filter((id) => !mediaFoundIds.has(id));
    if (missingIds.length > 0) {
      // No bloqueamos la respuesta batch con lectura de blob original:
      // hidratamos media table en segundo plano para siguientes requests.
      scheduleHydrateProductMedia(missingIds);
    }
  }

  const items = productIds
    .map((productId) => {
      const imageItem = imageItemsById.get(productId);
      if (!imageItem?.buffer) {
        return null;
      }
      return {
        product_id: productId,
        mime_type: imageItem.mime_type || 'image/jpeg',
        data_base64: imageItem.buffer.toString('base64'),
        etag: imageItem.etag || ''
      };
    })
    .filter(Boolean);

  return { items };
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
      categoria: String(item.categoria || '').trim(),
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
  const hasCategoria = Object.prototype.hasOwnProperty.call(payload, 'categoria');
  const hasImagen = Object.prototype.hasOwnProperty.call(payload, 'imagen_base64');

  const nombre = hasNombre ? String(payload.nombre || '').trim() : undefined;
  const precioVenta = hasPrecio ? Number(payload.precio_venta ?? payload.precioVenta) : undefined;
  const estado = hasEstado ? String(payload.estado || '').trim().toLowerCase() : undefined;
  const categoria = hasCategoria ? String(payload.categoria || '').trim() : undefined;
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

  if (hasCategoria && !categoria) {
    throw createServiceError('Categoria requerida', 400);
  }

  if (hasImagen && !imagenBase64) {
    throw createServiceError('Imagen invalida', 400);
  }

  if (!hasNombre && !hasPrecio && !hasEstado && !hasCategoria && !hasImagen) {
    throw createServiceError('No hay cambios para actualizar', 400);
  }

  const updated = await updateWebAdminProductById({
    productId: parsedProductId,
    nombre,
    precioVenta,
    categoria,
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
  deleteImageCacheEntry(`image:${parsedProductId}`);
  if (hasImagen) {
    await deleteProductMediaByProductId(parsedProductId);
  }

  return {
    item: {
      id: Number(updated.id),
      nombre: String(updated.nombre || ''),
      precio_venta: Number(updated.precio_venta || 0),
      categoria: String(updated.categoria || '').trim(),
      estado: String(updated.estado || '').trim().toLowerCase() || 'inactivo',
      has_local_image: Boolean(Number(updated.has_local_image || 0))
    }
  };
}
