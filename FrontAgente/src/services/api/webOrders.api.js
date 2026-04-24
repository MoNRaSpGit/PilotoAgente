import {
  API_URL,
  getAuthHeaders,
  getCurrentAuthToken,
  parseJsonResponse
} from '../api.shared';

export async function fetchIncomingWebOrders(params = {}) {
  const searchParams = new URLSearchParams();
  if (Number.isFinite(Number(params.limit)) && Number(params.limit) > 0) {
    searchParams.set('limit', String(Math.floor(Number(params.limit))));
  }

  const query = searchParams.toString();
  const response = await fetch(`${API_URL}/api/web/admin/orders${query ? `?${query}` : ''}`, {
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudieron cargar los pedidos web');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return Array.isArray(data.items) ? data.items : [];
}

export async function updateIncomingWebOrderStatus(orderId, status) {
  const parsedOrderId = Number(orderId);
  if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
    throw new Error('Pedido invalido');
  }

  const response = await fetch(`${API_URL}/api/web/admin/orders/${parsedOrderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ status })
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo actualizar estado del pedido web');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data.item || null;
}

export async function hideIncomingWebOrder(orderId) {
  const parsedOrderId = Number(orderId);
  if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
    throw new Error('Pedido invalido');
  }

  const response = await fetch(`${API_URL}/api/web/admin/orders/${parsedOrderId}/hide`, {
    method: 'PATCH',
    headers: {
      ...getAuthHeaders()
    }
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo ocultar el pedido web');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data.item || null;
}

export async function fetchPushPublicConfig() {
  const response = await fetch(`${API_URL}/api/notifications/push/public-key`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo obtener configuracion push');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return {
    enabled: Boolean(data?.enabled),
    publicKey: String(data?.publicKey || '').trim()
  };
}

export async function registerPushSubscription(payload = {}) {
  const response = await fetch(`${API_URL}/api/notifications/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload || {})
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo registrar suscripcion push');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function unregisterPushSubscription(payload = {}) {
  const response = await fetch(`${API_URL}/api/notifications/push/unsubscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload || {})
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo remover suscripcion push');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function buildAdminWebOrdersStreamUrl() {
  const token = getCurrentAuthToken();
  if (!token) {
    return '';
  }

  const separator = API_URL.includes('?') ? '&' : '?';
  return `${API_URL}/api/web/admin/orders/stream${separator}token=${encodeURIComponent(token)}`;
}
