import {
  findProductByBarcode,
  findProductById,
  insertManualProductFromScan
} from './product.repository.js';
import { getCachedProduct, getProductCacheStats, normalizeBarcode, setCachedProduct } from '../../utils/productCache.js';

function toDurationMs(startedAt) {
  return Number((performance.now() - startedAt).toFixed(2));
}

function createServiceError(message, status, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

export async function scanProduct(barcode) {
  const startedAt = performance.now();
  const normalizedBarcode = normalizeBarcode(barcode);

  if (!normalizedBarcode) {
    throw createServiceError('Codigo de barras requerido', 400);
  }

  const cachedProduct = getCachedProduct(normalizedBarcode);

  if (cachedProduct) {
    return {
      item: cachedProduct,
      meta: {
        source: 'server-cache',
        durationMs: toDurationMs(startedAt),
        cache: getProductCacheStats()
      }
    };
  }

  const product = await findProductByBarcode(normalizedBarcode);

  if (!product) {
    throw createServiceError('Producto no encontrado', 404, {
      meta: {
        source: 'database',
        durationMs: toDurationMs(startedAt)
      }
    });
  }

  setCachedProduct(normalizedBarcode, product);

  return {
    item: product,
    meta: {
      source: 'database',
      durationMs: toDurationMs(startedAt),
      cache: getProductCacheStats()
    }
  };
}

export async function createManualProduct(barcode, precioVenta) {
  const startedAt = performance.now();
  const normalizedBarcode = normalizeBarcode(barcode);

  if (!normalizedBarcode) {
    throw createServiceError('Codigo de barras requerido', 400);
  }

  if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
    throw createServiceError('Precio valido requerido', 400);
  }

  const existingProduct = await findProductByBarcode(normalizedBarcode);

  if (existingProduct) {
    throw createServiceError('El producto ya existe', 409, {
      item: existingProduct
    });
  }

  const insertedId = await insertManualProductFromScan({
    barcode: normalizedBarcode,
    precioVenta
  });

  const product = await findProductById(insertedId);

  if (!product) {
    throw createServiceError('No se pudo guardar el producto manual', 500);
  }

  setCachedProduct(normalizedBarcode, product);

  return {
    item: product,
    meta: {
      source: 'database-insert',
      durationMs: toDurationMs(startedAt),
      cache: getProductCacheStats()
    }
  };
}
