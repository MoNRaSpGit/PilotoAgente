import { act, renderHook, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import {
  fetchStockControls,
  fetchStockDashboard,
  registerStockEntry,
  saveStockControl,
  searchStockProducts
} from '../services/api';
import { useStockPageController } from '../pages/stock/useStockPageController';

vi.mock('../services/api', () => ({
  fetchStockControls: vi.fn(),
  fetchStockDashboard: vi.fn(),
  registerStockEntry: vi.fn(),
  saveStockControl: vi.fn(),
  searchStockProducts: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

describe('useStockPageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchStockDashboard.mockResolvedValue({
      items: [],
      expected_today: [],
      totals: { tracked: 1, alerts: 0, critical: 0, warning: 0 }
    });
    fetchStockControls.mockResolvedValue([]);
    searchStockProducts.mockResolvedValue([]);
    saveStockControl.mockResolvedValue({});
    registerStockEntry.mockResolvedValue({});
  });

  it('carga dashboard y controles al iniciar', async () => {
    const { result } = renderHook(() => useStockPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchStockDashboard).toHaveBeenCalledTimes(1);
    expect(fetchStockControls).toHaveBeenCalledTimes(1);
    expect(result.current.dashboard.totals.tracked).toBe(1);
  });

  it('valida producto requerido antes de guardar control', async () => {
    const { result } = renderHook(() => useStockPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleSaveControl({ preventDefault: vi.fn() });
    });

    expect(saveStockControl).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Selecciona un producto');
  });

  it('guarda control con datos validos', async () => {
    const { result } = renderHook(() => useStockPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setControlForm((current) => ({ ...current, product_id: '5' }));
    });

    await act(async () => {
      await result.current.handleSaveControl({ preventDefault: vi.fn() });
    });

    expect(saveStockControl).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Control de stock guardado');
  });

  it('valida cantidad antes de registrar ingreso', async () => {
    const { result } = renderHook(() => useStockPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setEntryForm({ stock_control_id: '7', quantity: '0', notes: '' });
    });

    await act(async () => {
      await result.current.handleRegisterEntry({ preventDefault: vi.fn() });
    });

    expect(registerStockEntry).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Ingresa una cantidad valida');
  });

  it('busca productos segun texto con debounce', async () => {
    const { result } = renderHook(() => useStockPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    vi.useFakeTimers();
    try {
      act(() => {
        result.current.setProductSearch('leche');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(searchStockProducts).toHaveBeenCalledWith({ query: 'leche', limit: 20 });
    } finally {
      vi.useRealTimers();
    }
  });
});
