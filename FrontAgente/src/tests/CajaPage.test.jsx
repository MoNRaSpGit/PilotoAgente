import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import CajaPage from '../pages/CajaPage';
import { useCajaPageController } from '../pages/caja/useCajaPageController';

vi.mock('../pages/caja/useCajaPageController', () => ({
  useCajaPageController: vi.fn()
}));

function createControllerState(overrides = {}) {
  return {
    closeConfirmOpen: false,
    closeCloseConfirmModal: vi.fn(),
    closeOpenModal: vi.fn(),
    comparisonExpanded: false,
    expandedMovements: {},
    handleCloseCashbox: vi.fn().mockResolvedValue(undefined),
    handleOpenCashbox: vi.fn().mockResolvedValue(undefined),
    handlePaymentSubmit: vi.fn(),
    isOpen: false,
    liveSales: [],
    loading: false,
    movementSummaryLabel: 'Mostrando ultimos 3',
    movementsLoading: false,
    movementsMode: 'recent',
    openCashboxInfo: null,
    openCloseConfirmModal: vi.fn(),
    openModal: false,
    openingAmount: '',
    paymentForm: { amount: '', description: '' },
    rankingItems: [],
    rankingLoading: false,
    rankingMode: 'top5',
    savingClose: false,
    savingOpen: false,
    savingPayment: false,
    scannerLiveState: { items: [], editing: null, manual: null, total: 0, updated_at: null, operator: null },
    scannerStatusBadge: { tone: 'idle', bg: 'secondary', text: 'light', label: 'Inactivo' },
    selectedDay: { opening_amount: 0, sales_total: 0, profit_amount: 0, current_amount: 0, payments_total: 0 },
    setComparisonExpanded: vi.fn(),
    setOpenModal: vi.fn(),
    setOpeningAmount: vi.fn(),
    setPaymentForm: vi.fn(),
    toggleMovementDetails: vi.fn(),
    trend: {
      comparisonPercent: null,
      compareDay: { sales_total: 0 },
      weeklySummary: { current: { sales_total: 0 }, previous: { sales_total: 0 }, comparison_percent: null },
      monthlySummary: { current: { sales_total: 0 }, previous: { sales_total: 0 }, comparison_percent: null }
    },
    user: null,
    loadMovements: vi.fn(),
    loadRanking: vi.fn(),
    ...overrides
  };
}

describe('CajaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el estado vacio cuando la caja esta cerrada', () => {
    useCajaPageController.mockReturnValue(createControllerState({ isOpen: false, loading: false }));

    render(<CajaPage />);

    expect(screen.getByText(/La caja del dia no esta abierta/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir caja/i })).toBeInTheDocument();
  });

  it('ejecuta apertura desde el modal', () => {
    const handleOpenCashbox = vi.fn().mockResolvedValue(undefined);
    useCajaPageController.mockReturnValue(
      createControllerState({
        openModal: true,
        handleOpenCashbox
      })
    );

    render(<CajaPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Abrir$/i }));

    expect(handleOpenCashbox).toHaveBeenCalledTimes(1);
  });

  it('ejecuta cierre desde el modal de confirmacion', async () => {
    const handleCloseCashbox = vi.fn().mockResolvedValue(undefined);
    useCajaPageController.mockReturnValue(
      createControllerState({
        closeConfirmOpen: true,
        handleCloseCashbox
      })
    );

    render(<CajaPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Cerrar caja$/i }));

    await waitFor(() => {
      expect(handleCloseCashbox).toHaveBeenCalledTimes(1);
    });
  });
});
