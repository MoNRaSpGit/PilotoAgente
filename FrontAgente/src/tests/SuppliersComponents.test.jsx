import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SuppliersHeader } from '../pages/suppliers/components/SuppliersHeader';
import { SuppliersWeekMovementPanel } from '../pages/suppliers/components/SuppliersWeekMovementPanel';

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

describe('SuppliersWeekMovementPanel', () => {
  it('muestra pickups y deliveries por dia y permite click', () => {
    const handleSelectDaySupplier = vi.fn();

    render(
      <SuppliersWeekMovementPanel
        weekMovementSchedule={[
          {
            date: '2026-04-13',
            day_name: 'lunes',
            is_today: true,
            pickup: [{ id: 1, nombre: 'Pilsen' }],
            delivery: [{ id: 2, nombre: 'Cocoa' }]
          }
        ]}
        selectedDaySupplierDetail={null}
        selectedDaySupplierAlerts={null}
        loadingDaySupplierProducts={false}
        confirmingWeekSupplierId={null}
        handleChangeSelectedDaySupplierAlertQuantity={vi.fn()}
        handleConfirmSelectedDaySupplierOrder={vi.fn()}
        handleSelectDaySupplier={handleSelectDaySupplier}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cocoa' }));
    expect(handleSelectDaySupplier).toHaveBeenCalledWith({ id: 2, nombre: 'Cocoa' }, 'delivery', '2026-04-13');
  });
});
