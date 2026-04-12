import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createClient,
  fetchClientHistory,
  fetchClients,
  updateClientDelivery,
  updateClientPayment
} from '../../services/api';
import {
  INITIAL_CLIENT_FORM,
  INITIAL_DELIVERY_FORM,
  INITIAL_HISTORY_RANGE
} from './clientsPage.utils';

export function useClientsPageController() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingClient, setEditingClient] = useState(null);
  const [historyClient, setHistoryClient] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyRange, setHistoryRange] = useState(INITIAL_HISTORY_RANGE);
  const [deliveryForm, setDeliveryForm] = useState(INITIAL_DELIVERY_FORM);
  const [form, setForm] = useState(INITIAL_CLIENT_FORM);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const items = await fetchClients();
      setClients(items);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nombre = form.nombre.trim();
    const saldo = form.saldo === '' ? 0 : Number(form.saldo);

    if (!nombre) {
      toast.error('Ingresa un nombre');
      return;
    }

    if (!Number.isFinite(saldo) || saldo < 0) {
      toast.error('Ingresa un saldo valido');
      return;
    }

    try {
      setSaving(true);
      const item = await createClient({
        nombre,
        saldo,
        ultima_fecha_pago: form.ultima_fecha_pago || undefined
      });

      setClients((current) => [item, ...current]);
      setForm(INITIAL_CLIENT_FORM);
      toast.success('Cliente creado');
    } catch (submitError) {
      toast.error(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePayment = async (client) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const updated = await updateClientPayment(client.id, {
        ultima_fecha_pago: today
      });

      setClients((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      toast.success('Pago actualizado');
    } catch (paymentError) {
      toast.error(paymentError.message);
    }
  };

  const openDeliveryModal = (client) => {
    setEditingClient(client);
    setDeliveryForm(INITIAL_DELIVERY_FORM);
  };

  const openHistoryModal = (client) => {
    setHistoryClient(client);
    setHistoryItems([]);
    setHistoryRange(INITIAL_HISTORY_RANGE);
  };

  const closeDeliveryModal = () => {
    setEditingClient(null);
    setDeliveryForm(INITIAL_DELIVERY_FORM);
  };

  const closeHistoryModal = () => {
    setHistoryClient(null);
    setHistoryItems([]);
    setHistoryRange(INITIAL_HISTORY_RANGE);
  };

  const handleDeliveryChange = (event) => {
    setDeliveryForm({
      entrega: event.target.value
    });
  };

  const handleDeliverySubmit = async () => {
    if (!editingClient) {
      return;
    }

    const entrega = deliveryForm.entrega === '' ? 0 : Number(deliveryForm.entrega);

    if (!Number.isFinite(entrega) || entrega <= 0) {
      toast.error('Ingresa una entrega valida');
      return;
    }

    try {
      const today = new Date().toISOString().slice(0, 10);
      const updated = await updateClientDelivery(editingClient.id, {
        entrega,
        ultima_fecha_pago: today
      });

      setClients((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      toast.success('Entrega registrada');
      closeDeliveryModal();
    } catch (deliveryError) {
      toast.error(deliveryError.message);
    }
  };

  const loadHistory = useCallback(async () => {
    if (!historyClient) {
      return;
    }

    try {
      setHistoryLoading(true);
      const items = await fetchClientHistory(historyClient.id, {
        from: historyRange.from || undefined,
        to: historyRange.to || undefined
      });
      setHistoryItems(items);
    } catch (historyError) {
      toast.error(historyError.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyClient, historyRange.from, historyRange.to]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadHistory();
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [loadHistory]);

  const editingPreview = useMemo(() => {
    if (!editingClient) {
      return null;
    }

    const entrega = deliveryForm.entrega === '' ? 0 : Number(deliveryForm.entrega);
    if (!Number.isFinite(entrega) || entrega <= 0) {
      return null;
    }

    return Math.max(Number(editingClient.saldo) - entrega, 0);
  }, [deliveryForm.entrega, editingClient]);

  return {
    clients,
    loading,
    saving,
    error,
    editingClient,
    historyClient,
    historyLoading,
    historyItems,
    historyRange,
    setHistoryRange,
    deliveryForm,
    form,
    handleChange,
    handleSubmit,
    handlePayment,
    openDeliveryModal,
    openHistoryModal,
    closeDeliveryModal,
    closeHistoryModal,
    handleDeliveryChange,
    handleDeliverySubmit,
    editingPreview
  };
}
