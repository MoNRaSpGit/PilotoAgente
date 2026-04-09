const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const PRODUCT_CACHE_KEY = 'frontagente:scanner-cache';
const PRODUCT_CACHE_TTL_MS = 10 * 60 * 1000;
const productMemoryCache = new Map();
const pendingScannerRequests = new Map();

function normalizeBarcode(value = '') {
  return String(value).trim().replace(/\s+/g, '');
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {};
  }
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

export async function fetchClients() {
  const response = await fetch(`${API_URL}/api/clients`);
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar los clientes');
  }

  return data.items || [];
}

export async function createClient(payload) {
  const response = await fetch(`${API_URL}/api/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo crear el cliente');
  }

  return data.item;
}

export async function updateClientPayment(clientId, payload) {
  const response = await fetch(`${API_URL}/api/clients/${clientId}/payment`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo actualizar el cliente');
  }

  return data.item;
}

export async function updateClientDelivery(clientId, payload) {
  const response = await fetch(`${API_URL}/api/clients/${clientId}/delivery`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo registrar la entrega');
  }

  return data.item;
}

export async function updateClientCharge(clientId, payload) {
  const response = await fetch(`${API_URL}/api/clients/${clientId}/charge`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo agregar el cargo al cliente');
  }

  return data.item;
}

export async function fetchClientHistory(clientId, params = {}) {
  const searchParams = new URLSearchParams();

  if (params.from) {
    searchParams.set('from', params.from);
  }

  if (params.to) {
    searchParams.set('to', params.to);
  }

  const query = searchParams.toString();
  const response = await fetch(`${API_URL}/api/clients/${clientId}/history${query ? `?${query}` : ''}`);
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo obtener el historial');
  }

  return data.items || [];
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
      const data = await parseJsonResponse(response);

      if (!response.ok) {
        const error = new Error(data.message || 'No se pudo escanear el producto');
        error.status = response.status;
        error.data = data;
        throw error;
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

export async function createManualProductFromBarcode({ barcode, precioVenta }) {
  const normalizedBarcode = normalizeBarcode(barcode);

  if (!normalizedBarcode) {
    throw new Error('IngresÃ¡ un cÃ³digo de barras vÃ¡lido');
  }

  const response = await fetch(`${API_URL}/api/products/manual-from-scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      barcode: normalizedBarcode,
      precioVenta
    })
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo guardar el producto');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  setCachedScannerProduct(normalizedBarcode, data.item);
  return data;
}

export { API_URL };
