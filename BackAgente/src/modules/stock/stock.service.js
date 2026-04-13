import {
  applySaleDiscountByBarcode,
  findProductForStockById,
  findStockControlById,
  listSoldQuantityByProductSince,
  listStockControls,
  seedSupplierStockDemoData,
  searchProductsForStock,
  updateProductStockByDelta,
  upsertStockControl
} from './stock.repository.js';
import { normalizeBarcode } from '../../utils/productCache.js';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const VALID_DAYS = new Set(DAYS);

function createServiceError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parsePositiveInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizeDayArray(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

  const normalized = values
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter((entry) => VALID_DAYS.has(entry));

  return [...new Set(normalized)];
}

function toDaysCsv(value) {
  return normalizeDayArray(value).join(',');
}

function fromDaysCsv(value) {
  return normalizeDayArray(String(value || ''));
}

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function weekdayIndex(day) {
  return DAYS.indexOf(day);
}

function getDaysUntilNextDelivery(deliveryDays = [], baseDate = new Date()) {
  if (!Array.isArray(deliveryDays) || deliveryDays.length === 0) {
    return null;
  }

  const todayIndex = baseDate.getDay();
  const targetIndexes = deliveryDays.map((day) => weekdayIndex(day)).filter((index) => index >= 0);

  if (!targetIndexes.length) {
    return null;
  }

  let minDistance = 7;
  for (const targetIndex of targetIndexes) {
    const distance = (targetIndex - todayIndex + 7) % 7;
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

function statusLevel({ stockActual, criticalThreshold, warningThreshold, projectedRemaining, targetLeftover }) {
  if (stockActual <= criticalThreshold || projectedRemaining < 0) {
    return 'critical';
  }

  if (stockActual <= warningThreshold || projectedRemaining <= targetLeftover) {
    return 'warning';
  }

  return 'ok';
}

function toControlViewModel(row) {
  const deliveryDays = fromDaysCsv(row.delivery_days_csv);
  const orderDays = fromDaysCsv(row.order_days_csv);

  return {
    id: row.id,
    active: Boolean(row.active),
    is_test_data: Boolean(row.is_test_data),
    product: {
      id: row.product_id,
      name: row.product_name,
      category: row.product_category || '',
      barcode: row.product_barcode_normalized || row.product_barcode || null,
      supplier_id: row.product_supplier_id ? Number(row.product_supplier_id) : null,
      supplier_name: row.product_supplier_name || null,
      stock_actual: Number(row.stock_actual || 0)
    },
    supplier_name: row.product_supplier_name || row.supplier_name || '',
    order_days: orderDays,
    delivery_days: deliveryDays,
    thresholds: {
      critical: Number(row.critical_threshold || 0),
      warning: Number(row.warning_threshold || 0),
      target_leftover: Number(row.target_leftover || 0)
    },
    notes: row.notes || '',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

export async function fetchStockControls(query = {}) {
  const rows = await listStockControls({
    activeOnly: parseBoolean(query?.active_only || query?.activeOnly, false),
    testOnly: parseBoolean(query?.test_only || query?.testOnly, false)
  });
  return {
    items: rows.map((row) => toControlViewModel(row))
  };
}

export async function searchProductsForStockControl(query = {}) {
  const rows = await searchProductsForStock({
    query: query?.query,
    limit: query?.limit
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.nombre,
      category: row.categoria || '',
      barcode: row.barcode_normalized || row.barcode || null,
      stock_actual: Number(row.stock_actual || 0),
      supplier_id: Number(row.supplier_id || 0),
      supplier_name: row.supplier_name || null
    }))
  };
}

export async function saveStockControl(payload = {}) {
  const productId = parsePositiveInt(payload.product_id, 0);
  if (!productId) {
    throw createServiceError('Producto requerido', 400);
  }

  const product = await findProductForStockById(productId);
  if (!product) {
    throw createServiceError('Producto no encontrado', 404);
  }
  if (!Number(product.supplier_id)) {
    throw createServiceError('Solo se permite control de stock para productos con proveedor', 400);
  }

  const critical = parsePositiveInt(payload.critical_threshold, 1);
  const warning = parsePositiveInt(payload.warning_threshold, 4);
  const targetLeftover = parsePositiveInt(payload.target_leftover, 2);

  const normalizedPayload = {
    product_id: product.id,
    active: payload.active === undefined ? true : Boolean(payload.active),
    is_test_data: payload.is_test_data === undefined ? true : Boolean(payload.is_test_data),
    supplier_name: String(payload.supplier_name || '').trim(),
    order_days_csv: toDaysCsv(payload.order_days),
    delivery_days_csv: toDaysCsv(payload.delivery_days),
    critical_threshold: critical,
    warning_threshold: Math.max(critical, warning),
    target_leftover: targetLeftover,
    notes: String(payload.notes || '').trim()
  };

  const saved = await upsertStockControl(normalizedPayload);
  if (!saved) {
    throw createServiceError('No se pudo guardar la configuracion de stock', 500);
  }

  return {
    item: toControlViewModel(saved)
  };
}

export async function addManualStockEntry(payload = {}, user = null) {
  const quantity = parsePositiveInt(payload.quantity, 0);
  if (!quantity) {
    throw createServiceError('Cantidad valida requerida', 400);
  }

  let productId = parsePositiveInt(payload.product_id, 0);

  if (!productId && payload.stock_control_id) {
    const config = await findStockControlById(parsePositiveInt(payload.stock_control_id, 0));
    if (!config) {
      throw createServiceError('Control de stock no encontrado', 404);
    }
    productId = Number(config.product_id || 0);
  }

  if (!productId) {
    throw createServiceError('Producto requerido', 400);
  }

  const product = await findProductForStockById(productId);
  if (!product) {
    throw createServiceError('Producto no encontrado', 404);
  }

  const notes = String(payload.notes || '').trim() || 'Ingreso manual de mercaderia';
  const movement = await updateProductStockByDelta({
    productId: product.id,
    quantityDelta: quantity,
    type: 'restock',
    referenceType: 'manual',
    referenceId: null,
    notes,
    operator: user
  });

  if (!movement) {
    throw createServiceError('No se pudo actualizar stock', 500);
  }

  return {
    item: {
      product_id: product.id,
      product_name: product.nombre,
      quantity_added: quantity,
      stock_after: movement.quantity_after
    }
  };
}

export async function fetchStockDashboard(query = {}) {
  const includeHealthy = String(query?.include_healthy || query?.includeHealthy || '').trim().toLowerCase() === 'true';
  const testOnly = parseBoolean(query?.test_only || query?.testOnly, false);
  const controls = await listStockControls({ activeOnly: true, testOnly });
  const controlModels = controls.map((row) => toControlViewModel(row));

  const productIds = controlModels.map((entry) => entry.product.id);
  const now = new Date();
  const sinceDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const soldRows = await listSoldQuantityByProductSince({
    productIds,
    sinceDate
  });
  const soldByProduct = new Map(
    soldRows.map((row) => [Number(row.product_id), Number(row.sold_quantity || 0)])
  );
  const todayName = DAYS[now.getDay()];

  const items = controlModels.map((entry) => {
    const soldLast14 = Number(soldByProduct.get(entry.product.id) || 0);
    const dailyAverage = round2(soldLast14 / 14);
    const daysUntilDelivery = getDaysUntilNextDelivery(entry.delivery_days, now);
    const projectedRemaining = daysUntilDelivery === null
      ? Number(entry.product.stock_actual || 0)
      : round2(Number(entry.product.stock_actual || 0) - dailyAverage * daysUntilDelivery);
    const suggestedPurchase = daysUntilDelivery === null
      ? 0
      : Math.max(
        0,
        Math.ceil(dailyAverage * daysUntilDelivery + entry.thresholds.target_leftover - Number(entry.product.stock_actual || 0))
      );
    const status = statusLevel({
      stockActual: Number(entry.product.stock_actual || 0),
      criticalThreshold: entry.thresholds.critical,
      warningThreshold: entry.thresholds.warning,
      projectedRemaining,
      targetLeftover: entry.thresholds.target_leftover
    });

    return {
      ...entry,
      metrics: {
        sold_last_14_days: soldLast14,
        daily_average: dailyAverage,
        days_until_next_delivery: daysUntilDelivery,
        projected_remaining_next_delivery: projectedRemaining,
        suggested_purchase: suggestedPurchase
      },
      status,
      arrives_today: entry.delivery_days.includes(todayName)
    };
  });

  const filteredItems = includeHealthy ? items : items.filter((item) => item.status !== 'ok');
  const expectedToday = items.filter((item) => item.arrives_today);

  return {
    generated_at: new Date().toISOString(),
    totals: {
      tracked: items.length,
      critical: items.filter((item) => item.status === 'critical').length,
      warning: items.filter((item) => item.status === 'warning').length,
      alerts: items.filter((item) => item.status !== 'ok').length
    },
    expected_today: expectedToday,
    items: filteredItems
  };
}

export function queueSaleStockDiscount({ items = [], movementId = null, operator = null } = {}) {
  const barcodeToQuantityMap = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const rawBarcode = normalizeBarcode(item?.barcode || '');
    if (!rawBarcode || rawBarcode.toLowerCase().startsWith('manual')) {
      continue;
    }

    const quantity = parsePositiveInt(item?.quantity, 0);
    if (!quantity) {
      continue;
    }

    const current = barcodeToQuantityMap.get(rawBarcode) || 0;
    barcodeToQuantityMap.set(rawBarcode, current + quantity);
  }

  if (!barcodeToQuantityMap.size) {
    return;
  }

  setImmediate(() => {
    applySaleDiscountByBarcode({
      barcodeToQuantityMap,
      referenceId: movementId,
      operator
    }).catch((error) => {
      console.error('[stock] Error al descontar stock por venta:', error?.message || error);
    });
  });
}

export async function seedSupplierStockDemo(options = {}) {
  const applied = await seedSupplierStockDemoData({
    limit: options?.limit
  });
  return {
    items: applied
  };
}
