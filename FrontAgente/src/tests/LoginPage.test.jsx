import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import LoginPage from '../pages/LoginPage';
import { LoginPanel } from '../pages/login/components/LoginPanel';
import { useLoginPageController } from '../pages/login/useLoginPageController';

vi.mock('../pages/login/useLoginPageController', () => ({
  useLoginPageController: vi.fn()
}));

function createControllerState(overrides = {}) {
  return {
    form: { email: 'adminnuevo@agente.dev', password: 'AdminNuevo2026!' },
    loading: false,
    panelUnlocked: true,
    handleChange: vi.fn(),
    handleSubmit: vi.fn((event) => event.preventDefault()),
    handleQuickLogin: vi.fn(),
    handleLogoTap: vi.fn(),
    ...overrides
  };
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el panel principal', () => {
    useLoginPageController.mockReturnValue(createControllerState());

    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: /Ingresar/i })).toBeInTheDocument();
  });
});

describe('Login components', () => {
  it('LoginPanel bloqueado no muestra formulario real', () => {
    render(
      <LoginPanel
        form={{ email: '', password: '' }}
        loading={false}
        panelUnlocked={false}
        handleChange={vi.fn()}
        handleSubmit={vi.fn()}
        handleQuickLogin={vi.fn()}
        handleLogoTap={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('usuario@empresa.com')).toBeInTheDocument();
  });

  it('LoginPanel desbloqueado permite submit', () => {
    const handleSubmit = vi.fn((event) => event.preventDefault());

    render(
      <LoginPanel
        form={{ email: 'a@a.com', password: '123' }}
        loading={false}
        panelUnlocked={true}
        handleChange={vi.fn()}
        handleSubmit={handleSubmit}
        handleQuickLogin={vi.fn()}
        handleLogoTap={vi.fn()}
      />
    );

    fireEvent.submit(screen.getByRole('button', { name: /Iniciar sesion/i }).closest('form'));
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });
});
