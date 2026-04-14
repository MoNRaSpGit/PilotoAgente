import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchSupplierOrders,
  fetchSupplierProducts,
  fetchSuppliers,
  fetchSuppliersAgenda,
  receiveSupplierOrder,
  upsertSupplierOrderFromProvider
} from '../../services/api';
import {
  addDays,
  formatMoney,
  getLocalISODate,
  getSpanishDayName,
  INITIAL_SUPPLIERS_AGENDA,
  normalizeISODate,
  parseCsvDays
} from './suppliersPage.utils';

function statusRank(status) {
  if (status === 'critical') {
    return 0;
  }
  if (status === 'warning') {
    return 1;
  }
  return 2;
}

function normalizeOrderStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function parseOrderTimestamp(order) {
  const updatedAt = String(order?.updated_at || '').trim();
  const createdAt = String(order?.created_at || '').trim();
  const value = updatedAt || createdAt;
  if (!value) {
    return 0;
  }
  const timestamp = Date.parse(value.replace(' ', 'T'));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function selectMostRelevantOrder(orders = []) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return null;
  }

  const pendingOrders = orders.filter((order) => normalizeOrderStatus(order?.status) === 'pendiente');
  if (!pendingOrders.length) {
    return null;
  }

  const sorted = [...pendingOrders].sort((a, b) => {
    const aPending = normalizeOrderStatus(a?.status) === 'pendiente' ? 0 : 1;
    const bPending = normalizeOrderStatus(b?.status) === 'pendiente' ? 0 : 1;
    if (aPending !== bPending) {
      return aPending - bPending;
    }

    const byTimestamp = parseOrderTimestamp(b) - parseOrderTimestamp(a);
    if (byTimestamp !== 0) {
      return byTimestamp;
    }

    return Number(b?.id || 0) - Number(a?.id || 0);
  });

  return sorted[0] || null;
}

export function useSuppliersPageController() {
  const realToday = getLocalISODate();
  const [loading, setLoading] = useState(true);
  const [simulatedDate, setSimulatedDate] = useState(realToday);
  const [suppliers, setSuppliers] = useState([]);
  const [agenda, setAgenda] = useState(INITIAL_SUPPLIERS_AGENDA(realToday));
  const [recentOrders, setRecentOrders] = useState([]);
  const [quantityOverrides, setQuantityOverrides] = useState({});
  const [confirmedOrderOverrides, setConfirmedOrderOverrides] = useState({});
  const [confirmingWeekSupplierId, setConfirmingWeekSupplierId] = useState(null);
  const [receivingOrderId, setReceivingOrderId] = useState(null);
  const [receivedQtyOverrides, setReceivedQtyOverrides] = useState({});
  const [selectedDaySupplierProducts, setSelectedDaySupplierProducts] = useState([]);
  const [loadingDaySupplierProducts, setLoadingDaySupplierProducts] = useState(false);
  const [selectedDaySupplier, setSelectedDaySupplier] = useState(null);
  const suppliersLoadedRef = useRef(false);
  const recentOrdersLoadedRef = useRef(false);
  const productsBySupplierRef = useRef(new Map());
  const effectiveToday = normalizeISODate(simulatedDate || realToday);

  const loadData = useCallback(async (dateToLoad, options = {}) => {
    const targetDate = normalizeISODate(dateToLoad || simulatedDate || realToday);
    const forceSuppliersRefresh = Boolean(options?.forceSuppliersRefresh);
    const forceRecentOrdersRefresh = Boolean(options?.forceRecentOrdersRefresh);
    const shouldFetchSuppliers = forceSuppliersRefresh || !suppliersLoadedRef.current;
    const shouldFetchRecentOrders = forceRecentOrdersRefresh || !recentOrdersLoadedRef.current;

    try {
      setLoading(true);
      const [supplierItems, agendaData, orderItems] = await Promise.all([
        shouldFetchSuppliers ? fetchSuppliers() : Promise.resolve(null),
        fetchSuppliersAgenda({ date: targetDate }),
        shouldFetchRecentOrders ? fetchSupplierOrders({ limit: 30 }) : Promise.resolve(null)
      ]);

      if (Array.isArray(supplierItems)) {
        setSuppliers(supplierItems);
        suppliersLoadedRef.current = true;
      }

      setAgenda(agendaData);

      if (Array.isArray(orderItems)) {
        setRecentOrders(orderItems);
        recentOrdersLoadedRef.current = true;
        // Backend becomes source of truth after each orders refresh.
        // This prevents stale local overrides from reviving old items in UI.
        setConfirmedOrderOverrides({});
        setReceivedQtyOverrides({});
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [simulatedDate, realToday]);

  useEffect(() => {
    loadData(simulatedDate);
  }, [loadData, simulatedDate]);

  useEffect(() => {
    let active = true;

    async function loadDaySupplierProducts() {
      const supplierId = Number(selectedDaySupplier?.id || 0);
      if (!supplierId) {
        setSelectedDaySupplierProducts([]);
        return;
      }

      const cachedProducts = productsBySupplierRef.current.get(supplierId);
      if (Array.isArray(cachedProducts)) {
        setSelectedDaySupplierProducts(cachedProducts);
        setLoadingDaySupplierProducts(false);
        return;
      }

      try {
        setLoadingDaySupplierProducts(true);
        const data = await fetchSupplierProducts(String(supplierId));
        if (!active) {
          return;
        }
        const products = Array.isArray(data.items) ? data.items : [];
        productsBySupplierRef.current.set(supplierId, products);
        setSelectedDaySupplierProducts(products);
      } catch (_error) {
        if (!active) {
          return;
        }
        setSelectedDaySupplierProducts([]);
      } finally {
        if (active) {
          setLoadingDaySupplierProducts(false);
        }
      }
    }

    loadDaySupplierProducts();

    return () => {
      active = false;
    };
  }, [selectedDaySupplier]);

  const lastPurchasedBySupplierProduct = useMemo(() => {
    const map = new Map();
    for (const order of Array.isArray(recentOrders) ? recentOrders : []) {
      const supplierId = Number(order?.supplier_id || 0);
      for (const item of Array.isArray(order?.items) ? order.items : []) {
        const productId = Number(item?.product_id || 0);
        if (!supplierId || !productId) {
          continue;
        }
        const key = `${supplierId}:${productId}`;
        if (!map.has(key)) {
          map.set(key, Number(item?.quantity || 0));
        }
      }
    }
    return map;
  }, [recentOrders]);

  const pickupOrderDoneBySupplierDay = useMemo(() => {
    const map = new Map();
    for (const order of Array.isArray(recentOrders) ? recentOrders : []) {
      const supplierId = Number(order?.supplier_id || 0);
      const orderDate = String(order?.order_date || '').trim();
      const status = normalizeOrderStatus(order?.status);
      if (!supplierId || !orderDate) {
        continue;
      }
      if (status === 'cancelado') {
        continue;
      }
      map.set(`${supplierId}:${orderDate}`, true);
    }
    return map;
  }, [recentOrders]);

  const deliveryStateBySupplierDay = useMemo(() => {
    const map = new Map();

    for (const order of Array.isArray(recentOrders) ? recentOrders : []) {
      const supplierId = Number(order?.supplier_id || 0);
      const deliveryDate = String(order?.delivery_date || '').trim();
      const status = normalizeOrderStatus(order?.status);
      if (!supplierId || !deliveryDate || status === 'cancelado') {
        continue;
      }

      const key = `${supplierId}:${deliveryDate}`;
      const current = map.get(key) || { hasPending: false, hasReceived: false };
      if (status === 'pendiente') {
        current.hasPending = true;
      }
      if (status === 'recibido') {
        current.hasReceived = true;
      }
      map.set(key, current);
    }

    return map;
  }, [recentOrders]);

  const todayHeadline = useMemo(() => {
    if (!agenda?.today?.items?.length) {
      return 'Hoy no hay llegadas cargadas';
    }

    const first = agenda.today.items[0];
    return `Hoy llega ${first.supplier_name} - ${formatMoney(first.expected_amount)}`;
  }, [agenda]);

  const weekMovementSchedule = useMemo(() => {
    const selectedDate = normalizeISODate(agenda?.selected_date || simulatedDate);
    const selected = new Date(`${selectedDate}T00:00:00Z`);
    const mondayOffset = (selected.getUTCDay() + 6) % 7;
    const weekStart = normalizeISODate(
      new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), selected.getUTCDate() - mondayOffset))
    );

    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const dayName = getSpanishDayName(date);
      const pickup = [];
      const delivery = [];

      for (const supplier of suppliers) {
        const supplierName = String(supplier?.nombre || '').trim();
        if (!supplierName) {
          continue;
        }

        const pickupDays = parseCsvDays(supplier?.dias_pedido?.join(','));
        const deliveryDays = parseCsvDays(supplier?.dias_entrega?.join(','));

        if (pickupDays.includes(dayName)) {
          const pickupKey = `${Number(supplier.id)}:${date}`;
          const orderState = date > effectiveToday
            ? 'none'
            : (pickupOrderDoneBySupplierDay.get(pickupKey) ? 'done' : 'missed');
          pickup.push({ id: supplier.id, nombre: supplierName, order_state: orderState });
        }
        if (deliveryDays.includes(dayName)) {
          const deliveryKey = `${Number(supplier.id)}:${date}`;
          const deliveryState = deliveryStateBySupplierDay.get(deliveryKey) || {
            hasPending: false,
            hasReceived: false
          };
          let receptionState = 'none';
          if (date <= effectiveToday) {
            if (deliveryState.hasReceived) {
              receptionState = 'done';
            } else {
              receptionState = 'missed';
            }
          }

          delivery.push({ id: supplier.id, nombre: supplierName, reception_state: receptionState });
        }
      }

      pickup.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));
      delivery.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

      return {
        date,
        day_name: dayName,
        is_today: date === effectiveToday,
        pickup,
        delivery
      };
    });
  }, [agenda?.selected_date, simulatedDate, suppliers, effectiveToday, pickupOrderDoneBySupplierDay, deliveryStateBySupplierDay]);

  const handleSelectDaySupplier = useCallback((supplier, movementType, date) => {
    if (!supplier?.id) {
      return;
    }

    setSelectedDaySupplier({
      id: Number(supplier.id),
      movementType: movementType === 'pickup' ? 'pickup' : 'delivery',
      date: normalizeISODate(date || simulatedDate)
    });
  }, [simulatedDate]);

  const selectedDaySupplierDetail = useMemo(() => {
    if (!selectedDaySupplier?.id) {
      return null;
    }

    const supplier = suppliers.find((item) => Number(item.id) === Number(selectedDaySupplier.id));
    if (!supplier) {
      return null;
    }

    const selectedDay = (agenda?.week || []).find((day) => day.date === selectedDaySupplier.date) || null;
    const sourceOrders = selectedDaySupplier.movementType === 'pickup'
      ? (selectedDay?.pickup_items || [])
      : (selectedDay?.delivery_items || selectedDay?.items || []);

    const matchingFromAgenda = sourceOrders.filter(
      (item) => Number(item?.supplier_id) === Number(supplier.id)
    );
    const matchingFromRecent = (Array.isArray(recentOrders) ? recentOrders : []).filter((item) => {
      if (Number(item?.supplier_id) !== Number(supplier.id)) {
        return false;
      }
      if (selectedDaySupplier.movementType === 'pickup') {
        return String(item?.order_date || '') === selectedDaySupplier.date;
      }
      return String(item?.delivery_date || '') === selectedDaySupplier.date;
    });

    const mergedById = new Map();
    for (const order of [...matchingFromAgenda, ...matchingFromRecent]) {
      const orderId = Number(order?.id || 0);
      if (!orderId) {
        continue;
      }
      mergedById.set(orderId, order);
    }

    const sortedMatchingOrders = [...mergedById.values()].sort((a, b) => {
      const byTimestamp = parseOrderTimestamp(b) - parseOrderTimestamp(a);
      if (byTimestamp !== 0) {
        return byTimestamp;
      }
      return Number(b?.id || 0) - Number(a?.id || 0);
    });
    const selectedOrder = selectMostRelevantOrder(sortedMatchingOrders);

    return {
      supplier,
      movementType: selectedDaySupplier.movementType,
      date: selectedDaySupplier.date,
      // Only show real pending order selected from backend-driven sources.
      // If there is no pending order, detail list must remain empty.
      todayOrder: selectedOrder || null,
      isDeliveryOverdue:
        selectedDaySupplier.movementType === 'delivery'
        && selectedDaySupplier.date < effectiveToday
        && sortedMatchingOrders.some((order) => normalizeOrderStatus(order?.status) === 'pendiente'),
      matchingOrders: sortedMatchingOrders
    };
  }, [selectedDaySupplier, suppliers, agenda, recentOrders, effectiveToday]);

  const selectedDaySupplierAlerts = useMemo(() => {
    const supplierId = Number(selectedDaySupplier?.id || 0);
    if (!supplierId) {
      return null;
    }

    const currentOrderQtyByProductId = new Map(
      (selectedDaySupplierDetail?.todayOrder?.items || [])
        .filter((item) => Number(item?.product_id || 0) > 0)
        .map((item) => [Number(item.product_id), Number(item.quantity || 0)])
    );

    const alerts = (Array.isArray(selectedDaySupplierProducts) ? selectedDaySupplierProducts : [])
      .map((product) => {
        const stockActual = Number(product?.stock_actual || 0);
        if (stockActual > 5) {
          return null;
        }
        const status = stockActual <= 2 ? 'critical' : 'warning';
        const productId = Number(product?.id || 0);
        const key = `${supplierId}:${productId}`;
        const baseQuantity = Number(currentOrderQtyByProductId.get(productId) || 0);
        const uiQuantity = Number(quantityOverrides[key] ?? baseQuantity);

        return {
          id: productId,
          product: {
            id: productId,
            name: product?.nombre || '',
            supplier_id: supplierId,
            stock_actual: stockActual
          },
          status,
          current_order_quantity: baseQuantity,
          ui_quantity: uiQuantity,
          last_purchased_quantity: lastPurchasedBySupplierProduct.get(key) || 0
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const byStatus = statusRank(a.status) - statusRank(b.status);
        if (byStatus !== 0) {
          return byStatus;
        }
        const byStock = Number(a?.product?.stock_actual || 0) - Number(b?.product?.stock_actual || 0);
        if (byStock !== 0) {
          return byStock;
        }
        return String(a?.product?.name || '').localeCompare(String(b?.product?.name || ''));
      });

    return {
      supplier_id: supplierId,
      supplier_name: selectedDaySupplierDetail?.supplier?.nombre || '',
      alerts,
      pending_items: alerts.filter((item) => Number(item?.ui_quantity || 0) > 0).length
    };
  }, [
    selectedDaySupplier,
    selectedDaySupplierDetail,
    selectedDaySupplierProducts,
    quantityOverrides,
    lastPurchasedBySupplierProduct
  ]);

  const handleChangeSelectedDaySupplierAlertQuantity = useCallback(({ alertItem, quantity }) => {
    const supplierId = Number(alertItem?.product?.supplier_id || 0);
    const productId = Number(alertItem?.product?.id || 0);
    if (!supplierId || !productId) {
      return;
    }

    const nextQuantity = Math.max(0, Number(quantity || 0));
    const key = `${supplierId}:${productId}`;
    setQuantityOverrides((current) => ({
      ...current,
      [key]: nextQuantity
    }));
  }, []);

  const handleConfirmSelectedDaySupplierOrder = useCallback(async () => {
    const supplierId = Number(selectedDaySupplier?.id || 0);
    const deliveryDate = normalizeISODate(selectedDaySupplier?.date || '');
    if (!supplierId || !deliveryDate) {
      toast.error('Selecciona proveedor y fecha en la semana operativa');
      return;
    }
    if (selectedDaySupplier?.movementType !== 'pickup') {
      toast.error('El pedido se arma solo en el dia de levante');
      return;
    }
    if (!selectedDaySupplierAlerts) {
      toast.error('No hay alertas para ese proveedor');
      return;
    }

    try {
      if (selectedDaySupplier?.movementType === 'pickup' && deliveryDate < effectiveToday) {
        toast.error(`No se puede confirmar pedido para ${deliveryDate}: ese dia de levante ya paso.`);
        return;
      }

      setConfirmingWeekSupplierId(supplierId);
      const orderItems = selectedDaySupplierAlerts.alerts
        .map((alert) => ({
          product_id: Number(alert?.product?.id || 0),
          quantity: Number(alert?.ui_quantity || 0),
          status: alert?.status || 'warning'
        }))
        .filter((item) => item.product_id > 0 && item.quantity > 0);

      if (!orderItems.length) {
        toast.error('Agrega al menos un producto antes de confirmar');
        return;
      }

      const orderDate = selectedDaySupplier?.movementType === 'pickup'
        ? deliveryDate
        : effectiveToday;

      const confirmedOrder = await upsertSupplierOrderFromProvider({
        supplier_id: supplierId,
        order_date: orderDate,
        delivery_date: deliveryDate,
        notes: 'Armado desde semana operativa',
        items: orderItems
      });

      const supplierName = selectedDaySupplierDetail?.supplier?.nombre || 'Proveedor';
      toast.success(`Pedido confirmado para ${supplierName} (${deliveryDate})`);
      setConfirmedOrderOverrides((current) => ({
        ...current,
        [`${supplierId}:${deliveryDate}`]: confirmedOrder
      }));
      setReceivedQtyOverrides((current) => {
        const next = { ...current };
        for (const item of Array.isArray(confirmedOrder?.items) ? confirmedOrder.items : []) {
          const itemId = Number(item?.id || 0);
          if (itemId) {
            next[`${Number(confirmedOrder?.id || 0)}:${itemId}`] = Number(item?.quantity || 0);
          }
        }
        return next;
      });

      setQuantityOverrides((current) => {
        const next = { ...current };
        for (const alert of selectedDaySupplierAlerts.alerts) {
          const productId = Number(alert?.product?.id || 0);
          delete next[`${supplierId}:${productId}`];
        }
        return next;
      });

      await loadData(simulatedDate, { forceRecentOrdersRefresh: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setConfirmingWeekSupplierId(null);
    }
  }, [selectedDaySupplier, selectedDaySupplierAlerts, selectedDaySupplierDetail, effectiveToday, loadData, simulatedDate]);

  const selectedDaySupplierReceivingItems = useMemo(() => {
    const order = selectedDaySupplierDetail?.todayOrder || null;
    const orderId = Number(order?.id || 0);
    if (!orderId) {
      return [];
    }

    return (Array.isArray(order?.items) ? order.items : []).map((item) => {
      const itemId = Number(item?.id || 0);
      const orderedQuantity = Number(item?.quantity || 0);
      const key = `${orderId}:${itemId}`;
      const receivedQuantity = Number(receivedQtyOverrides[key] ?? orderedQuantity);
      return {
        ...item,
        ordered_quantity: orderedQuantity,
        received_quantity: Math.max(0, Number(receivedQuantity || 0))
      };
    });
  }, [selectedDaySupplierDetail, receivedQtyOverrides]);

  const handleChangeReceivedItemQuantity = useCallback(({ orderId, itemId, quantity }) => {
    const parsedOrderId = Number(orderId);
    const parsedItemId = Number(itemId);
    if (!parsedOrderId || !parsedItemId) {
      return;
    }

    const nextQuantity = Math.max(0, Number(quantity || 0));
    const key = `${parsedOrderId}:${parsedItemId}`;
    setReceivedQtyOverrides((current) => ({
      ...current,
      [key]: nextQuantity
    }));
  }, []);

  const handleReceiveSelectedDaySupplierOrder = useCallback(async () => {
    const orderId = Number(selectedDaySupplierDetail?.todayOrder?.id || 0);
    const supplierId = Number(selectedDaySupplierDetail?.supplier?.id || 0);
    const deliveryDate = normalizeISODate(selectedDaySupplierDetail?.date || '');

    if (!orderId) {
      toast.error('No hay pedido confirmado para recibir');
      return;
    }
    if (!selectedDaySupplierReceivingItems.length) {
      toast.error('El pedido no tiene items para recibir');
      return;
    }

    try {
      setReceivingOrderId(orderId);
      const payload = {
        items: selectedDaySupplierReceivingItems.map((item) => ({
          item_id: Number(item?.id || 0),
          quantity_received: Number(item?.received_quantity || 0)
        }))
      };
      const { item, stockUpdates } = await receiveSupplierOrder(orderId, payload);
      const updatedItems = Number(stockUpdates?.length || 0);
      toast.success(
        updatedItems > 0
          ? `Stock actualizado en ${updatedItems} producto(s)`
          : 'Pedido marcado como recibido'
      );

      if (supplierId) {
        productsBySupplierRef.current.delete(supplierId);
        setSelectedDaySupplier((current) => (current ? { ...current } : current));
      }

      if (supplierId && deliveryDate && item) {
        setConfirmedOrderOverrides((current) => {
          const next = { ...current };
          delete next[`${supplierId}:${deliveryDate}`];
          return next;
        });
      }
      setReceivedQtyOverrides((current) => {
        const next = { ...current };
        for (const receivingItem of selectedDaySupplierReceivingItems) {
          delete next[`${orderId}:${Number(receivingItem?.id || 0)}`];
        }
        return next;
      });

      await loadData(simulatedDate, { forceRecentOrdersRefresh: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setReceivingOrderId(null);
    }
  }, [selectedDaySupplierDetail, selectedDaySupplierReceivingItems, loadData, simulatedDate]);

  const handleCancelSelectedDaySupplierFlow = useCallback(() => {
    const supplierId = Number(selectedDaySupplier?.id || 0);
    const orderId = Number(selectedDaySupplierDetail?.todayOrder?.id || 0);

    if (supplierId) {
      setQuantityOverrides((current) => {
        const next = { ...current };
        for (const key of Object.keys(next)) {
          if (key.startsWith(`${supplierId}:`)) {
            delete next[key];
          }
        }
        return next;
      });
    }

    if (orderId) {
      setReceivedQtyOverrides((current) => {
        const next = { ...current };
        for (const key of Object.keys(next)) {
          if (key.startsWith(`${orderId}:`)) {
            delete next[key];
          }
        }
        return next;
      });
    }

    setSelectedDaySupplier(null);
  }, [selectedDaySupplier, selectedDaySupplierDetail]);

  return {
    loading,
    simulatedDate,
    setSimulatedDate,
    realToday,
    suppliers,
    agenda,
    todayHeadline,
    selectedDaySupplierDetail,
    selectedDaySupplierAlerts,
    selectedDaySupplierReceivingItems,
    loadingDaySupplierProducts,
    confirmingWeekSupplierId,
    receivingOrderId,
    handleChangeSelectedDaySupplierAlertQuantity,
    handleChangeReceivedItemQuantity,
    handleConfirmSelectedDaySupplierOrder,
    handleReceiveSelectedDaySupplierOrder,
    handleCancelSelectedDaySupplierFlow,
    handleSelectDaySupplier,
    weekMovementSchedule
  };
}
