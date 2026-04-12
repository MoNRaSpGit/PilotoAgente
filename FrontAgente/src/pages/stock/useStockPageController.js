import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchStockControls,
  fetchStockDashboard,
  registerStockEntry,
  saveStockControl,
  searchStockProducts
} from '../../services/api';
import {
  buildAvailableControls,
  INITIAL_STOCK_CONTROL_FORM,
  INITIAL_STOCK_DASHBOARD,
  INITIAL_STOCK_ENTRY_FORM
} from './stockPage.utils';

export function useStockPageController() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(INITIAL_STOCK_DASHBOARD);
  const [controls, setControls] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [controlForm, setControlForm] = useState(INITIAL_STOCK_CONTROL_FORM);
  const [entryForm, setEntryForm] = useState(INITIAL_STOCK_ENTRY_FORM);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashboardData, controlsData] = await Promise.all([
        fetchStockDashboard(),
        fetchStockControls()
      ]);
      setDashboard(dashboardData);
      setControls(controlsData);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const items = await searchStockProducts({ query: productSearch, limit: 20 });
        setProducts(items);
      } catch (_error) {
        setProducts([]);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [productSearch]);

  const availableControls = useMemo(() => {
    return buildAvailableControls(controls, dashboard.expected_today);
  }, [controls, dashboard.expected_today]);

  const handleToggleDay = (field, day) => {
    setControlForm((current) => {
      const hasDay = current[field].includes(day);
      return {
        ...current,
        [field]: hasDay
          ? current[field].filter((entry) => entry !== day)
          : [...current[field], day]
      };
    });
  };

  const handleSaveControl = async (event) => {
    event.preventDefault();

    if (!controlForm.product_id) {
      toast.error('Selecciona un producto');
      return;
    }

    try {
      setSavingConfig(true);
      await saveStockControl({
        product_id: Number(controlForm.product_id),
        supplier_name: controlForm.supplier_name,
        delivery_days: controlForm.delivery_days,
        order_days: controlForm.order_days,
        critical_threshold: Number(controlForm.critical_threshold),
        warning_threshold: Number(controlForm.warning_threshold),
        target_leftover: Number(controlForm.target_leftover),
        active: true
      });
      toast.success('Control de stock guardado');
      await loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRegisterEntry = async (event) => {
    event.preventDefault();

    if (!entryForm.stock_control_id) {
      toast.error('Selecciona un producto controlado');
      return;
    }

    if (!Number(entryForm.quantity) || Number(entryForm.quantity) <= 0) {
      toast.error('Ingresa una cantidad valida');
      return;
    }

    try {
      setSavingEntry(true);
      await registerStockEntry({
        stock_control_id: Number(entryForm.stock_control_id),
        quantity: Number(entryForm.quantity),
        notes: entryForm.notes
      });
      setEntryForm(INITIAL_STOCK_ENTRY_FORM);
      toast.success('Stock actualizado');
      await loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingEntry(false);
    }
  };

  return {
    loading,
    dashboard,
    products,
    productSearch,
    setProductSearch,
    savingConfig,
    savingEntry,
    controlForm,
    setControlForm,
    entryForm,
    setEntryForm,
    availableControls,
    handleToggleDay,
    handleSaveControl,
    handleRegisterEntry
  };
}
