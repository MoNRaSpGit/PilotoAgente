import { getAuthToken } from '../utils/authSession';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const PRODUCT_CACHE_KEY = 'frontagente:scanner-cache';
const EXPENSE_CACHE_KEY = 'frontagente:expenses-cache';
const PRODUCT_CACHE_TTL_MS = 10 * 60 * 1000;
const EXPENSE_CACHE_TTL_MS = 5 * 60 * 1000;
const productMemoryCache = new Map();
const pendingScannerRequests = new Map();
const expenseMemoryCache = new Map();

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

function getAuthHeaders() {
  const token = getAuthToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`
  };
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

function loadExpenseCache() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const raw = window.sessionStorage.getItem(EXPENSE_CACHE_KEY);

    if (!raw) {
      return;
    }

    const entry = JSON.parse(raw);

    if (entry?.expiresAt > Date.now()) {
      expenseMemoryCache.set('summary', entry);
    }
  } catch (_error) {
    window.sessionStorage.removeItem(EXPENSE_CACHE_KEY);
  }
}

function persistExpenseCache() {
  if (typeof window === 'undefined') {
    return;
  }

  const entry = expenseMemoryCache.get('summary');

  if (!entry || entry.expiresAt <= Date.now()) {
    window.sessionStorage.removeItem(EXPENSE_CACHE_KEY);
    return;
  }

  window.sessionStorage.setItem(EXPENSE_CACHE_KEY, JSON.stringify(entry));
}

function clearExpenseCache() {
  expenseMemoryCache.delete('summary');

  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(EXPENSE_CACHE_KEY);
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
loadExpenseCache();

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

export async function fetchClients() {
  const response = await fetch(`${API_URL}/api/clients`, {
    headers: {
      ...getAuthHeaders()
    }
  });
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
      'Content-Type': 'application/json',
      ...getAuthHeaders()
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
      'Content-Type': 'application/json',
      ...getAuthHeaders()
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
      'Content-Type': 'application/json',
      ...getAuthHeaders()
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
      'Content-Type': 'application/json',
      ...getAuthHeaders()
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
  const response = await fetch(`${API_URL}/api/clients/${clientId}/history${query ? `?${query}` : ''}`, {
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo obtener el historial');
  }

  return data.items || [];
}

export async function fetchExpenses() {
  const response = await fetch(`${API_URL}/api/gastos`, {
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar los gastos');
  }

  return data.items || [];
}

export async function fetchExpensesSummary() {
  const cached = expenseMemoryCache.get('summary');

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const response = await fetch(`${API_URL}/api/gastos/summary`, {
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo cargar el resumen de gastos');
  }

  expenseMemoryCache.set('summary', {
    value: data,
    expiresAt: Date.now() + EXPENSE_CACHE_TTL_MS
  });
  persistExpenseCache();

  return data;
}

export async function createExpense(payload) {
  const response = await fetch(`${API_URL}/api/gastos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo crear el gasto');
  }

  clearExpenseCache();
  return data.item;
}

export async function updateExpense(expenseId, payload) {
  const response = await fetch(`${API_URL}/api/gastos/${expenseId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo actualizar el gasto');
  }

  clearExpenseCache();
  return data.item;
}

export async function deleteExpense(expenseId) {
  const response = await fetch(`${API_URL}/api/gastos/${expenseId}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo desactivar el gasto');
  }

  clearExpenseCache();
  return data.item;
}

export async function fetchCashboxSummary(params = {}) {
  const searchParams = new URLSearchParams();

  if (params.date) {
    searchParams.set('date', params.date);
  }

  if (params.compareTo) {
    searchParams.set('compare_to', params.compareTo);
  }
  if (params.forceRefresh) {
    searchParams.set('force_refresh', '1');
  }

  const query = searchParams.toString();

  const response = await fetch(`${API_URL}/api/caja${query ? `?${query}` : ''}`, {
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo obtener la caja');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function fetchCashboxObjectives(params = {}) {
  const searchParams = new URLSearchParams();

  if (params.date) {
    searchParams.set('date', params.date);
  }

  if (params.compareTo) {
    searchParams.set('compare_to', params.compareTo);
  }
  if (params.forceRefresh) {
    searchParams.set('force_refresh', '1');
  }

  const query = searchParams.toString();
  const response = await fetch(`${API_URL}/api/caja/objetivos${query ? `?${query}` : ''}`, {
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudieron obtener los objetivos');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function fetchCashboxMovements(params = {}) {
  const searchParams = new URLSearchParams();

  if (params.date) {
    searchParams.set('date', params.date);
  }

  if (params.limit === 'all') {
    searchParams.set('limit', 'all');
  } else if (Number.isFinite(Number(params.limit)) && Number(params.limit) > 0) {
    searchParams.set('limit', String(Math.floor(Number(params.limit))));
  }

  const query = searchParams.toString();
  const response = await fetch(`${API_URL}/api/caja/movements${query ? `?${query}` : ''}`, {
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudieron obtener los movimientos');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function fetchCashboxRanking(params = {}) {
  const searchParams = new URLSearchParams();

  if (params.limit === 'all') {
    searchParams.set('limit', 'all');
  } else if (Number.isFinite(Number(params.limit)) && Number(params.limit) > 0) {
    searchParams.set('limit', String(Math.floor(Number(params.limit))));
  }

  const query = searchParams.toString();
  const response = await fetch(`${API_URL}/api/caja/ranking${query ? `?${query}` : ''}`, {
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo obtener el ranking');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function closeCashbox() {
  const response = await fetch(`${API_URL}/api/caja/close`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo cerrar la caja');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data.item;
}

export async function openCashbox(payload) {
  const response = await fetch(`${API_URL}/api/caja/open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo abrir la caja');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data.item;
}

export async function registerCashboxPayment(payload) {
  const response = await fetch(`${API_URL}/api/caja/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo registrar el pago');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data.item;
}

export async function registerCashboxSale(payload) {
  const startedAt = performance.now();
  const response = await fetch(`${API_URL}/api/caja/sales`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo registrar la venta');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  const clientDurationMs = Number((performance.now() - startedAt).toFixed(2));
  const serverTotalMs = Number(data?.meta?.total_ms);
  const networkAndClientOverheadMs = Number.isFinite(serverTotalMs)
    ? Number((clientDurationMs - serverTotalMs).toFixed(2))
    : null;

  const result = {
    ...data,
    meta: {
      ...(data?.meta || {}),
      client_duration_ms: clientDurationMs,
      network_and_client_overhead_ms: networkAndClientOverheadMs
    }
  };
  return result;
}

export async function syncScannerLiveState(payload) {
  const response = await fetch(`${API_URL}/api/caja/live-state`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo sincronizar el estado del escaner');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function fetchScannerLiveState(options = {}) {
  const searchParams = new URLSearchParams();
  if (typeof options?.scope === 'string' && options.scope.trim()) {
    searchParams.set('scope', options.scope.trim());
  }
  const query = searchParams.toString();

  const response = await fetch(`${API_URL}/api/caja/live-state${query ? `?${query}` : ''}`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo obtener el estado del escaner');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data.item || null;
}


export async function fetchSuppliers() {
  const response = await fetch(`${API_URL}/api/suppliers`, {
    cache: 'no-store',
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudieron cargar proveedores');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data.items || [];
}

export async function createSupplier(payload) {
  const response = await fetch(`${API_URL}/api/suppliers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo crear el proveedor');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data.item;
}

export async function fetchSupplierProducts(supplierId) {
  const parsedSupplierId = Number(supplierId);
  if (!Number.isFinite(parsedSupplierId) || parsedSupplierId <= 0) {
    throw new Error('Proveedor invalido');
  }

  const response = await fetch(`${API_URL}/api/suppliers/${parsedSupplierId}/products`, {
    cache: 'no-store',
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudieron cargar los productos del proveedor');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return {
    supplier: data.supplier || null,
    items: data.items || []
  };
}

export async function fetchSuppliersAgenda(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.date) {
    searchParams.set('date', params.date);
  }
  const query = searchParams.toString();

  const response = await fetch(`${API_URL}/api/suppliers/agenda${query ? `?${query}` : ''}`, {
    cache: 'no-store',
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo cargar la agenda de proveedores');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function fetchSupplierOrders(params = {}) {
  const searchParams = new URLSearchParams();
  if (Number.isFinite(Number(params.limit)) && Number(params.limit) > 0) {
    searchParams.set('limit', String(Math.floor(Number(params.limit))));
  }
  const query = searchParams.toString();

  const response = await fetch(`${API_URL}/api/suppliers/orders${query ? `?${query}` : ''}`, {
    cache: 'no-store',
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudieron cargar pedidos de proveedores');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data.items || [];
}

export async function upsertSupplierOrderFromProvider(payload) {
  const response = await fetch(`${API_URL}/api/suppliers/orders/upsert-from-provider`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload || {})
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo guardar pedido desde proveedor');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data.item;
}

export async function receiveSupplierOrder(orderId, payload = {}) {
  const parsedOrderId = Number(orderId);
  if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
    throw new Error('Pedido invalido');
  }

  const response = await fetch(`${API_URL}/api/suppliers/orders/${parsedOrderId}/receive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload || {}),
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo confirmar recepcion del pedido');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return {
    item: data.item || null,
    stockUpdates: Array.isArray(data.stock_updates) ? data.stock_updates : []
  };
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

  const request = fetch(`${API_URL}/api/products/scan/${encodeURIComponent(normalizedBarcode)}`, {
    headers: {
      ...getAuthHeaders()
    }
  })
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
      'Content-Type': 'application/json',
      ...getAuthHeaders()
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

export async function updateProduct(productId, payload) {
  const parsedProductId = Number(productId);

  if (!Number.isFinite(parsedProductId) || parsedProductId <= 0) {
    throw new Error('Producto invalido');
  }

  const response = await fetch(`${API_URL}/api/products/${parsedProductId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo actualizar el producto');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  const product = data?.item || null;
  const normalizedBarcode = normalizeBarcode(product?.barcode_normalized || product?.barcode || '');
  if (normalizedBarcode && product) {
    setCachedScannerProduct(normalizedBarcode, product);
  }

  return data;
}

export { API_URL };
