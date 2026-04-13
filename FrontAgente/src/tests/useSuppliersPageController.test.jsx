import { act, renderHook, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import {
  fetchSupplierProducts,
  fetchSupplierOrders,
  fetchSuppliers,
  fetchSuppliersAgenda,
  upsertSupplierOrderFromProvider
} from '../services/api';
import { useSuppliersPageController } from '../pages/suppliers/useSuppliersPageController';

vi.mock('../services/api', () => ({
  fetchSupplierProducts: vi.fn(),
  fetchSupplierOrders: vi.fn(),
  fetchSuppliers: vi.fn(),
  fetchSuppliersAgenda: vi.fn(),
  upsertSupplierOrderFromProvider: vi.fn()
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
        items: [{ id: 1, supplier_name: 'Acme', expected_amount: 100 }],
        pickup_items: [],
        delivery_items: []
      },
      week: []
    });
    fetchSupplierOrders.mockResolvedValue([]);
    fetchSupplierProducts.mockResolvedValue({
      supplier: { id: 1, nombre: 'Acme' },
      items: [{ id: 10, nombre: 'Leche Conaprole', precio_venta: 100, stock_actual: 5, barcode: '123' }]
    });
    upsertSupplierOrderFromProvider.mockResolvedValue({
      id: 22,
      supplier_id: 1,
      supplier_name: 'Acme',
      order_date: '2026-04-13',
      delivery_date: '2026-04-14',
      items: [{ id: 1, product_id: 10, product_name: 'Leche Conaprole', quantity: 3, unit_cost: 0, line_total: 0 }]
    });
  });

  it('carga proveedores, agenda y pedidos al iniciar sin autoload de productos', async () => {
    const { result } = renderHook(() => useSuppliersPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchSuppliers).toHaveBeenCalledTimes(1);
    expect(fetchSuppliersAgenda).toHaveBeenCalledTimes(1);
    expect(fetchSupplierOrders).toHaveBeenCalledWith({ limit: 30 });
    expect(fetchSupplierProducts).not.toHaveBeenCalled();
    expect(result.current.todayHeadline).toMatch(/Hoy llega Acme/i);
  });

  it('arma schedule semanal y permite seleccionar proveedor con carga de productos', async () => {
    const { result } = renderHook(() => useSuppliersPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weekMovementSchedule).toHaveLength(7);

    act(() => {
      result.current.handleSelectDaySupplier({ id: 1, nombre: 'Acme' }, 'delivery', '2026-04-13');
    });

    await waitFor(() => {
      expect(result.current.selectedDaySupplierDetail?.supplier?.nombre).toBe('Acme');
    });
    expect(fetchSupplierProducts).toHaveBeenCalledWith('1');
  });

  it('confirma pedido desde semana operativa usando alertas', async () => {
    const { result } = renderHook(() => useSuppliersPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.handleSelectDaySupplier({ id: 1, nombre: 'Acme' }, 'delivery', '2026-04-14');
    });

    await waitFor(() => {
      expect(result.current.selectedDaySupplierAlerts?.alerts?.length).toBeGreaterThan(0);
    });

    act(() => {
      const alertItem = result.current.selectedDaySupplierAlerts.alerts[0];
      result.current.handleChangeSelectedDaySupplierAlertQuantity({
        alertItem,
        quantity: 3
      });
    });

    await act(async () => {
      await result.current.handleConfirmSelectedDaySupplierOrder();
    });

    expect(upsertSupplierOrderFromProvider).toHaveBeenCalledWith(expect.objectContaining({
      supplier_id: 1,
      items: [expect.objectContaining({ product_id: 10, quantity: 3 })]
    }));
    expect(upsertSupplierOrderFromProvider).toHaveBeenCalledWith(expect.objectContaining({
      delivery_date: '2026-04-14'
    }));
  });

  it('prioriza pedido pendiente mas reciente para el detalle del dia', async () => {
    fetchSuppliers.mockResolvedValue([
      { id: 1, nombre: 'Acme', dias_pedido: ['lunes'], dias_entrega: ['lunes'] }
    ]);
    fetchSuppliersAgenda.mockResolvedValue({
      selected_date: '2026-04-13',
      today: {
        total_amount: 0,
        items: [],
        pickup_items: [],
        delivery_items: []
      },
      week: []
    });
    fetchSupplierOrders.mockResolvedValue([
      {
        id: 999,
        supplier_id: 1,
        status: 'confirmado',
        delivery_date: '2026-04-13',
        items: [{ id: 1, product_id: 50, product_name: 'Producto viejo', quantity: 1, unit_cost: 0, line_total: 0 }],
        updated_at: '2026-04-13 10:00:00'
      },
      {
        id: 22,
        supplier_id: 1,
        status: 'pendiente',
        delivery_date: '2026-04-13',
        items: [{ id: 2, product_id: 10, product_name: 'Leche', quantity: 5, unit_cost: 0, line_total: 0 }],
        updated_at: '2026-04-13 11:00:00'
      }
    ]);

    const { result } = renderHook(() => useSuppliersPageController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.handleSelectDaySupplier({ id: 1, nombre: 'Acme' }, 'delivery', '2026-04-13');
    });

    await waitFor(() => {
      expect(result.current.selectedDaySupplierDetail?.todayOrder?.id).toBe(22);
    });
  });
});
