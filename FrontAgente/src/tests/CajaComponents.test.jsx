import { fireEvent, render, screen } from '@testing-library/react';
import CajaMovementsPanel from '../pages/caja/components/CajaMovementsPanel';
import CajaSummaryGrid from '../pages/caja/components/CajaSummaryGrid';

function createTrend(overrides = {}) {
  return {
    comparisonPercent: 10,
    compareDay: { sales_total: 120 },
    weeklySummary: {
      current: { sales_total: 300 },
      previous: { sales_total: 250 },
      comparison_percent: 20
    },
    monthlySummary: {
      current: { sales_total: 800 },
      previous: { sales_total: 700 },
      comparison_percent: 14.29
    },
    ...overrides
  };
}

describe('CajaSummaryGrid', () => {
  it('renderiza metricas y dispara toggle de comparaciones', () => {
    const onToggleComparison = vi.fn();

    render(
      <CajaSummaryGrid
        selectedDay={{
          opening_amount: 100,
          sales_total: 200,
          profit_amount: 40,
          current_amount: 240,
          payments_total: 0
        }}
        comparisonExpanded={false}
        onToggleComparison={onToggleComparison}
        trend={createTrend()}
      />
    );

    expect(screen.getByText(/Caja inicial/i)).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText(/Hoy vs ayer/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Expandir comparaciones/i }));
    expect(onToggleComparison).toHaveBeenCalledTimes(1);
  });
});

describe('CajaMovementsPanel', () => {
  it('muestra estado vacio cuando no hay movimientos', () => {
    render(
      <CajaMovementsPanel
        movementsMode="recent"
        movementsLoading={false}
        loadMovements={vi.fn()}
        movementSummaryLabel="Mostrando ultimos 3"
        liveSales={[]}
        expandedMovements={{}}
        toggleMovementDetails={vi.fn()}
      />
    );

    expect(screen.getByText(/Sin movimientos recientes/i)).toBeInTheDocument();
  });

  it('dispara acciones de ver mas y detalle de movimiento', () => {
    const loadMovements = vi.fn();
    const toggleMovementDetails = vi.fn();

    render(
      <CajaMovementsPanel
        movementsMode="recent"
        movementsLoading={false}
        loadMovements={loadMovements}
        movementSummaryLabel="Mostrando ultimos 3"
        liveSales={[
          {
            id: 'mov-1',
            type: 'sale',
            operatorName: 'Operario 1',
            createdAt: '2026-04-12T10:00:00Z',
            amount: 250,
            description: 'Venta mostrador',
            items: [{ name: 'Arroz', quantity: 2, total: 120 }]
          }
        ]}
        expandedMovements={{ 'mov-1': false }}
        toggleMovementDetails={toggleMovementDetails}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Ver mas/i }));
    expect(loadMovements).toHaveBeenCalledWith('top10');

    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/i }));
    expect(toggleMovementDetails).toHaveBeenCalledWith('mov-1');
  });
});
