import { act, renderHook, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import {
  createClient,
  fetchClientHistory,
  fetchClients,
  updateClientDelivery,
  updateClientPayment
} from '../services/api';
import { useClientsPageController } from '../pages/clients/useClientsPageController';

vi.mock('../services/api', () => ({
  createClient: vi.fn(),
  fetchClientHistory: vi.fn(),
  fetchClients: vi.fn(),
  updateClientDelivery: vi.fn(),
  updateClientPayment: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

describe('useClientsPageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchClients.mockResolvedValue([{ id: 1, nombre: 'Cliente 1', saldo: 100, status: 'ok' }]);
    fetchClientHistory.mockResolvedValue([{ id: 11, articulo: 'Arroz', fecha_movimiento: '2026-04-12', cantidad: 1, total: 20 }]);
    createClient.mockResolvedValue({ id: 2, nombre: 'Nuevo cliente', saldo: 50 });
    updateClientPayment.mockResolvedValue({ id: 1, nombre: 'Cliente 1', saldo: 100 });
    updateClientDelivery.mockResolvedValue({ id: 1, nombre: 'Cliente 1', saldo: 80 });
  });

  it('carga clientes al iniciar', async () => {
    const { result } = renderHook(() => useClientsPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchClients).toHaveBeenCalledTimes(1);
    expect(result.current.clients).toHaveLength(1);
  });

  it('valida nombre antes de crear cliente', async () => {
    const { result } = renderHook(() => useClientsPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() });
    });

    expect(createClient).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Ingresa un nombre');
  });

  it('crea cliente con datos validos', async () => {
    const { result } = renderHook(() => useClientsPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.handleChange({ target: { name: 'nombre', value: 'Nuevo cliente' } });
      result.current.handleChange({ target: { name: 'saldo', value: '50' } });
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() });
    });

    expect(createClient).toHaveBeenCalledWith({
      nombre: 'Nuevo cliente',
      saldo: 50,
      ultima_fecha_pago: undefined
    });
    expect(toast.success).toHaveBeenCalledWith('Cliente creado');
  });

  it('valida entrega antes de confirmar movimiento', async () => {
    const { result } = renderHook(() => useClientsPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.openDeliveryModal({ id: 1, nombre: 'Cliente 1', saldo: 100 });
    });

    await act(async () => {
      await result.current.handleDeliverySubmit();
    });

    expect(updateClientDelivery).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Ingresa una entrega valida');
  });

  it('carga historial con debounce al abrir modal', async () => {
    const { result } = renderHook(() => useClientsPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    vi.useFakeTimers();
    try {
      act(() => {
        result.current.openHistoryModal({ id: 5, nombre: 'Cliente 5', saldo: 100 });
      });

      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      expect(fetchClientHistory).toHaveBeenCalledWith(5, { from: undefined, to: undefined });
    } finally {
      vi.useRealTimers();
    }
  });
});
