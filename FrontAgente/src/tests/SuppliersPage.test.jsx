import { render, screen } from '@testing-library/react';
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
    agenda: {
      selected_date: '2026-04-12',
      today: { total_amount: 0, items: [] },
      week: []
    },
    todayHeadline: 'Hoy no hay llegadas cargadas',
    selectedDaySupplierDetail: null,
    selectedDaySupplierAlerts: null,
    loadingDaySupplierProducts: false,
    confirmingWeekSupplierId: null,
    handleChangeSelectedDaySupplierAlertQuantity: vi.fn(),
    handleConfirmSelectedDaySupplierOrder: vi.fn(),
    handleSelectDaySupplier: vi.fn(),
    weekMovementSchedule: [],
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
    expect(screen.getByRole('heading', { name: /Semana operativa/i })).toBeInTheDocument();
  });

});
