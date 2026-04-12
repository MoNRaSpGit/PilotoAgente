import { act, renderHook, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import authReducer from '../store/slices/authSlice';
import { useCajaPageController } from '../pages/caja/useCajaPageController';
import {
  closeCashbox,
  fetchCashboxMovements,
  fetchCashboxRanking,
  fetchCashboxSummary,
  fetchScannerLiveState,
  openCashbox
} from '../services/api';
import { clearAuthSession, getAuthToken } from '../utils/authSession';
import toast from 'react-hot-toast';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('../services/api', () => ({
  closeCashbox: vi.fn(),
  fetchCashboxMovements: vi.fn(),
  fetchCashboxRanking: vi.fn(),
  fetchCashboxSummary: vi.fn(),
  fetchScannerLiveState: vi.fn(),
  openCashbox: vi.fn(),
  registerCashboxPayment: vi.fn()
}));

vi.mock('../utils/authSession', () => ({
  clearAuthSession: vi.fn(),
  getAuthToken: vi.fn(),
  getStoredAuthSession: vi.fn(() => null)
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

function createSummary(overrides = {}) {
  return {
    is_open: true,
    open_cashbox: {
      opened_by_name: 'Admin',
      opening_amount: 100,
      sales_total: 200,
      payments_total: 30,
      current_amount: 270
    },
    selected_day: {
      opening_amount: 100,
      sales_total: 200,
      payments_total: 30,
      profit_amount: 34,
      current_amount: 270
    },
    previous_day: { sales_total: 180 },
    weekly: { current: { sales_total: 200 }, previous: { sales_total: 190 }, comparison_percent: 5.26 },
    monthly: { current: { sales_total: 200 }, previous: { sales_total: 210 }, comparison_percent: -4.76 },
    comparison_percent: 11.11,
    ...overrides
  };
}

function createWrapper(preloadedAuth = { token: '', user: null }) {
  const store = configureStore({
    reducer: {
      auth: authReducer
    },
    preloadedState: {
      auth: preloadedAuth
    }
  });

  return {
    store,
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
  };
}

describe('useCajaPageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue('');
    fetchCashboxSummary.mockResolvedValue(createSummary());
    fetchScannerLiveState.mockResolvedValue({});
    fetchCashboxMovements.mockResolvedValue({ items: [] });
    fetchCashboxRanking.mockResolvedValue({ items: [] });
    openCashbox.mockResolvedValue({
      opening_amount: 150,
      sales_total: 0,
      payments_total: 0,
      current_amount: 150
    });
    closeCashbox.mockResolvedValue({});
  });

  it('carga el dashboard inicial correctamente', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCajaPageController(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.selectedDay.sales_total).toBe(200);
    expect(fetchCashboxSummary).toHaveBeenCalled();
  });

  it('maneja 401 limpiando sesion y redirigiendo a login', async () => {
    fetchCashboxSummary.mockRejectedValueOnce({ status: 401, message: 'No autorizado' });
    const { store, wrapper } = createWrapper({
      token: 'token-demo',
      user: { id: 1, role: 'admin', name: 'Admin' }
    });

    renderHook(() => useCajaPageController(), { wrapper });

    await waitFor(() => {
      expect(clearAuthSession).toHaveBeenCalledTimes(1);
    });

    expect(store.getState().auth.user).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(toast.error).toHaveBeenCalledWith('Sesion vencida, volve a ingresar');
  });

  it('valida monto de apertura antes de llamar a API', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCajaPageController(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleOpenCashbox();
    });

    expect(openCashbox).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Ingresa un monto inicial valido');
  });

  it('abre y cierra caja con exito', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCajaPageController(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setOpeningAmount('150');
    });

    await act(async () => {
      await result.current.handleOpenCashbox();
    });

    expect(openCashbox).toHaveBeenCalledWith({ opening_amount: 150 });
    expect(toast.success).toHaveBeenCalledWith('Caja abierta');
    expect(result.current.isOpen).toBe(true);

    await act(async () => {
      await result.current.handleCloseCashbox();
    });

    expect(closeCashbox).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Caja cerrada');
    expect(result.current.isOpen).toBe(false);
  });
});
