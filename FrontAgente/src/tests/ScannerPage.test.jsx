import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ScannerPage from '../pages/ScannerPage';
import { useScannerPageController } from '../pages/scanner/useScannerPageController';

vi.mock('../pages/scanner/useScannerPageController', () => ({
  useScannerPageController: vi.fn()
}));

function createControllerState(overrides = {}) {
  return {
    barcodeInputRef: { current: null },
    manualPriceRef: { current: null },
    unknownPriceRef: { current: null },
    editPriceRef: { current: null },
    barcode: '',
    setBarcode: vi.fn(),
    userRole: 'admin',
    clientQuery: '',
    setClientQuery: vi.fn(),
    setSelectedClient: vi.fn(),
    clients: [],
    focusScanner: vi.fn(),
    clearSelectedClient: vi.fn(),
    selectedClient: null,
    manualOpen: false,
    setManualOpen: vi.fn(),
    manualPrice: '',
    setManualPrice: vi.fn(),
    closeManualModal: vi.fn(),
    handleManualConfirm: vi.fn(),
    unknownOpen: false,
    unknownPrice: '',
    setUnknownPrice: vi.fn(),
    closeUnknownModal: vi.fn(),
    handleUnknownConfirm: vi.fn(),
    editOpen: false,
    editName: '',
    setEditName: vi.fn(),
    editPrice: '',
    setEditPrice: vi.fn(),
    closeEditModal: vi.fn(),
    handleEditConfirm: vi.fn(),
    chargeOpen: false,
    closeChargeModal: vi.fn(),
    totalAmount: 0,
    handleChargeCancel: vi.fn(),
    handleChargeConfirm: vi.fn(),
    selectedClientData: null,
    chargeClientConfirmOpen: false,
    closeChargeClientConfirm: vi.fn(),
    chargeSnapshotTotal: 0,
    handleChargeToClientConfirm: vi.fn(),
    items: [],
    handleItemPointerDown: vi.fn(),
    clearItemPress: vi.fn(),
    handleItemClick: vi.fn(),
    openItemEditor: vi.fn(),
    changeItemQuantity: vi.fn(),
    handleCharge: vi.fn(),
    handleScanSubmit: vi.fn((event) => event.preventDefault()),
    ...overrides
  };
}

describe('ScannerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza input de escaneo y estado vacio', () => {
    useScannerPageController.mockReturnValue(createControllerState());

    render(<ScannerPage />);

    expect(screen.getByPlaceholderText(/Escanea aqui/i)).toBeInTheDocument();
    expect(screen.getByText(/Todavia no agregaste productos/i)).toBeInTheDocument();
  });

  it('dispara abrir modal manual desde boton Producto Manual', () => {
    const setManualOpen = vi.fn();
    useScannerPageController.mockReturnValue(createControllerState({ setManualOpen }));

    render(<ScannerPage />);
    fireEvent.click(screen.getByRole('button', { name: /Producto Manual/i }));

    expect(setManualOpen).toHaveBeenCalledWith(true);
  });

  it('dispara cobro cuando hay items', () => {
    const handleCharge = vi.fn();
    useScannerPageController.mockReturnValue(
      createControllerState({
        items: [
          {
            key: '123',
            name: 'Arroz',
            price: 100,
            quantity: 1,
            total: 100,
            hasImage: false,
            imageUrl: ''
          }
        ],
        totalAmount: 100,
        handleCharge
      })
    );

    render(<ScannerPage />);
    fireEvent.click(screen.getByRole('button', { name: /Cobrar/i }));

    expect(handleCharge).toHaveBeenCalledTimes(1);
  });
});
