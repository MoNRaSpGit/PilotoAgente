import { act, renderHook, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { fetchCashboxObjectives } from '../services/api';
import { useObjetivosPageController } from '../pages/objetivos/useObjetivosPageController';

const mockNavigate = vi.fn();
const mockDispatch = vi.fn();
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

vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('../services/api', () => ({
  API_URL: 'https://api.test',
  fetchCashboxObjectives: vi.fn()
}));

vi.mock('../store/slices/authSlice', () => ({
  clearSession: vi.fn(() => ({ type: 'auth/clearSession' }))
}));

vi.mock('../utils/authSession', () => ({
  clearAuthSession: vi.fn(),
  getAuthToken: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

import { clearAuthSession, getAuthToken } from '../utils/authSession';

describe('useObjetivosPageController', () => {
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
    fetchCashboxObjectives.mockResolvedValue({
      selected_date: '2026-04-12',
      goals: { objective: 100, record: 200 },
      progress: {
        current_sales: 50,
        remaining_to_objective: 50,
        remaining_to_record: 150,
        level: 'curso',
        level_label: 'En curso'
      }
    });
  });

  it('carga objetivos al iniciar', async () => {
    const { result } = renderHook(() => useObjetivosPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchCashboxObjectives).toHaveBeenCalledTimes(1);
    expect(result.current.viewModel.currentSales).toBe(50);
  });

  it('maneja 401 limpiando sesion y redirigiendo', async () => {
    fetchCashboxObjectives.mockRejectedValueOnce({ status: 401, message: 'No autorizado' });

    renderHook(() => useObjetivosPageController());

    await waitFor(() => {
      expect(clearAuthSession).toHaveBeenCalledTimes(1);
    });

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'auth/clearSession' });
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(toast.error).toHaveBeenCalledWith('Sesion vencida, volve a ingresar');
  });

  it('refresca al recibir evento de caja', async () => {
    getAuthToken.mockReturnValue('token-live');

    renderHook(() => useObjetivosPageController());

    await waitFor(() => {
      expect(eventSourceInstances.length).toBeGreaterThan(0);
    });

    const stream = eventSourceInstances[0];
    act(() => {
      stream.emit('cashbox:update', { type: 'sale' });
    });

    await waitFor(() => {
      expect(fetchCashboxObjectives).toHaveBeenCalledTimes(2);
    });
  });
});
