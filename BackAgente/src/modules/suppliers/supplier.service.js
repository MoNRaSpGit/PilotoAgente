import {
  assignSupplierToProduct,
  confirmSupplierOrderPickup,
  confirmSupplierOrderDraft,
  createSupplierOrder,
  createSupplierOrderDraft,
  createSupplier,
  deleteSupplierDraftItem,
  findProductById,
  findOpenSupplierDraftBySupplierId,
  findSupplierDraftItemById,
  findSupplierById,
  findSupplierOrderDraftById,
  findSupplierOrderById,
  listOpenSupplierOrderDrafts,
  listSupplierOrderDraftItemsByDraftId,
  listSupplierOrderItemsByOrderIds,
  listSupplierOrders,
  listSupplierOrdersByDateRange,
  listSupplierInvoiceIncidents,
  listProductsBySupplier,
  listSuppliers,
  listUnassignedCriticalProducts,
  receiveSupplierOrderAndApplyStock,
  upsertPendingSupplierOrderWithItems,
  updateSupplierDraftItemQuantity,
  upsertSupplierOrderDraftItem
} from './supplier.repository.js';
import { env } from '../../config/env.js';

function createServiceError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeCsvDays(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean).join(',');
  }
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .join(',');
}

function toISODate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function startOfWeek(dateString) {
  const baseDate = new Date(`${dateString}T00:00:00Z`);
  const dayIndex = baseDate.getUTCDay();
  const offset = (dayIndex + 6) % 7;
  baseDate.setUTCDate(baseDate.getUTCDate() - offset);
  return baseDate.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const baseDate = new Date(`${dateString}T00:00:00Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + days);
  return baseDate.toISOString().slice(0, 10);
}

function toMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function weekdayName(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const labels = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  return labels[date.getUTCDay()] || '';
}

function resolveBusinessDate(payload = {}) {
  return (
    toISODate(payload?.context_date)
    || toISODate(payload?.reference_date)
    || toISODate(payload?.today_date)
    || new Date().toISOString().slice(0, 10)
  );
}

function normalizeSupplierScheduleDays(csvValue) {
  return normalizeCsvDays(csvValue).split(',').filter(Boolean);
}

function normalizeOrderItems(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => {
    const productName = String(item?.product_name || item?.nombre || '').trim();
    if (!productName) {
      throw createServiceError(`Item ${index + 1}: nombre de producto requerido`, 400);
    }

    const quantity = Number(item?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw createServiceError(`Item ${index + 1}: cantidad invalida`, 400);
    }

    const unitCost = Number(item?.unit_cost);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw createServiceError(`Item ${index + 1}: costo unitario invalido`, 400);
    }

    const lineTotal = toMoney(quantity * unitCost);
    return {
      product_id: Number.isFinite(Number(item?.product_id)) && Number(item?.product_id) > 0
        ? Number(item.product_id)
        : null,
      product_name: productName,
      quantity: Number(quantity.toFixed(3)),
      unit_cost: toMoney(unitCost),
      line_total: lineTotal,
      notes: String(item?.notes || '').trim() || null
    };
  });
}

function toOrderItemViewModel(row) {
  return {
    id: Number(row.id),
    order_id: Number(row.order_id),
    product_id: row.product_id ? Number(row.product_id) : null,
    product_name: row.product_name,
    quantity: Number(row.quantity || 0),
    unit_cost: toMoney(row.unit_cost),
    line_total: toMoney(row.line_total),
    notes: row.notes || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function toDraftItemViewModel(row) {
  return {
    id: Number(row.id),
    draft_id: Number(row.draft_id),
    product_id: row.product_id ? Number(row.product_id) : null,
    product_name: row.product_name,
    quantity: Number(row.quantity || 0),
    unit_cost: toMoney(row.unit_cost),
    line_total: toMoney(row.line_total),
    source: row.source || 'stock_alert',
    notes: row.notes || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function toOrderViewModel(row, itemsByOrderId = new Map()) {
  const orderId = Number(row.id);
  const expectedAmount = toMoney(row.expected_amount);
  const invoiceAmount = row.invoice_amount === null || typeof row.invoice_amount === 'undefined'
    ? null
    : toMoney(row.invoice_amount);
  const invoiceDiff = row.invoice_diff === null || typeof row.invoice_diff === 'undefined'
    ? (invoiceAmount === null ? null : toMoney(invoiceAmount - expectedAmount))
    : toMoney(row.invoice_diff);

  return {
    id: orderId,
    supplier_id: Number(row.supplier_id),
    supplier_name: row.supplier_name,
    order_date: row.order_date,
    delivery_date: row.delivery_date,
    expected_amount: expectedAmount,
    invoice_amount: invoiceAmount,
    invoice_diff: invoiceDiff,
    invoice_reference: row.invoice_reference || null,
    has_invoice_mismatch: invoiceDiff !== null ? Math.abs(Number(invoiceDiff || 0)) > 0.009 : false,
    received_at: row.received_at || null,
    pickup_confirmed_at: row.pickup_confirmed_at || null,
    pickup_confirmed_by_name: row.pickup_confirmed_by_name || null,
    pickup_confirmed_by_role: row.pickup_confirmed_by_role || null,
    status: row.status,
    notes: row.notes || null,
    items: itemsByOrderId.get(orderId) || [],
    operator: {
      id: row.operator_id || null,
      name: row.operator_name || null,
      role: row.operator_role || null
    },
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function toSupplierViewModel(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono || null,
    email: row.email || null,
    dias_pedido: normalizeCsvDays(row.dias_pedido_csv).split(',').filter(Boolean),
    dias_entrega: normalizeCsvDays(row.dias_entrega_csv).split(',').filter(Boolean),
    estado: row.estado || 'activo',
    notas: row.notas || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function groupOrderItemsByOrderId(rows = []) {
  const map = new Map();

  for (const row of rows) {
    const orderId = Number(row.order_id);
    const current = map.get(orderId) || [];
    current.push(toOrderItemViewModel(row));
    map.set(orderId, current);
  }

  return map;
}

function groupOrdersByDate(orders = [], dateKey) {
  const map = new Map();

  for (const order of Array.isArray(orders) ? orders : []) {
    const date = String(order?.[dateKey] || '').trim();
    if (!date) {
      continue;
    }
    const current = map.get(date) || [];
    current.push(order);
    map.set(date, current);
  }

  return map;
}

async function attachOrderItems(rows = [], { includeItems = false } = {}) {
  if (!includeItems || !Array.isArray(rows) || rows.length === 0) {
    return new Map();
  }

  const orderIds = [...new Set(rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0))];
  if (orderIds.length === 0) {
    return new Map();
  }

  const itemRows = await listSupplierOrderItemsByOrderIds(orderIds);
  return groupOrderItemsByOrderId(itemRows);
}

export async function fetchSuppliers() {
  const rows = await listSuppliers();
  return {
    items: rows.map((row) => toSupplierViewModel(row))
  };
}

export async function createSupplierRecord(payload = {}) {
  const nombre = String(payload?.nombre || '').trim();
  if (!nombre) {
    throw createServiceError('Nombre de proveedor requerido', 400);
  }

  const created = await createSupplier({
    nombre,
    telefono: String(payload?.telefono || '').trim() || null,
    email: String(payload?.email || '').trim() || null,
    dias_pedido_csv: normalizeCsvDays(payload?.dias_pedido),
    dias_entrega_csv: normalizeCsvDays(payload?.dias_entrega),
    estado: String(payload?.estado || 'activo').trim() || 'activo',
    notas: String(payload?.notas || '').trim() || null
  });

  return {
    item: toSupplierViewModel(created)
  };
}

export async function linkSupplierToProduct({ productId, supplierId }) {
  const parsedProductId = Number.parseInt(productId, 10);
  const parsedSupplierId = Number.parseInt(supplierId, 10);

  if (!Number.isFinite(parsedProductId) || parsedProductId <= 0) {
    throw createServiceError('Producto invalido', 400);
  }

  if (!Number.isFinite(parsedSupplierId) || parsedSupplierId <= 0) {
    throw createServiceError('Proveedor invalido', 400);
  }

  const product = await findProductById(parsedProductId);
  if (!product) {
    throw createServiceError('Producto no encontrado', 404);
  }

  const supplier = await findSupplierById(parsedSupplierId);
  if (!supplier) {
    throw createServiceError('Proveedor no encontrado', 404);
  }

  const updated = await assignSupplierToProduct({
    productId: parsedProductId,
    supplierId: parsedSupplierId
  });

  return {
    item: updated
  };
}

export async function fetchProductsFromSupplier(supplierId) {
  const parsedSupplierId = Number.parseInt(supplierId, 10);
  if (!Number.isFinite(parsedSupplierId) || parsedSupplierId <= 0) {
    throw createServiceError('Proveedor invalido', 400);
  }

  const supplier = await findSupplierById(parsedSupplierId);
  if (!supplier) {
    throw createServiceError('Proveedor no encontrado', 404);
  }

  const products = await listProductsBySupplier(parsedSupplierId);

  return {
    supplier: toSupplierViewModel(supplier),
    items: products.map((product) => ({
      id: product.id,
      nombre: product.nombre,
      categoria: product.categoria || null,
      precio_venta: Number(product.precio_venta || 0),
      stock_actual: Number(product.stock_actual || 0),
      barcode: product.barcode_normalized || product.barcode || null,
      supplier_id: Number(product.supplier_id || 0)
    }))
  };
}

export async function fetchUnassignedCriticalSupplierProducts(query = {}) {
  const rows = await listUnassignedCriticalProducts({ limit: query?.limit });
  return {
    items: rows.map((row) => {
      const stockActual = Number(row.stock_actual || 0);
      return {
        id: Number(row.id),
        nombre: row.nombre || '',
        categoria: row.categoria || null,
        stock_actual: stockActual,
        precio_venta: Number(row.precio_venta || 0),
        barcode: row.barcode_normalized || row.barcode || null,
        status: stockActual <= 3 ? 'critical' : 'warning'
      };
    })
  };
}

export async function registerSupplierOrder(payload = {}, user = null) {
  const supplierId = Number.parseInt(payload?.supplier_id, 10);
  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    throw createServiceError('Proveedor invalido', 400);
  }

  const supplier = await findSupplierById(supplierId);
  if (!supplier) {
    throw createServiceError('Proveedor no encontrado', 404);
  }

  const items = normalizeOrderItems(payload?.items || []);
  const itemsTotal = toMoney(items.reduce((acc, item) => acc + Number(item.line_total || 0), 0));
  const explicitAmount = Number(payload?.expected_amount);
  const expectedAmount = items.length > 0
    ? itemsTotal
    : (Number.isFinite(explicitAmount) && explicitAmount > 0 ? toMoney(explicitAmount) : NaN);

  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
    throw createServiceError('Monto esperado invalido', 400);
  }

  const orderDate = toISODate(payload?.order_date) || new Date().toISOString().slice(0, 10);
  const deliveryDate = toISODate(payload?.delivery_date);
  if (!deliveryDate) {
    throw createServiceError('Fecha de llegada invalida', 400);
  }

  const created = await createSupplierOrder({
    supplier_id: supplierId,
    order_date: orderDate,
    delivery_date: deliveryDate,
    expected_amount: expectedAmount,
    status: 'pendiente',
    notes: String(payload?.notes || '').trim() || null,
    operator_id: user?.id || null,
    operator_name: user?.name || null,
    operator_role: user?.role || null,
    items
  });

  const itemsByOrderId = new Map([[Number(created.id), items]]);
  return {
    item: toOrderViewModel(created, itemsByOrderId)
  };
}

export async function upsertSupplierOrderFromProvider(payload = {}, user = null) {
  const supplierId = Number.parseInt(payload?.supplier_id, 10);
  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    throw createServiceError('Proveedor invalido', 400);
  }

  const supplier = await findSupplierById(supplierId);
  if (!supplier) {
    throw createServiceError('Proveedor no encontrado', 404);
  }

  const deliveryDate = toISODate(payload?.delivery_date);
  if (!deliveryDate) {
    throw createServiceError('Fecha de llegada invalida', 400);
  }

  const businessDate = resolveBusinessDate(payload);
  const orderDate = toISODate(payload?.order_date) || businessDate;
  if (deliveryDate < orderDate) {
    throw createServiceError('La fecha de llegada no puede ser menor a la fecha de pedido', 400);
  }

  const pickupDays = normalizeSupplierScheduleDays(supplier?.dias_pedido_csv);
  if (!env.suppliersTestMode && pickupDays.length > 0) {
    const orderDayName = weekdayName(orderDate);
    if (!pickupDays.includes(orderDayName)) {
      throw createServiceError(`No se puede confirmar pedido: ${supplier.nombre} no levanta los ${orderDayName}`, 409);
    }
  }

  const rawItems = Array.isArray(payload?.items) ? payload.items : [];
  if (!rawItems.length) {
    throw createServiceError('Debes incluir al menos un producto', 400);
  }

  const usedProductIds = new Set();
  const normalizedItems = [];
  for (let index = 0; index < rawItems.length; index += 1) {
    const item = rawItems[index];
    const productId = Number.parseInt(item?.product_id, 10);
    if (!Number.isFinite(productId) || productId <= 0) {
      throw createServiceError(`Item ${index + 1}: producto invalido`, 400);
    }
    if (usedProductIds.has(productId)) {
      throw createServiceError(`Item ${index + 1}: producto duplicado en el pedido`, 400);
    }
    usedProductIds.add(productId);

    const product = await findProductById(productId);
    if (!product) {
      throw createServiceError(`Item ${index + 1}: producto no encontrado`, 404);
    }
    if (!Number(product?.supplier_id)) {
      throw createServiceError(`Item ${index + 1}: el producto no tiene proveedor asignado`, 409);
    }
    if (Number(product.supplier_id) !== supplierId) {
      throw createServiceError(`Item ${index + 1}: el producto no pertenece al proveedor seleccionado`, 409);
    }

    const quantity = Number(item?.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw createServiceError(`Item ${index + 1}: cantidad invalida`, 400);
    }

    const unitCost = Number(item?.unit_cost);
    const fallbackUnitCost = Number(product?.precio_venta || 0);
    const safeUnitCost = Number.isFinite(unitCost) && unitCost >= 0
      ? unitCost
      : (Number.isFinite(fallbackUnitCost) && fallbackUnitCost >= 0 ? fallbackUnitCost : 0);
    const lineTotal = toMoney(quantity * safeUnitCost);

    normalizedItems.push({
      product_id: productId,
      product_name: product.nombre,
      quantity: Number(quantity.toFixed(3)),
      unit_cost: toMoney(safeUnitCost),
      line_total: lineTotal,
      notes: String(item?.notes || '').trim() || null
    });
  }

  const saved = await upsertPendingSupplierOrderWithItems({
    supplierId,
    orderDate,
    deliveryDate,
    notes: String(payload?.notes || '').trim() || null,
    operator: user,
    items: normalizedItems
  });

  const itemRows = (saved?.items || []).map((row) => toOrderItemViewModel(row));
  const orderId = Number(saved?.order?.id || 0);
  return {
    item: toOrderViewModel(saved.order, new Map([[orderId, itemRows]]))
  };
}

export async function fetchSupplierAgenda(query = {}) {
  const selectedDate = toISODate(query?.date) || new Date().toISOString().slice(0, 10);
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = addDays(weekStart, 6);

  const [deliveryRows, pickupRows] = await Promise.all([
    listSupplierOrdersByDateRange({
      fromDate: weekStart,
      toDate: weekEnd,
      status: 'pendiente',
      dateField: 'delivery_date'
    }),
    listSupplierOrdersByDateRange({
      fromDate: weekStart,
      toDate: weekEnd,
      status: 'pendiente',
      dateField: 'order_date'
    })
  ]);

  const rows = [...deliveryRows, ...pickupRows];
  const itemsByOrderId = await attachOrderItems(rows, { includeItems: true });

  const deliveryOrders = deliveryRows.map((row) => toOrderViewModel(row, itemsByOrderId));
  const pickupOrders = pickupRows.map((row) => toOrderViewModel(row, itemsByOrderId));
  const deliveryByDate = groupOrdersByDate(deliveryOrders, 'delivery_date');
  const pickupByDate = groupOrdersByDate(pickupOrders, 'order_date');
  const todayDeliveries = deliveryByDate.get(selectedDate) || [];
  const todayPickups = pickupByDate.get(selectedDate) || [];

  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)).map((date) => {
    const deliveries = deliveryByDate.get(date) || [];
    const pickups = pickupByDate.get(date) || [];

    return {
      date,
      day_name: weekdayName(date),
      total_amount: toMoney(deliveries.reduce((acc, item) => acc + Number(item.expected_amount || 0), 0)),
      delivery_total_amount: toMoney(deliveries.reduce((acc, item) => acc + Number(item.expected_amount || 0), 0)),
      pickup_total_amount: toMoney(pickups.reduce((acc, item) => acc + Number(item.expected_amount || 0), 0)),
      items: deliveries,
      delivery_items: deliveries,
      pickup_items: pickups
    };
  });

  return {
    selected_date: selectedDate,
    week_start: weekStart,
    week_end: weekEnd,
    today: {
      date: selectedDate,
      total_amount: toMoney(todayDeliveries.reduce((acc, item) => acc + Number(item.expected_amount || 0), 0)),
      delivery_total_amount: toMoney(todayDeliveries.reduce((acc, item) => acc + Number(item.expected_amount || 0), 0)),
      pickup_total_amount: toMoney(todayPickups.reduce((acc, item) => acc + Number(item.expected_amount || 0), 0)),
      items: todayDeliveries,
      delivery_items: todayDeliveries,
      pickup_items: todayPickups
    },
    week: weekDays
  };
}

export async function fetchRecentSupplierOrders(query = {}) {
  const rows = await listSupplierOrders({ limit: query?.limit });
  const itemsByOrderId = await attachOrderItems(rows, { includeItems: true });
  return {
    items: rows.map((row) => toOrderViewModel(row, itemsByOrderId))
  };
}

export async function fetchSupplierOrderDetail(orderId) {
  const parsedOrderId = Number.parseInt(orderId, 10);
  if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
    throw createServiceError('Pedido invalido', 400);
  }

  const order = await findSupplierOrderById(parsedOrderId);
  if (!order) {
    throw createServiceError('Pedido no encontrado', 404);
  }

  const itemRows = await listSupplierOrderItemsByOrderIds([parsedOrderId]);
  const itemsByOrderId = groupOrderItemsByOrderId(itemRows);

  return {
    item: toOrderViewModel(order, itemsByOrderId)
  };
}

export async function receiveSupplierOrder(orderId, payload = {}, user = null) {
  const parsedOrderId = Number.parseInt(orderId, 10);
  if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
    throw createServiceError('Pedido invalido', 400);
  }

  const order = await findSupplierOrderById(parsedOrderId);
  if (!order) {
    throw createServiceError('Pedido no encontrado', 404);
  }

  const businessDate = resolveBusinessDate(payload);
  if (String(order.delivery_date || '') > businessDate) {
    throw createServiceError(
      `No puedes confirmar esta entrega todavia. Disponible desde ${order.delivery_date}`,
      409
    );
  }

  const receivedItems = Array.isArray(payload?.items)
    ? payload.items.map((item, index) => {
      const itemId = Number.parseInt(item?.item_id, 10);
      const quantityReceived = Number(item?.quantity_received);
      if (!Number.isFinite(itemId) || itemId <= 0) {
        throw createServiceError(`Item ${index + 1}: item_id invalido`, 400);
      }
      if (!Number.isFinite(quantityReceived) || quantityReceived < 0) {
        throw createServiceError(`Item ${index + 1}: quantity_received invalida`, 400);
      }

      return {
        item_id: itemId,
        quantity_received: Number(quantityReceived.toFixed(3)),
        note: String(item?.note || item?.discrepancy_note || '').trim() || null
      };
    })
    : [];

  const rawInvoiceAmount = payload?.invoice_amount;
  const parsedInvoiceAmount = rawInvoiceAmount === '' || rawInvoiceAmount === null || typeof rawInvoiceAmount === 'undefined'
    ? null
    : Number(rawInvoiceAmount);
  if (parsedInvoiceAmount !== null && (!Number.isFinite(parsedInvoiceAmount) || parsedInvoiceAmount < 0)) {
    throw createServiceError('Monto de boleta invalido', 400);
  }
  const invoiceReference = String(payload?.invoice_reference || payload?.invoice_number || '').trim() || null;

  const received = await receiveSupplierOrderAndApplyStock({
    orderId: parsedOrderId,
    receivedItems,
    receivedBy: user,
    invoiceAmount: parsedInvoiceAmount,
    invoiceReference
  });

  if (!received) {
    throw createServiceError('Pedido no encontrado', 404);
  }

  if (received.already_received) {
    throw createServiceError('El pedido ya fue recibido y aplicado al stock', 409);
  }

  const itemRows = (received.items || []).map((row) => toOrderItemViewModel(row));
  const byOrderId = new Map([[parsedOrderId, itemRows]]);

  return {
    item: toOrderViewModel(received.order, byOrderId),
    stock_updates: received.stock_updates || []
  };
}

export async function fetchSupplierInvoiceIncidents(query = {}) {
  const date = toISODate(query?.date) || null;
  const rows = await listSupplierInvoiceIncidents({
    date,
    limit: query?.limit
  });

  return {
    date: date || new Date().toISOString().slice(0, 10),
    items: rows.map((row) => {
      const expectedAmount = toMoney(row.expected_amount);
      const invoiceAmount = row.invoice_amount === null || typeof row.invoice_amount === 'undefined'
        ? null
        : toMoney(row.invoice_amount);
      const invoiceDiff = row.invoice_diff === null || typeof row.invoice_diff === 'undefined'
        ? (invoiceAmount === null ? null : toMoney(invoiceAmount - expectedAmount))
        : toMoney(row.invoice_diff);

      const details = (Array.isArray(row.details) ? row.details : []).map((detail) => {
        const orderedQty = Number(detail.ordered_quantity || 0);
        const receivedQty = Number(detail.received_quantity || 0);
        const missingQty = Number((orderedQty - receivedQty).toFixed(3));
        return {
          id: Number(detail.id),
          order_id: Number(detail.order_id),
          order_item_id: Number(detail.order_item_id),
          product_id: detail.product_id ? Number(detail.product_id) : null,
          product_name: detail.product_name || '',
          ordered_quantity: orderedQty,
          received_quantity: receivedQty,
          missing_quantity: missingQty > 0 ? missingQty : 0,
          discrepancy_note: String(detail.discrepancy_note || '').trim() || null,
          created_at: detail.created_at || null
        };
      });

      return {
        id: Number(row.id),
        supplier_id: Number(row.supplier_id),
        supplier_name: row.supplier_name || '',
        order_date: row.order_date,
        delivery_date: row.delivery_date,
        received_at: row.received_at || null,
        expected_amount: expectedAmount,
        invoice_amount: invoiceAmount,
        invoice_diff: invoiceDiff,
        invoice_reference: row.invoice_reference || null,
        has_invoice_mismatch: invoiceDiff !== null ? Math.abs(Number(invoiceDiff || 0)) > 0.009 : false,
        has_quantity_mismatch: details.some((detail) => Number(detail.missing_quantity || 0) > 0),
        details
      };
    })
  };
}

export async function confirmSupplierPickup(orderId, user = null) {
  const parsedOrderId = Number.parseInt(orderId, 10);
  if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
    throw createServiceError('Pedido invalido', 400);
  }

  const confirmed = await confirmSupplierOrderPickup({
    orderId: parsedOrderId,
    confirmedBy: user
  });

  if (!confirmed) {
    throw createServiceError('Pedido no encontrado', 404);
  }
  if (confirmed.already_closed) {
    throw createServiceError('El pedido ya no esta pendiente', 409);
  }
  if (confirmed.already_confirmed) {
    throw createServiceError('El pedido ya fue confirmado por operario', 409);
  }

  const itemRows = await listSupplierOrderItemsByOrderIds([parsedOrderId]);
  const byOrderId = groupOrderItemsByOrderId(itemRows);

  return {
    item: toOrderViewModel(confirmed, byOrderId)
  };
}

export async function addSupplierDraftItemFromStock(payload = {}, user = null) {
  const supplierId = Number.parseInt(payload?.supplier_id, 10);
  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    throw createServiceError('Proveedor invalido', 400);
  }

  const supplier = await findSupplierById(supplierId);
  if (!supplier) {
    throw createServiceError('Proveedor no encontrado', 404);
  }

  const productId = Number.parseInt(payload?.product_id, 10);
  if (!Number.isFinite(productId) || productId <= 0) {
    throw createServiceError('Producto invalido', 400);
  }

  const product = await findProductById(productId);
  if (!product) {
    throw createServiceError('Producto no encontrado', 404);
  }

  const quantity = Number(payload?.quantity || payload?.suggested_quantity || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw createServiceError('Cantidad sugerida invalida', 400);
  }

  const unitCost = Number(payload?.unit_cost || 0);
  const safeUnitCost = Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0;
  const lineTotal = toMoney(quantity * safeUnitCost);

  let draft = await findOpenSupplierDraftBySupplierId(supplierId);
  if (!draft) {
    draft = await createSupplierOrderDraft({
      supplier_id: supplierId,
      source: 'stock',
      notes: String(payload?.draft_notes || '').trim() || 'Lista armada desde alertas de stock',
      operator_id: user?.id || null,
      operator_name: user?.name || null,
      operator_role: user?.role || null
    });
  }

  const rows = await upsertSupplierOrderDraftItem({
    draftId: Number(draft.id),
    productId: Number(product.id),
    productName: product.nombre,
    quantity: Number(quantity.toFixed(3)),
    unitCost: toMoney(safeUnitCost),
    lineTotal,
    source: 'stock_alert',
    notes: String(payload?.notes || '').trim() || null
  });

  const items = rows.map((row) => toDraftItemViewModel(row));
  return {
    item: {
      id: Number(draft.id),
      supplier_id: Number(draft.supplier_id),
      supplier_name: draft.supplier_name,
      status: draft.status || 'open',
      source: draft.source || 'stock',
      notes: draft.notes || null,
      items,
      total_amount: toMoney(items.reduce((acc, item) => acc + Number(item.line_total || 0), 0)),
      total_items: items.length
    }
  };
}

export async function fetchOpenSupplierDrafts() {
  const drafts = await listOpenSupplierOrderDrafts();
  const itemsPromises = drafts.map((draft) => listSupplierOrderDraftItemsByDraftId(Number(draft.id)));
  const itemCollections = await Promise.all(itemsPromises);

  const itemsByDraftId = new Map();
  drafts.forEach((draft, index) => {
    itemsByDraftId.set(Number(draft.id), (itemCollections[index] || []).map((row) => toDraftItemViewModel(row)));
  });

  return {
    items: drafts.map((draft) => {
      const draftItems = itemsByDraftId.get(Number(draft.id)) || [];
      return {
        id: Number(draft.id),
        supplier_id: Number(draft.supplier_id),
        supplier_name: draft.supplier_name,
        status: draft.status || 'open',
        source: draft.source || 'stock',
        notes: draft.notes || null,
        items: draftItems,
        total_amount: toMoney(draftItems.reduce((acc, item) => acc + Number(item.line_total || 0), 0)),
        total_items: draftItems.length,
        created_at: draft.created_at || null,
        updated_at: draft.updated_at || null
      };
    })
  };
}

export async function confirmSupplierDraft(draftId, payload = {}, user = null) {
  const parsedDraftId = Number.parseInt(draftId, 10);
  if (!Number.isFinite(parsedDraftId) || parsedDraftId <= 0) {
    throw createServiceError('Borrador invalido', 400);
  }

  const existingDraft = await findSupplierOrderDraftById(parsedDraftId);
  if (!existingDraft) {
    throw createServiceError('Borrador no encontrado', 404);
  }
  if (existingDraft.status !== 'open') {
    throw createServiceError('El borrador ya fue confirmado', 409);
  }

  const orderDate = toISODate(payload?.order_date) || new Date().toISOString().slice(0, 10);
  const deliveryDate = toISODate(payload?.delivery_date);
  if (!deliveryDate) {
    throw createServiceError('Fecha de llegada invalida', 400);
  }

  const confirmed = await confirmSupplierOrderDraft({
    draftId: parsedDraftId,
    orderDate,
    deliveryDate,
    notes: String(payload?.notes || '').trim() || null,
    operator: user
  });

  if (!confirmed) {
    throw createServiceError('No se pudo confirmar el borrador', 500);
  }
  if (confirmed.empty_draft) {
    throw createServiceError('El borrador no tiene items', 400);
  }
  if (confirmed.already_confirmed) {
    throw createServiceError('El borrador ya fue confirmado', 409);
  }

  const orderId = Number(confirmed.order?.id || 0);
  const items = (confirmed.items || []).map((item) => ({
    ...toOrderItemViewModel({
      ...item,
      order_id: orderId
    })
  }));

  return {
    item: toOrderViewModel(confirmed.order, new Map([[orderId, items]])),
    draft: {
      id: Number(confirmed.draft?.id || parsedDraftId),
      status: 'confirmed'
    }
  };
}

export async function changeSupplierDraftItemQuantity({ draftId, itemId, quantity }) {
  const parsedDraftId = Number.parseInt(draftId, 10);
  const parsedItemId = Number.parseInt(itemId, 10);
  const parsedQuantity = Number(quantity);

  if (!Number.isFinite(parsedDraftId) || parsedDraftId <= 0) {
    throw createServiceError('Borrador invalido', 400);
  }
  if (!Number.isFinite(parsedItemId) || parsedItemId <= 0) {
    throw createServiceError('Item invalido', 400);
  }
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    throw createServiceError('Cantidad invalida', 400);
  }

  const draft = await findSupplierOrderDraftById(parsedDraftId);
  if (!draft) {
    throw createServiceError('Borrador no encontrado', 404);
  }
  if (draft.status !== 'open') {
    throw createServiceError('Solo se puede editar borrador abierto', 409);
  }

  const existingItem = await findSupplierDraftItemById(parsedDraftId, parsedItemId);
  if (!existingItem) {
    throw createServiceError('Item no encontrado', 404);
  }

  const updated = await updateSupplierDraftItemQuantity({
    draftId: parsedDraftId,
    itemId: parsedItemId,
    quantity: Number(parsedQuantity.toFixed(3))
  });
  if (!updated) {
    throw createServiceError('No se pudo actualizar item', 500);
  }

  return {
    item: toDraftItemViewModel(updated)
  };
}

export async function removeSupplierDraftItem({ draftId, itemId }) {
  const parsedDraftId = Number.parseInt(draftId, 10);
  const parsedItemId = Number.parseInt(itemId, 10);

  if (!Number.isFinite(parsedDraftId) || parsedDraftId <= 0) {
    throw createServiceError('Borrador invalido', 400);
  }
  if (!Number.isFinite(parsedItemId) || parsedItemId <= 0) {
    throw createServiceError('Item invalido', 400);
  }

  const draft = await findSupplierOrderDraftById(parsedDraftId);
  if (!draft) {
    throw createServiceError('Borrador no encontrado', 404);
  }
  if (draft.status !== 'open') {
    throw createServiceError('Solo se puede editar borrador abierto', 409);
  }

  const removed = await deleteSupplierDraftItem({
    draftId: parsedDraftId,
    itemId: parsedItemId
  });
  if (!removed) {
    throw createServiceError('Item no encontrado', 404);
  }

  return {
    item: {
      id: parsedItemId,
      deleted: true
    }
  };
}
