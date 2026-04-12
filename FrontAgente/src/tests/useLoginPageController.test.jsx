import { act, renderHook, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { loginRequest } from '../services/api';
import { useLoginPageController } from '../pages/login/useLoginPageController';

const mockNavigate = vi.fn();
const mockDispatch = vi.fn();
let selectorState = { auth: { user: null, token: null } };

vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector) => selector(selectorState)
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: () => ({ state: null }),
    useNavigate: () => mockNavigate
  };
});

vi.mock('../services/api', () => ({
  loginRequest: vi.fn()
}));

vi.mock('../store/slices/authSlice', () => ({
  setSession: vi.fn((data) => ({ type: 'auth/setSession', payload: data }))
}));

vi.mock('../utils/authSession', () => ({
  saveAuthSession: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

import { saveAuthSession } from '../utils/authSession';

describe('useLoginPageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectorState = { auth: { user: null, token: null } };
    loginRequest.mockResolvedValue({
      user: { role: 'admin' },
      token: 'token-demo'
    });
  });

  it('permite login rapido como admin', async () => {
    const { result } = renderHook(() => useLoginPageController());

    await act(async () => {
      await result.current.handleQuickLogin('admin');
    });

    expect(loginRequest).toHaveBeenCalledWith({
      email: 'adminnuevo@agente.dev',
      password: 'AdminNuevo2026!'
    });
    expect(saveAuthSession).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/caja', { replace: true });
  });

  it('desbloquea el panel despues de 7 taps', async () => {
    const { result } = renderHook(() => useLoginPageController());

    for (let index = 0; index < 7; index += 1) {
      act(() => {
        result.current.handleLogoTap();
      });
    }

    await waitFor(() => {
      expect(result.current.panelUnlocked).toBe(true);
    });
    expect(toast.success).toHaveBeenCalledWith('Panel de login habilitado');
  });

  it('redirecciona si ya hay sesion activa', async () => {
    selectorState = { auth: { user: { role: 'operario' }, token: 'abc' } };

    renderHook(() => useLoginPageController());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/scanner', { replace: true });
    });
  });
});
