import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { createExpense, fetchExpenses, fetchExpensesSummary, updateExpense } from '../../services/api';
import { EMPTY_EXPENSE_FORM, EMPTY_EXPENSE_SUMMARY } from './gastosPage.utils';

export function useGastosPageController() {
  const formRef = useRef(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(EMPTY_EXPENSE_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_EXPENSE_FORM);

  const loadData = async () => {
    try {
      setLoading(true);
      const [nextItems, nextSummary] = await Promise.all([fetchExpenses(), fetchExpensesSummary()]);
      setItems(nextItems);
      setSummary(nextSummary);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_EXPENSE_FORM);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      amount: String(item.amount ?? ''),
      frequency: item.frequency || 'monthly',
      scope: item.scope || 'business',
      notes: item.notes || '',
      active: item.active
    });

    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      ...form,
      amount: Number.parseFloat(form.amount)
    };

    if (!payload.name.trim()) {
      toast.error('Ingresa un nombre');
      return;
    }

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      toast.error('Ingresa un monto valido');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await updateExpense(editingId, payload);
        toast.success('Gasto actualizado');
      } else {
        await createExpense(payload);
        toast.success('Gasto creado');
      }
      resetForm();
      await loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item) => {
    try {
      await updateExpense(item.id, {
        active: !item.active
      });
      toast.success(item.active ? 'Gasto desactivado' : 'Gasto activado');
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const totals = summary?.totals || EMPTY_EXPENSE_SUMMARY.totals;
  const businessItems = useMemo(() => items.filter((item) => item.scope === 'business'), [items]);
  const homeItems = useMemo(() => items.filter((item) => item.scope === 'home'), [items]);

  return {
    formRef,
    items,
    totals,
    loading,
    saving,
    editingId,
    form,
    setForm,
    resetForm,
    handleEdit,
    handleSubmit,
    handleToggleActive,
    businessItems,
    homeItems
  };
}
