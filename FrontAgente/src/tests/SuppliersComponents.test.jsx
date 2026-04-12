import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SuppliersDayMovementPanel } from '../pages/suppliers/components/SuppliersDayMovementPanel';
import { SuppliersHeader } from '../pages/suppliers/components/SuppliersHeader';
import { SuppliersOrderFormPanel } from '../pages/suppliers/components/SuppliersOrderFormPanel';
import { SuppliersRecentOrdersPanel } from '../pages/suppliers/components/SuppliersRecentOrdersPanel';
import { SuppliersWeekAgendaPanel } from '../pages/suppliers/components/SuppliersWeekAgendaPanel';

describe('SuppliersHeader', () => {
  it('renderiza resumen y permite navegar fechas', () => {
    const setSimulatedDate = vi.fn();

    render(
      <SuppliersHeader
        todayHeadline="Hoy llega Acme - $20.00"
        agenda={{ selected_date: '2026-04-12', today: { total_amount: 20 } }}
        simulatedDate="2026-04-12"
        realToday="2026-04-12"
        loading={false}
        setSimulatedDate={setSimulatedDate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Dia anterior/i }));
    expect(setSimulatedDate).toHaveBeenCalledTimes(1);
  });
});

describe('SuppliersDayMovementPanel', () => {
  it('muestra estado vacio en pickup y delivery', () => {
    render(<SuppliersDayMovementPanel providerDaySchedule={{ day: 'lunes', pickup: [], delivery: [] }} />);

    expect(screen.getAllByText(/No hay proveedores/i)).toHaveLength(2);
  });
});

describe('SuppliersWeekAgendaPanel', () => {
  it('muestra agenda vacia cuando no hay items', () => {
    render(
      <SuppliersWeekAgendaPanel
        loading={false}
        agenda={{
          week: []
        }}
      />
    );

    expect(screen.getByText(/No hay agenda cargada esta semana/i)).toBeInTheDocument();
  });
});

describe('SuppliersOrderFormPanel', () => {
  it('permite seleccionar proveedor y enviar formulario', () => {
    const setOrderForm = vi.fn();
    const handleCreateOrder = vi.fn((event) => event.preventDefault());

    render(
      <SuppliersOrderFormPanel
        suppliers={[{ id: 7, nombre: 'Acme' }]}
        orderForm={{ supplier_id: '', expected_amount: '', delivery_date: '', notes: '' }}
        setOrderForm={setOrderForm}
        savingOrder={false}
        handleCreateOrder={handleCreateOrder}
      />
    );

    fireEvent.change(screen.getByDisplayValue('Seleccionar proveedor'), { target: { value: '7' } });
    expect(setOrderForm).toHaveBeenCalled();

    fireEvent.submit(screen.getByRole('button', { name: /Guardar pedido/i }).closest('form'));
    expect(handleCreateOrder).toHaveBeenCalledTimes(1);
  });
});

describe('SuppliersRecentOrdersPanel', () => {
  it('renderiza pedidos recientes', () => {
    render(
      <SuppliersRecentOrdersPanel
        recentOrders={[
          {
            id: 1,
            supplier_name: 'Acme',
            delivery_date: '2026-04-14',
            expected_amount: 33,
            status: 'pending'
          }
        ]}
      />
    );

    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });
});
