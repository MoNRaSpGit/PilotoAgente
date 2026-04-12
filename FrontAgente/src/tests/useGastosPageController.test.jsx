import { act, renderHook, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { createExpense, fetchExpenses, fetchExpensesSummary, updateExpense } from '../services/api';
import { useGastosPageController } from '../pages/gastos/useGastosPageController';

vi.mock('../services/api', () => ({
  createExpense: vi.fn(),
  fetchExpenses: vi.fn(),
  fetchExpensesSummary: vi.fn(),
  updateExpense: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

describe('useGastosPageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.requestAnimationFrame = (callback) => callback();
    fetchExpenses.mockResolvedValue([
      { id: 1, name: 'Luz', scope: 'business', active: true, amount: 100, frequency: 'monthly', daily_equivalent: 3, monthly_equivalent: 100 }
    ]);
    fetchExpensesSummary.mockResolvedValue({
      totals: {
        daily_total: 30,
        monthly_total: 300,
        business_daily_total: 20,
        business_monthly_total: 200,
        home_daily_total: 10,
        home_monthly_total: 100
      }
    });
    createExpense.mockResolvedValue({ id: 2 });
    updateExpense.mockResolvedValue({ id: 1, active: false });
  });

  it('carga gastos y resumen al iniciar', async () => {
    const { result } = renderHook(() => useGastosPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchExpenses).toHaveBeenCalledTimes(1);
    expect(fetchExpensesSummary).toHaveBeenCalledTimes(1);
    expect(result.current.businessItems).toHaveLength(1);
  });

  it('valida nombre antes de crear', async () => {
    const { result } = renderHook(() => useGastosPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() });
    });

    expect(createExpense).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Ingresa un nombre');
  });

  it('crea gasto con datos validos', async () => {
    const { result } = renderHook(() => useGastosPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setForm((current) => ({
        ...current,
        name: 'Internet',
        amount: '120',
        scope: 'home'
      }));
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() });
    });

    expect(createExpense).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Gasto creado');
  });

  it('desactiva un gasto', async () => {
    const { result } = renderHook(() => useGastosPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleToggleActive({ id: 1, active: true });
    });

    expect(updateExpense).toHaveBeenCalledWith(1, { active: false });
    expect(toast.success).toHaveBeenCalledWith('Gasto desactivado');
  });
});
