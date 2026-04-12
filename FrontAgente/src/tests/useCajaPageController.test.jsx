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
const originalEventSource = globalThis.EventSource;
const eventSourceInstances = [];

class MockEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = new Map();
    this.addEventListener = vi.fn((eventName, callback) => {
      this.listeners.set(eventName, callback);
    });
    this.removeEventListener = vi.fn((eventName) => {
      this.listeners.delete(eventName);
    });
    this.close = vi.fn();
    eventSourceInstances.push(this);
  }

  emit(eventName, payload) {
    const callback = this.listeners.get(eventName);
    if (!callback) {
      return;
    }

    callback({
      data: JSON.stringify(payload)
    });
  }
}

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
  beforeAll(() => {
    globalThis.EventSource = MockEventSource;
  });

  afterAll(() => {
    globalThis.EventSource = originalEventSource;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    eventSourceInstances.length = 0;
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

  it('sincroniza scanner en vivo al recibir scanner:state de operario', async () => {
    getAuthToken.mockReturnValue('token-live');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCajaPageController(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const stream = eventSourceInstances[0];
    expect(stream).toBeDefined();

    act(() => {
      stream.emit('cashbox:update', {
        type: 'scanner:state',
        operator: { role: 'operario', name: 'Operario 1' },
        items: [{ name: 'Arroz', quantity: 2, total: 120 }],
        total: 120,
        state: 'active',
        updated_at: '2026-04-12T12:00:00Z'
      });
    });

    expect(result.current.scannerLiveState.total).toBe(120);
    expect(result.current.scannerLiveState.items).toHaveLength(1);
    expect(result.current.scannerLiveState.operator?.name).toBe('Operario 1');
  });

  it('refresca datos al recibir evento sale', async () => {
    getAuthToken.mockReturnValue('token-live');
    const { wrapper } = createWrapper();
    renderHook(() => useCajaPageController(), { wrapper });

    await waitFor(() => {
      expect(fetchCashboxSummary).toHaveBeenCalledTimes(1);
    });

    const initialMovementsCalls = fetchCashboxMovements.mock.calls.length;
    const initialRankingCalls = fetchCashboxRanking.mock.calls.length;
    const stream = eventSourceInstances[0];

    act(() => {
      stream.emit('cashbox:update', {
        type: 'sale',
        operator: { role: 'operario' }
      });
    });

    await waitFor(() => {
      expect(fetchCashboxMovements.mock.calls.length).toBeGreaterThan(initialMovementsCalls);
      expect(fetchCashboxRanking.mock.calls.length).toBeGreaterThan(initialRankingCalls);
      expect(fetchCashboxSummary.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('cierra y desuscribe EventSource al desmontar', async () => {
    getAuthToken.mockReturnValue('token-live');
    const { wrapper } = createWrapper();
    const { unmount } = renderHook(() => useCajaPageController(), { wrapper });

    await waitFor(() => {
      expect(eventSourceInstances.length).toBeGreaterThan(0);
    });

    const stream = eventSourceInstances[0];
    unmount();

    expect(stream.removeEventListener).toHaveBeenCalledWith('cashbox:update', expect.any(Function));
    expect(stream.close).toHaveBeenCalledTimes(1);
  });
});
