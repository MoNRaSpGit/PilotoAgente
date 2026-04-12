import { act, renderHook, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import {
  createSupplierOrder,
  fetchSupplierProducts,
  fetchSupplierOrders,
  fetchSuppliers,
  fetchSuppliersAgenda
} from '../services/api';
import { useSuppliersPageController } from '../pages/suppliers/useSuppliersPageController';

vi.mock('../services/api', () => ({
  createSupplierOrder: vi.fn(),
  fetchSupplierProducts: vi.fn(),
  fetchSupplierOrders: vi.fn(),
  fetchSuppliers: vi.fn(),
  fetchSuppliersAgenda: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

describe('useSuppliersPageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSuppliers.mockResolvedValue([
      { id: 1, nombre: 'Acme', dias_pedido: ['lunes'], dias_entrega: ['martes'] },
      { id: 2, nombre: 'Beta', dias_pedido: ['miercoles'], dias_entrega: ['lunes'] }
    ]);
    fetchSuppliersAgenda.mockResolvedValue({
      selected_date: '2026-04-13',
      today: {
        total_amount: 100,
        items: [{ id: 1, supplier_name: 'Acme', expected_amount: 100 }]
      },
      week: []
    });
    fetchSupplierOrders.mockResolvedValue([]);
    fetchSupplierProducts.mockResolvedValue({
      supplier: { id: 1, nombre: 'Acme' },
      items: [{ id: 10, nombre: 'Leche Conaprole', precio_venta: 100, stock_actual: 5, barcode: '123' }]
    });
    createSupplierOrder.mockResolvedValue({ id: 11 });
  });

  it('carga proveedores, agenda y pedidos al iniciar', async () => {
    const { result } = renderHook(() => useSuppliersPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchSuppliers).toHaveBeenCalledTimes(1);
    expect(fetchSuppliersAgenda).toHaveBeenCalledTimes(1);
    expect(fetchSupplierOrders).toHaveBeenCalledWith({ limit: 8 });
    expect(fetchSupplierProducts).toHaveBeenCalledWith('1');
    expect(result.current.todayHeadline).toMatch(/Hoy llega Acme/i);
  });

  it('valida proveedor requerido antes de guardar pedido', async () => {
    const { result } = renderHook(() => useSuppliersPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleCreateOrder({ preventDefault: vi.fn() });
    });

    expect(createSupplierOrder).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Selecciona un proveedor');
  });

  it('guarda pedido cuando el formulario es valido', async () => {
    const { result } = renderHook(() => useSuppliersPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setOrderForm({
        supplier_id: '1',
        delivery_date: '2026-04-14',
        expected_amount: '250',
        notes: 'test'
      });
    });

    await act(async () => {
      await result.current.handleCreateOrder({ preventDefault: vi.fn() });
    });

    expect(createSupplierOrder).toHaveBeenCalledWith({
      supplier_id: 1,
      delivery_date: '2026-04-14',
      expected_amount: 250,
      notes: 'test'
    });
    expect(toast.success).toHaveBeenCalledWith('Pedido guardado');
  });

  it('arma schedule de pickup y delivery segun dia seleccionado', async () => {
    const { result } = renderHook(() => useSuppliersPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.providerDaySchedule.day).toBe('lunes');
    expect(result.current.providerDaySchedule.pickup.map((item) => item.nombre)).toContain('Acme');
    expect(result.current.providerDaySchedule.delivery.map((item) => item.nombre)).toContain('Beta');
  });
});
