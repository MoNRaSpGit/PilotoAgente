import {
  createCashbox,
  closeCashbox,
  getCashboxObjectivesSummary,
  getCashboxSummary,
  listCashboxSaleMovements,
  recordCashboxPayment,
  recordCashboxSale
} from './caja.repository.js';
import { broadcastCashboxUpdate } from './caja.realtime.js';
import { getScannerLiveState, saveScannerLiveState } from './scannerLiveState.store.js';
import { performance } from 'node:perf_hooks';
import { env } from '../../config/env.js';

let stockDiscountModulePromise = null;

async function queueSaleStockDiscountSafe(payload) {
  if (!stockDiscountModulePromise) {
    stockDiscountModulePromise = import('../stock/stock.service.js')
      .then((module) => module?.queueSaleStockDiscount || null)
      .catch(() => null);
  }

  const queueSaleStockDiscount = await stockDiscountModulePromise;

  if (typeof queueSaleStockDiscount !== 'function') {
    return;
  }

  queueSaleStockDiscount(payload);
}

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

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function resolveGoalLevel(currentSales, standardAmount, objectiveAmount, recordAmount) {
  const hasStandard = Number.isFinite(standardAmount) && standardAmount > 0;
  const hasObjective = Number.isFinite(objectiveAmount) && objectiveAmount > 0;
  const hasRecord = Number.isFinite(recordAmount) && recordAmount > 0;

  if (hasRecord && currentSales >= recordAmount) {
    return {
      key: 'record',
      label: 'Record alcanzado'
    };
  }

  if (hasObjective && currentSales >= objectiveAmount) {
    return {
      key: 'objetivo',
      label: 'Objetivo alcanzado'
    };
  }

  if (hasStandard && currentSales >= standardAmount) {
    return {
      key: 'estandar',
      label: 'Nivel estandar alcanzado'
    };
  }

  return {
    key: 'en_curso',
    label: 'En curso'
  };
}

export async function fetchCashboxObjectives(query = {}) {
  const summary = await getCashboxObjectivesSummary({
    date: query?.date,
    compareTo: query?.compare_to || query?.compareTo
  });

  const openingAmount = roundMoney(summary?.selected_day?.opening_amount);
  const dailySales = roundMoney(summary?.selected_day?.sales_total);
  const yesterdaySales = roundMoney(summary?.previous_day?.sales_total);
  const standardAmount = roundMoney(env.objectivesStandardAmount);
  const recordExtraAmount = roundMoney(env.objectivesRecordExtraAmount);
  const objectiveAmount = yesterdaySales;
  const recordAmount = roundMoney(objectiveAmount + recordExtraAmount);

  const level = resolveGoalLevel(dailySales, standardAmount, objectiveAmount, recordAmount);

  return {
    selected_date: summary?.selected_date || null,
    comparison_date: summary?.comparison_date || null,
    is_open: Boolean(summary?.is_open),
    cashbox: {
      opening_amount: openingAmount,
      daily_sales: dailySales,
      comparison_percent: summary?.comparison_percent ?? null
    },
    goals: {
      standard: standardAmount,
      objective: objectiveAmount,
      record: recordAmount,
      record_extra: recordExtraAmount
    },
    progress: {
      level: level.key,
      level_label: level.label,
      current_sales: dailySales,
      remaining_to_standard: Math.max(0, roundMoney(standardAmount - dailySales)),
      remaining_to_objective: Math.max(0, roundMoney(objectiveAmount - dailySales)),
      remaining_to_record: Math.max(0, roundMoney(recordAmount - dailySales))
    }
  };
}

export async function fetchCashboxMovements(query = {}) {
  const rawLimit = query?.limit;
  const limit = rawLimit === 'all' ? null : rawLimit;
  return listCashboxSaleMovements({
    date: query?.date,
    limit
  });
}

export async function fetchScannerLiveState(user, query = {}) {
  return {
    item: getScannerLiveState(user, {
      scope: query?.scope
    })
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
  const startedAt = performance.now();
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

  const registerSaleStartedAt = performance.now();
  const result = await recordCashboxSale({
    amount,
    items,
    source: payload?.source || 'scanner',
    description: payload?.description || 'Venta desde escaner',
    operator,
    includeCashbox: false
  });
  const registerSaleMs = Number((performance.now() - registerSaleStartedAt).toFixed(2));

  let clearLiveStateMs = 0;
  if (shouldClearLiveState) {
    const clearLiveStateStartedAt = performance.now();
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
    clearLiveStateMs = Number((performance.now() - clearLiveStateStartedAt).toFixed(2));
  }

  const broadcastStartedAt = performance.now();
  broadcastCashboxUpdate({
    type: 'sale',
    source: payload?.source || 'scanner',
    description: payload?.description || 'Venta desde escaner',
    amount,
    items,
    operator,
    caja_id: result.caja_id,
    movement_id: result.movement_id
  });
  const broadcastMs = Number((performance.now() - broadcastStartedAt).toFixed(2));
  const totalMs = Number((performance.now() - startedAt).toFixed(2));

  void queueSaleStockDiscountSafe({
    items,
    movementId: result.movement_id,
    operator
  });

  return {
    item: result.caja || null,
    movement_id: result.movement_id,
    meta: {
      total_ms: totalMs,
      register_sale_ms: registerSaleMs,
      clear_live_state_ms: clearLiveStateMs,
      broadcast_ms: broadcastMs
    }
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
