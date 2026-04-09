const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const PRODUCT_CACHE_KEY = 'frontagente:scanner-cache';
const PRODUCT_CACHE_TTL_MS = 10 * 60 * 1000;
const productMemoryCache = new Map();
const pendingScannerRequests = new Map();

function normalizeBarcode(value = '') {
  return String(value).trim().replace(/\s+/g, '');
}

function loadSessionCache() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const raw = window.sessionStorage.getItem(PRODUCT_CACHE_KEY);

    if (!raw) {
      return;
    }

    const entries = JSON.parse(raw);

    entries.forEach(([key, value]) => {
      if (value.expiresAt > Date.now()) {
        productMemoryCache.set(key, value);
      }
    });
  } catch (_error) {
    window.sessionStorage.removeItem(PRODUCT_CACHE_KEY);
  }
}

function persistSessionCache() {
  if (typeof window === 'undefined') {
    return;
  }

  const entries = [...productMemoryCache.entries()].filter(([, value]) => value.expiresAt > Date.now());
  window.sessionStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(entries));
}

function getCachedScannerProduct(barcode) {
  const normalized = normalizeBarcode(barcode);
  const entry = productMemoryCache.get(normalized);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    productMemoryCache.delete(normalized);
    persistSessionCache();
    return null;
  }

  return entry.value;
}

function setCachedScannerProduct(barcode, value) {
  const normalized = normalizeBarcode(barcode);

  productMemoryCache.set(normalized, {
    value,
    expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS
  });

  persistSessionCache();
}

loadSessionCache();

export async function loginRequest(payload) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('No se pudo iniciar sesión');
  }

  return response.json();
}

export async function fetchProducts(limit = 5) {
  const response = await fetch(`${API_URL}/api/products`);

  if (!response.ok) {
    throw new Error('No se pudieron cargar los productos');
  }

  const data = await response.json();

  return (data.items || []).slice(0, limit);
}

export async function scanProductByBarcode(barcode) {
  const normalizedBarcode = normalizeBarcode(barcode);

  if (!normalizedBarcode) {
    throw new Error('Ingresá un código de barras válido');
  }

  const startedAt = performance.now();
  const cachedProduct = getCachedScannerProduct(normalizedBarcode);

  if (cachedProduct) {
    return {
      item: cachedProduct,
      meta: {
        source: 'client-cache',
        durationMs: Number((performance.now() - startedAt).toFixed(2))
      }
    };
  }

  if (pendingScannerRequests.has(normalizedBarcode)) {
    return pendingScannerRequests.get(normalizedBarcode);
  }

  const request = fetch(`${API_URL}/api/products/scan/${encodeURIComponent(normalizedBarcode)}`)
    .then(async (response) => {
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'No se pudo escanear el producto');
      }

      setCachedScannerProduct(normalizedBarcode, data.item);
      return data;
    })
    .finally(() => {
      pendingScannerRequests.delete(normalizedBarcode);
    });

  pendingScannerRequests.set(normalizedBarcode, request);
  return request;
}

export { API_URL };
