import {
  findProductByBarcode,
  findProductById,
  insertManualProductFromScan,
  updateProductById
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

export async function updateProduct(productId, payload) {
  const parsedProductId = Number(productId);

  if (!Number.isFinite(parsedProductId) || parsedProductId <= 0) {
    throw createServiceError('Producto invalido', 400);
  }

  const hasNombre = Object.prototype.hasOwnProperty.call(payload || {}, 'nombre');
  const hasPrecioVenta = Object.prototype.hasOwnProperty.call(payload || {}, 'precioVenta')
    || Object.prototype.hasOwnProperty.call(payload || {}, 'precio_venta');

  const nombre = hasNombre ? String(payload?.nombre || '').trim() : undefined;
  const rawPrecio = payload?.precioVenta ?? payload?.precio_venta;
  const precioVenta = hasPrecioVenta ? Number(rawPrecio) : undefined;

  if (hasNombre && !nombre) {
    throw createServiceError('Nombre requerido', 400);
  }

  if (hasPrecioVenta && (!Number.isFinite(precioVenta) || precioVenta <= 0)) {
    throw createServiceError('Precio valido requerido', 400);
  }

  if (!hasNombre && !hasPrecioVenta) {
    throw createServiceError('No hay cambios para actualizar', 400);
  }

  const item = await updateProductById({
    productId: parsedProductId,
    nombre,
    precioVenta
  });

  if (!item) {
    throw createServiceError('Producto no encontrado', 404);
  }

  const productBarcode = normalizeBarcode(item.barcode_normalized || item.barcode || '');
  if (productBarcode) {
    setCachedProduct(productBarcode, item);
  }

  return { item };
}
