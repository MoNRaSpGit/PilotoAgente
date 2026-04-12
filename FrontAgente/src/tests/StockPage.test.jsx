import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import StockPage from '../pages/StockPage';
import { useStockPageController } from '../pages/stock/useStockPageController';

vi.mock('../pages/stock/useStockPageController', () => ({
  useStockPageController: vi.fn()
}));

function createControllerState(overrides = {}) {
  return {
    loading: false,
    dashboard: {
      items: [],
      expected_today: [],
      totals: { tracked: 3, alerts: 1, critical: 0, warning: 1 }
    },
    products: [],
    productSearch: '',
    setProductSearch: vi.fn(),
    savingConfig: false,
    savingEntry: false,
    controlForm: {
      product_id: '',
      supplier_name: '',
      delivery_days: [],
      order_days: [],
      critical_threshold: '1',
      warning_threshold: '4',
      target_leftover: '2'
    },
    setControlForm: vi.fn(),
    entryForm: {
      stock_control_id: '',
      quantity: '',
      notes: ''
    },
    setEntryForm: vi.fn(),
    availableControls: [],
    handleToggleDay: vi.fn(),
    handleSaveControl: vi.fn((event) => event.preventDefault()),
    handleRegisterEntry: vi.fn((event) => event.preventDefault()),
    ...overrides
  };
}

describe('StockPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza header y paneles base', () => {
    useStockPageController.mockReturnValue(createControllerState());

    render(<StockPage />);

    expect(screen.getByRole('heading', { name: /Stock Controlado/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Alertas/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Configurar Producto Controlado/i })).toBeInTheDocument();
  });

  it('envia formulario de ingreso de mercaderia', () => {
    const handleRegisterEntry = vi.fn((event) => event.preventDefault());
    useStockPageController.mockReturnValue(createControllerState({ handleRegisterEntry }));

    render(<StockPage />);
    fireEvent.submit(screen.getByRole('button', { name: /Actualizar stock/i }).closest('form'));

    expect(handleRegisterEntry).toHaveBeenCalledTimes(1);
  });

  it('envia formulario de configuracion de control', () => {
    const handleSaveControl = vi.fn((event) => event.preventDefault());
    useStockPageController.mockReturnValue(createControllerState({ handleSaveControl }));

    render(<StockPage />);
    fireEvent.submit(screen.getByRole('button', { name: /Guardar control/i }).closest('form'));

    expect(handleSaveControl).toHaveBeenCalledTimes(1);
  });
});
