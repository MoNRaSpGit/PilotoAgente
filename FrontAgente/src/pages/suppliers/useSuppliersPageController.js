import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createSupplierOrder,
  fetchSupplierProducts,
  fetchSupplierOrders,
  fetchSuppliers,
  fetchSuppliersAgenda
} from '../../services/api';
import {
  formatMoney,
  getSpanishDayName,
  INITIAL_SUPPLIERS_AGENDA,
  INITIAL_SUPPLIER_ORDER_FORM,
  normalizeISODate,
  parseCsvDays
} from './suppliersPage.utils';

export function useSuppliersPageController() {
  const realToday = new Date().toISOString().slice(0, 10);
  const [loading, setLoading] = useState(true);
  const [simulatedDate, setSimulatedDate] = useState(realToday);
  const [suppliers, setSuppliers] = useState([]);
  const [agenda, setAgenda] = useState(INITIAL_SUPPLIERS_AGENDA(realToday));
  const [recentOrders, setRecentOrders] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedSupplierProducts, setSelectedSupplierProducts] = useState([]);
  const [selectedSupplierMeta, setSelectedSupplierMeta] = useState(null);
  const [loadingSupplierProducts, setLoadingSupplierProducts] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderForm, setOrderForm] = useState(INITIAL_SUPPLIER_ORDER_FORM);

  const loadData = useCallback(async (dateToLoad) => {
    const targetDate = normalizeISODate(dateToLoad || simulatedDate || realToday);
    try {
      setLoading(true);
      const [supplierItems, agendaData, orderItems] = await Promise.all([
        fetchSuppliers(),
        fetchSuppliersAgenda({ date: targetDate }),
        fetchSupplierOrders({ limit: 8 })
      ]);
      setSuppliers(supplierItems);
      setSelectedSupplierId((current) => {
        if (current && supplierItems.some((item) => String(item.id) === String(current))) {
          return current;
        }
        return supplierItems[0]?.id ? String(supplierItems[0].id) : '';
      });
      setAgenda(agendaData);
      setRecentOrders(orderItems);
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

    async function loadSupplierProducts() {
      if (!selectedSupplierId) {
        setSelectedSupplierMeta(null);
        setSelectedSupplierProducts([]);
        return;
      }

      try {
        setLoadingSupplierProducts(true);
        const data = await fetchSupplierProducts(selectedSupplierId);
        if (!active) {
          return;
        }
        setSelectedSupplierMeta(data.supplier || null);
        setSelectedSupplierProducts(Array.isArray(data.items) ? data.items : []);
      } catch (error) {
        if (!active) {
          return;
        }
        setSelectedSupplierMeta(null);
        setSelectedSupplierProducts([]);
        toast.error(error.message);
      } finally {
        if (active) {
          setLoadingSupplierProducts(false);
        }
      }
    }

    loadSupplierProducts();

    return () => {
      active = false;
    };
  }, [selectedSupplierId]);

  const todayHeadline = useMemo(() => {
    if (!agenda?.today?.items?.length) {
      return 'Hoy no hay llegadas cargadas';
    }

    const first = agenda.today.items[0];
    return `Hoy llega ${first.supplier_name} - ${formatMoney(first.expected_amount)}`;
  }, [agenda]);

  const providerDaySchedule = useMemo(() => {
    const selectedDay = getSpanishDayName(agenda?.selected_date || simulatedDate);
    const pickup = [];
    const delivery = [];

    for (const supplier of suppliers) {
      const pickupDays = parseCsvDays(supplier?.dias_pedido?.join(','));
      const deliveryDays = parseCsvDays(supplier?.dias_entrega?.join(','));

      if (pickupDays.includes(selectedDay)) {
        pickup.push(supplier);
      }
      if (deliveryDays.includes(selectedDay)) {
        delivery.push(supplier);
      }
    }

    pickup.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));
    delivery.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

    return {
      day: selectedDay,
      pickup,
      delivery
    };
  }, [agenda?.selected_date, simulatedDate, suppliers]);

  const handleCreateOrder = async (event) => {
    event.preventDefault();

    if (!orderForm.supplier_id) {
      toast.error('Selecciona un proveedor');
      return;
    }
    if (!orderForm.delivery_date) {
      toast.error('Selecciona fecha de llegada');
      return;
    }
    if (!Number(orderForm.expected_amount) || Number(orderForm.expected_amount) <= 0) {
      toast.error('Ingresa el monto esperado');
      return;
    }

    try {
      setSavingOrder(true);
      await createSupplierOrder({
        supplier_id: Number(orderForm.supplier_id),
        delivery_date: normalizeISODate(orderForm.delivery_date),
        expected_amount: Number(orderForm.expected_amount),
        notes: orderForm.notes
      });
      toast.success('Pedido guardado');
      setOrderForm(INITIAL_SUPPLIER_ORDER_FORM);
      await loadData(simulatedDate);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingOrder(false);
    }
  };

  return {
    loading,
    simulatedDate,
    setSimulatedDate,
    realToday,
    suppliers,
    agenda,
    recentOrders,
    selectedSupplierId,
    setSelectedSupplierId,
    selectedSupplierProducts,
    selectedSupplierMeta,
    loadingSupplierProducts,
    savingOrder,
    orderForm,
    setOrderForm,
    todayHeadline,
    providerDaySchedule,
    handleCreateOrder
  };
}
