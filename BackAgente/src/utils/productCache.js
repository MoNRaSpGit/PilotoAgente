const CACHE_TTL_MS = 10 * 60 * 1000;
const productCache = new Map();

export function normalizeBarcode(value = '') {
  return String(value).trim().replace(/\s+/g, '');
}

export function getCachedProduct(barcode) {
  const normalized = normalizeBarcode(barcode);
  const entry = productCache.get(normalized);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    productCache.delete(normalized);
    return null;
  }

  return entry.value;
}

export function setCachedProduct(barcode, value) {
  const normalized = normalizeBarcode(barcode);

  productCache.set(normalized, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

export function getProductCacheStats() {
  return {
    size: productCache.size,
    ttlMs: CACHE_TTL_MS
  };
}
