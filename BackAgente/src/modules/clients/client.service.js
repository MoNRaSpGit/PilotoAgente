import {
  insertClient,
  insertClientHistoryEntries,
  listClients,
  listClientHistory,
  updateClientChargeById,
  updateClientDeliveryById,
  updateClientPaymentById
} from './client.repository.js';

function normalizeDateInput(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const baseDate = new Date(`${dateString}T00:00:00`);
  baseDate.setDate(baseDate.getDate() + days);
  return baseDate.toISOString().slice(0, 10);
}

function diffDays(fromDateString, toDateString) {
  const fromDate = new Date(`${fromDateString}T00:00:00`);
  const toDate = new Date(`${toDateString}T00:00:00`);
  return Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24));
}

function deriveStatus(daysRemaining) {
  if (daysRemaining < 0) {
    return 'vencido';
  }

  if (daysRemaining <= 10) {
    return 'alerta';
  }

  return 'al-dia';
}

function toClientViewModel(row) {
  const today = new Date().toISOString().slice(0, 10);
  const daysRemaining = diffDays(today, row.fecha_vencimiento);
  const saldo = Number(row.saldo);
  const entregasCount = Number(row.entregas_count || 0);

  return {
    ...row,
    saldo,
    entregas_count: entregasCount,
    days_remaining: daysRemaining,
    status: entregasCount > 0 && saldo > 0 ? 'entrega' : deriveStatus(daysRemaining)
  };
}

function createServiceError(message, status, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

export async function getClients() {
  const items = await listClients();
  return {
    count: items.length,
    items: items.map(toClientViewModel)
  };
}

export async function createClient(payload) {
  const nombre = String(payload?.nombre || '').trim();
  const saldo = Number(payload?.saldo ?? 0);
  const ultimaFechaPago = normalizeDateInput(payload?.ultima_fecha_pago) || new Date().toISOString().slice(0, 10);
  const fechaVencimiento = normalizeDateInput(payload?.fecha_vencimiento) || addDays(ultimaFechaPago, 30);

  if (!nombre) {
    throw createServiceError('Nombre requerido', 400);
  }

  if (!Number.isFinite(saldo) || saldo < 0) {
    throw createServiceError('Saldo valido requerido', 400);
  }

  const item = await insertClient({
    nombre,
    saldo,
    ultimaFechaPago,
    fechaVencimiento
  });

  if (!item) {
    throw createServiceError('No se pudo crear el cliente', 500);
  }

  return {
    item: toClientViewModel(item)
  };
}

export async function updateClientPayment(clientId, payload) {
  const parsedClientId = Number(clientId);

  if (!Number.isFinite(parsedClientId) || parsedClientId <= 0) {
    throw createServiceError('Cliente invalido', 400);
  }

  const ultimaFechaPago = normalizeDateInput(payload?.ultima_fecha_pago) || new Date().toISOString().slice(0, 10);
  const fechaVencimiento = normalizeDateInput(payload?.fecha_vencimiento) || addDays(ultimaFechaPago, 30);

  const item = await updateClientPaymentById({
    clientId: parsedClientId,
    ultimaFechaPago,
    fechaVencimiento
  });

  if (!item) {
    throw createServiceError('Cliente no encontrado', 404);
  }

  return {
    item: toClientViewModel(item)
  };
}

export async function updateClientDelivery(clientId, payload) {
  const parsedClientId = Number(clientId);

  if (!Number.isFinite(parsedClientId) || parsedClientId <= 0) {
    throw createServiceError('Cliente invalido', 400);
  }

  const entregaMonto = Number(payload?.entrega ?? payload?.entrega_monto ?? 0);

  if (!Number.isFinite(entregaMonto) || entregaMonto <= 0) {
    throw createServiceError('Entrega valida requerida', 400);
  }

  const ultimaFechaPago = normalizeDateInput(payload?.ultima_fecha_pago) || new Date().toISOString().slice(0, 10);
  const fechaVencimiento = normalizeDateInput(payload?.fecha_vencimiento) || addDays(ultimaFechaPago, 30);

  const item = await updateClientDeliveryById({
    clientId: parsedClientId,
    entregaMonto,
    ultimaFechaPago,
    fechaVencimiento
  });

  if (!item) {
    throw createServiceError('Cliente no encontrado', 404);
  }

  return {
    item: toClientViewModel(item)
  };
}

export async function updateClientCharge(clientId, payload) {
  const parsedClientId = Number(clientId);

  if (!Number.isFinite(parsedClientId) || parsedClientId <= 0) {
    throw createServiceError('Cliente invalido', 400);
  }

  const chargeAmount = Number(payload?.charge_amount ?? payload?.amount ?? 0);
  const chargeItems = Array.isArray(payload?.items) ? payload.items : [];

  if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
    throw createServiceError('Monto valido requerido', 400);
  }

  const ultimaFechaPago = normalizeDateInput(payload?.ultima_fecha_pago) || new Date().toISOString().slice(0, 10);
  const fechaVencimiento = normalizeDateInput(payload?.fecha_vencimiento) || addDays(ultimaFechaPago, 30);

  const item = await updateClientChargeById({
    clientId: parsedClientId,
    chargeAmount,
    ultimaFechaPago,
    fechaVencimiento
  });

  if (!item) {
    throw createServiceError('Cliente no encontrado', 404);
  }

  await insertClientHistoryEntries({
    clientId: parsedClientId,
    items: chargeItems,
    fechaMovimiento: ultimaFechaPago,
    detalle: 'Cargo desde escaner'
  });

  return {
    item: toClientViewModel(item)
  };
}

export async function getClientHistory(clientId, query = {}) {
  const parsedClientId = Number(clientId);

  if (!Number.isFinite(parsedClientId) || parsedClientId <= 0) {
    throw createServiceError('Cliente invalido', 400);
  }

  const fromDate = normalizeDateInput(query.from || query.start);
  const toDate = normalizeDateInput(query.to || query.end) || new Date().toISOString().slice(0, 10);

  const items = await listClientHistory({
    clientId: parsedClientId,
    fromDate,
    toDate
  });

  return {
    count: items.length,
    items: items.map((row) => ({
      ...row,
      cantidad: Number(row.cantidad),
      precio_unitario: Number(row.precio_unitario),
      total: Number(row.total)
    }))
  };
}
