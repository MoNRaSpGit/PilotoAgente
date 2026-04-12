import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ClientsPage from '../pages/ClientsPage';
import { ClientsHeroForm } from '../pages/clients/components/ClientsHeroForm';
import { ClientsModals } from '../pages/clients/components/ClientsModals';
import { ClientsTablePanel } from '../pages/clients/components/ClientsTablePanel';
import { useClientsPageController } from '../pages/clients/useClientsPageController';

vi.mock('../pages/clients/useClientsPageController', () => ({
  useClientsPageController: vi.fn()
}));

function createControllerState(overrides = {}) {
  return {
    clients: [],
    loading: false,
    saving: false,
    error: '',
    editingClient: null,
    historyClient: null,
    historyLoading: false,
    historyItems: [],
    historyRange: { from: '', to: '' },
    setHistoryRange: vi.fn(),
    deliveryForm: { entrega: '' },
    form: { nombre: '', saldo: '', ultima_fecha_pago: '' },
    handleChange: vi.fn(),
    handleSubmit: vi.fn((event) => event.preventDefault()),
    handlePayment: vi.fn(),
    openDeliveryModal: vi.fn(),
    openHistoryModal: vi.fn(),
    closeDeliveryModal: vi.fn(),
    closeHistoryModal: vi.fn(),
    handleDeliveryChange: vi.fn(),
    handleDeliverySubmit: vi.fn(),
    editingPreview: null,
    ...overrides
  };
}

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza la vista principal', () => {
    useClientsPageController.mockReturnValue(createControllerState());

    render(<ClientsPage />);

    expect(screen.getByRole('heading', { name: /Control rapido de cuentas/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Lista de clientes/i })).toBeInTheDocument();
  });

  it('envia el formulario de cliente', () => {
    const handleSubmit = vi.fn((event) => event.preventDefault());
    useClientsPageController.mockReturnValue(createControllerState({ handleSubmit }));

    render(<ClientsPage />);
    fireEvent.submit(screen.getByRole('button', { name: /Agregar cliente/i }).closest('form'));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('Clients components', () => {
  it('ClientsHeroForm dispara submit', () => {
    const handleSubmit = vi.fn((event) => event.preventDefault());

    render(
      <ClientsHeroForm
        form={{ nombre: '', saldo: '', ultima_fecha_pago: '' }}
        saving={false}
        handleChange={vi.fn()}
        handleSubmit={handleSubmit}
      />
    );

    fireEvent.submit(screen.getByRole('button', { name: /Agregar cliente/i }).closest('form'));
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('ClientsTablePanel muestra estado vacio', () => {
    render(
      <ClientsTablePanel
        loading={false}
        error=""
        clients={[]}
        openHistoryModal={vi.fn()}
        openDeliveryModal={vi.fn()}
        handlePayment={vi.fn()}
      />
    );

    expect(screen.getByText(/Todavia no hay clientes cargados/i)).toBeInTheDocument();
  });

  it('ClientsModals renderiza historial y editar deuda', () => {
    render(
      <ClientsModals
        editingClient={{ nombre: 'Cliente 1', saldo: 120, entregas_count: 2 }}
        closeDeliveryModal={vi.fn()}
        deliveryForm={{ entrega: '20' }}
        handleDeliveryChange={vi.fn()}
        editingPreview={100}
        handleDeliverySubmit={vi.fn()}
        historyClient={{ nombre: 'Cliente 1', saldo: 120 }}
        closeHistoryModal={vi.fn()}
        historyRange={{ from: '', to: '' }}
        setHistoryRange={vi.fn()}
        historyLoading={false}
        historyItems={[]}
      />
    );

    expect(screen.getByText(/Editar deuda/i)).toBeInTheDocument();
    expect(screen.getByText(/Historial/i)).toBeInTheDocument();
  });
});
