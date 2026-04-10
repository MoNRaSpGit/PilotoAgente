import {
  createCashbox,
  closeCashbox,
  getCashboxSummary,
  listCashboxSaleMovements,
  recordCashboxPayment,
  recordCashboxSale
} from './caja.repository.js';
import { broadcastCashboxUpdate } from './caja.realtime.js';
import { getScannerLiveState, saveScannerLiveState } from './scannerLiveState.store.js';

function createServiceError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchCashboxSummary() {
  return getCashboxSummary();
}

export async function fetchCashboxDashboard(query = {}) {
  return getCashboxSummary({
    date: query?.date,
    compareTo: query?.compare_to || query?.compareTo
  });
}

export async function fetchCashboxMovements(query = {}) {
  const rawLimit = query?.limit;
  const limit = rawLimit === 'all' ? null : rawLimit;
  return listCashboxSaleMovements({
    date: query?.date,
    limit
  });
}

export async function fetchScannerLiveState(user) {
  return {
    item: getScannerLiveState(user)
  };
}

export async function openCashbox(payload, user) {
  const openingAmount = Number(payload?.opening_amount ?? payload?.amount ?? 0);

  if (!Number.isFinite(openingAmount) || openingAmount <= 0) {
    throw createServiceError('Monto inicial valido requerido', 400);
  }

  const operator = {
    id: user?.id,
    name: user?.name,
    role: user?.role
  };

  const caja = await createCashbox({ openingAmount, operator });

  broadcastCashboxUpdate({
    type: 'cashbox:opened',
    source: 'manual'
  });

  return {
    item: caja
  };
}

export async function addCashboxPayment(payload, user) {
  const amount = Number(payload?.amount ?? payload?.monto ?? 0);
  const description = String(payload?.description ?? payload?.detalle ?? '').trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createServiceError('Monto valido requerido', 400);
  }

  const operator = {
    id: user?.id,
    name: user?.name,
    role: user?.role
  };

  const result = await recordCashboxPayment({
    amount,
    description,
    operator
  });

  broadcastCashboxUpdate({
    type: 'cashbox:payment',
    source: 'manual'
  });

  return {
    item: result.caja
  };
}

export async function addCashboxSale(payload, user) {
  const amount = Number(payload?.amount ?? payload?.total ?? 0);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const shouldClearLiveState = Boolean(payload?.clear_live_state);
  const clearLiveStateVersion = parseOptionalNumber(payload?.clear_live_state_version);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createServiceError('Monto valido requerido', 400);
  }

  const operator = {
    id: user?.id,
    name: user?.name,
    role: user?.role
  };

  const result = await recordCashboxSale({
    amount,
    items,
    source: payload?.source || 'scanner',
    description: payload?.description || 'Venta desde escaner',
    operator
  });

  if (shouldClearLiveState) {
    const clearedSnapshot = saveScannerLiveState({
      type: 'scanner:state',
      source: payload?.source || 'scanner',
      state: 'idle',
      version: clearLiveStateVersion,
      client_updated_at: new Date().toISOString(),
      total: 0,
      items: [],
      operator,
      editing: null,
      manual: null,
      updated_at: new Date().toISOString()
    });

    broadcastCashboxUpdate({
      type: 'scanner:state',
      ...clearedSnapshot
    });
  }

  broadcastCashboxUpdate({
    type: 'sale',
    source: payload?.source || 'scanner',
    description: payload?.description || 'Venta desde escaner',
    amount,
    items,
    operator,
    caja: result.caja,
    movement_id: result.movement_id
  });

  return {
    item: result.caja
  };
}

export async function syncScannerLiveState(payload, user) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number(payload?.total ?? payload?.amount ?? 0);
  const state = String(payload?.state || (items.length > 0 ? 'active' : 'idle'));
  const version = parseOptionalNumber(payload?.version);
  const operator = {
    id: user?.id ?? payload?.operator?.id ?? null,
    name: user?.name ?? payload?.operator?.name ?? null,
    role: user?.role ?? payload?.operator?.role ?? null
  };
  const snapshot = saveScannerLiveState({
    type: 'scanner:state',
    source: payload?.source || 'scanner',
    state,
    version,
    client_updated_at: payload?.updated_at || null,
    total: Number.isFinite(total) ? Number(total.toFixed(2)) : 0,
    items,
    operator,
    editing: payload?.editing || null,
    manual: payload?.manual || null,
    updated_at: new Date().toISOString()
  });

  broadcastCashboxUpdate({
    type: 'scanner:state',
    ...snapshot
  });

  return {
    item: snapshot
  };
}

export async function closeOpenCashbox(user) {
  const operator = {
    id: user?.id,
    name: user?.name,
    role: user?.role
  };

  const caja = await closeCashbox({ operator });

  broadcastCashboxUpdate({
    type: 'cashbox:closed',
    source: 'manual'
  });

  return {
    item: caja
  };
}
