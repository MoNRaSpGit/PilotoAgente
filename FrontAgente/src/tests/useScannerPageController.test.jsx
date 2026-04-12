import { act, renderHook, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import toast from 'react-hot-toast';
import authReducer from '../store/slices/authSlice';
import { useScannerPageController } from '../pages/scanner/useScannerPageController';
import {
  createManualProductFromBarcode,
  fetchClients,
  fetchScannerLiveState,
  registerCashboxSale,
  scanProductByBarcode,
  syncScannerLiveState,
  updateClientCharge,
  updateProduct
} from '../services/api';

vi.mock('../services/api', () => ({
  createManualProductFromBarcode: vi.fn(),
  fetchClients: vi.fn(),
  fetchScannerLiveState: vi.fn(),
  registerCashboxSale: vi.fn(),
  scanProductByBarcode: vi.fn(),
  syncScannerLiveState: vi.fn(),
  updateClientCharge: vi.fn(),
  updateProduct: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

function createWrapper(preloadedAuth = { token: '', user: { id: 1, name: 'Admin', role: 'admin' } }) {
  const store = configureStore({
    reducer: {
      auth: authReducer
    },
    preloadedState: {
      auth: preloadedAuth
    }
  });

  return {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
  };
}

describe('useScannerPageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchScannerLiveState.mockResolvedValue({ items: [], version: 1 });
    fetchClients.mockResolvedValue([{ id: 1, nombre: 'Cliente Demo', saldo: 100, status: 'al_dia' }]);
    scanProductByBarcode.mockResolvedValue({
      item: {
        id: 10,
        nombre: 'Arroz',
        precio_venta: 120,
        barcode_normalized: '779123',
        imagen: null
      }
    });
    registerCashboxSale.mockResolvedValue({ meta: { total_ms: 10, register_sale_ms: 8 } });
    createManualProductFromBarcode.mockResolvedValue({ item: { id: 20, nombre: 'Manual', precio_venta: 50, barcode_normalized: 'm1' } });
    updateProduct.mockResolvedValue({});
    updateClientCharge.mockResolvedValue({ id: 1, nombre: 'Cliente Demo' });
    syncScannerLiveState.mockResolvedValue({});
  });

  it('carga estado inicial y clientes para admin', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useScannerPageController(), { wrapper });

    await waitFor(() => {
      expect(fetchScannerLiveState).toHaveBeenCalledWith({ scope: 'own' });
      expect(fetchClients).toHaveBeenCalledTimes(1);
    });

    expect(result.current.userRole).toBe('admin');
    expect(result.current.clients).toHaveLength(1);
  });

  it('escanea producto y lo agrega al ticket', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useScannerPageController(), { wrapper });

    await waitFor(() => {
      expect(fetchScannerLiveState).toHaveBeenCalled();
    });

    act(() => {
      result.current.setBarcode('779123');
    });

    await act(async () => {
      await result.current.handleScanSubmit({ preventDefault: vi.fn() });
    });

    expect(scanProductByBarcode).toHaveBeenCalledWith('779123');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].name).toBe('Arroz');
  });

  it('abre modal unknown cuando barcode no existe', async () => {
    scanProductByBarcode.mockRejectedValueOnce({ status: 404, message: 'No encontrado' });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useScannerPageController(), { wrapper });

    await waitFor(() => {
      expect(fetchScannerLiveState).toHaveBeenCalled();
    });

    act(() => {
      result.current.setBarcode('000404');
    });

    await act(async () => {
      await result.current.handleScanSubmit({ preventDefault: vi.fn() });
    });

    expect(result.current.unknownOpen).toBe(true);
  });

  it('confirma cobro sin cliente y registra venta', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useScannerPageController(), { wrapper });

    await waitFor(() => {
      expect(fetchScannerLiveState).toHaveBeenCalled();
    });

    act(() => {
      result.current.setBarcode('779123');
    });

    await act(async () => {
      await result.current.handleScanSubmit({ preventDefault: vi.fn() });
    });

    act(() => {
      result.current.handleCharge();
    });

    await act(async () => {
      await result.current.handleChargeConfirm();
    });

    await waitFor(() => {
      expect(registerCashboxSale).toHaveBeenCalledTimes(1);
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.chargeOpen).toBe(false);
  });

  it('valida precio manual invalido', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useScannerPageController(), { wrapper });

    await waitFor(() => {
      expect(fetchScannerLiveState).toHaveBeenCalled();
    });

    act(() => {
      result.current.setManualPrice('0');
      result.current.handleManualConfirm();
    });

    expect(toast.error).toHaveBeenCalledWith('Ingresa un valor valido');
  });
});
