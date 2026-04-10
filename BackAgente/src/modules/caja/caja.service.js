import {
  createCashbox,
  closeCashbox,
  getCashboxSummary,
  recordCashboxPayment,
  recordCashboxSale
} from './caja.repository.js';
import { broadcastCashboxUpdate } from './caja.realtime.js';

function createServiceError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
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

  broadcastCashboxUpdate({
    type: 'cashbox:sale',
    source: payload?.source || 'scanner'
  });

  return {
    item: result.caja
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
