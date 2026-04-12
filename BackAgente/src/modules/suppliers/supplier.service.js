import {
  assignSupplierToProduct,
  createSupplierOrder,
  createSupplier,
  findProductById,
  findSupplierById,
  listSupplierOrders,
  listSupplierOrdersByDateRange,
  listProductsBySupplier,
  listSuppliers
} from './supplier.repository.js';

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

function toOrderViewModel(row) {
  return {
    id: Number(row.id),
    supplier_id: Number(row.supplier_id),
    supplier_name: row.supplier_name,
    order_date: row.order_date,
    delivery_date: row.delivery_date,
    expected_amount: toMoney(row.expected_amount),
    status: row.status,
    notes: row.notes || null,
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

export async function registerSupplierOrder(payload = {}, user = null) {
  const supplierId = Number.parseInt(payload?.supplier_id, 10);
  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    throw createServiceError('Proveedor invalido', 400);
  }

  const supplier = await findSupplierById(supplierId);
  if (!supplier) {
    throw createServiceError('Proveedor no encontrado', 404);
  }

  const expectedAmount = Number(payload?.expected_amount);
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
    expected_amount: toMoney(expectedAmount),
    status: 'pendiente',
    notes: String(payload?.notes || '').trim() || null,
    operator_id: user?.id || null,
    operator_name: user?.name || null,
    operator_role: user?.role || null
  });

  return {
    item: toOrderViewModel(created)
  };
}

export async function fetchSupplierAgenda(query = {}) {
  const selectedDate = toISODate(query?.date) || new Date().toISOString().slice(0, 10);
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = addDays(weekStart, 6);

  const rows = await listSupplierOrdersByDateRange({
    fromDate: weekStart,
    toDate: weekEnd,
    status: 'pendiente'
  });

  const orders = rows.map((row) => toOrderViewModel(row));
  const todayItems = orders.filter((item) => item.delivery_date === selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)).map((date) => {
    const items = orders.filter((item) => item.delivery_date === date);
    return {
      date,
      day_name: weekdayName(date),
      total_amount: toMoney(items.reduce((acc, item) => acc + Number(item.expected_amount || 0), 0)),
      items
    };
  });

  return {
    selected_date: selectedDate,
    week_start: weekStart,
    week_end: weekEnd,
    today: {
      date: selectedDate,
      total_amount: toMoney(todayItems.reduce((acc, item) => acc + Number(item.expected_amount || 0), 0)),
      items: todayItems
    },
    week: weekDays
  };
}

export async function fetchRecentSupplierOrders(query = {}) {
  const rows = await listSupplierOrders({ limit: query?.limit });
  return {
    items: rows.map((row) => toOrderViewModel(row))
  };
}
