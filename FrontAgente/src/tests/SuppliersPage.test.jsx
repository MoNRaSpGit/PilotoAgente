import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import SuppliersPage from '../pages/SuppliersPage';
import { useSuppliersPageController } from '../pages/suppliers/useSuppliersPageController';

vi.mock('../pages/suppliers/useSuppliersPageController', () => ({
  useSuppliersPageController: vi.fn()
}));

function createControllerState(overrides = {}) {
  return {
    loading: false,
    simulatedDate: '2026-04-12',
    setSimulatedDate: vi.fn(),
    realToday: '2026-04-12',
    suppliers: [],
    agenda: {
      selected_date: '2026-04-12',
      today: { total_amount: 0, items: [] },
      week: []
    },
    recentOrders: [],
    savingOrder: false,
    orderForm: {
      supplier_id: '',
      expected_amount: '',
      delivery_date: '',
      notes: ''
    },
    setOrderForm: vi.fn(),
    todayHeadline: 'Hoy no hay llegadas cargadas',
    providerDaySchedule: {
      day: 'domingo',
      pickup: [],
      delivery: []
    },
    handleCreateOrder: vi.fn((event) => event.preventDefault()),
    ...overrides
  };
}

describe('SuppliersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza encabezado y paneles principales', () => {
    useSuppliersPageController.mockReturnValue(createControllerState());

    render(<SuppliersPage />);

    expect(screen.getByRole('heading', { name: /^Proveedores$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Agenda semanal de llegadas/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Pedidos recientes/i })).toBeInTheDocument();
  });

  it('envia formulario de pedido', () => {
    const handleCreateOrder = vi.fn((event) => event.preventDefault());
    useSuppliersPageController.mockReturnValue(createControllerState({ handleCreateOrder }));

    render(<SuppliersPage />);
    fireEvent.submit(screen.getByRole('button', { name: /Guardar pedido/i }).closest('form'));

    expect(handleCreateOrder).toHaveBeenCalledTimes(1);
  });

  it('muestra pedidos recientes cuando hay datos', () => {
    useSuppliersPageController.mockReturnValue(
      createControllerState({
        recentOrders: [
          {
            id: 99,
            supplier_name: 'Acme',
            delivery_date: '2026-04-14',
            expected_amount: 120,
            status: 'pending'
          }
        ]
      })
    );

    render(<SuppliersPage />);

    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText(/Entrega: 2026-04-14/i)).toBeInTheDocument();
  });
});
