import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import StockAlertsPanel from '../pages/stock/components/StockAlertsPanel';
import StockControlForm from '../pages/stock/components/StockControlForm';
import StockEntryForm from '../pages/stock/components/StockEntryForm';
import StockHeader from '../pages/stock/components/StockHeader';

describe('StockHeader', () => {
  it('muestra KPIs de resumen', () => {
    render(<StockHeader totals={{ tracked: 5, alerts: 2, critical: 1, warning: 1 }} />);

    expect(screen.getByText(/Total controlados:/i)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});

describe('StockAlertsPanel', () => {
  it('muestra estado vacio cuando no hay alertas', () => {
    render(<StockAlertsPanel loading={false} items={[]} />);

    expect(screen.getByText(/No hay alertas de stock por ahora/i)).toBeInTheDocument();
  });
});

describe('StockEntryForm', () => {
  it('permite seleccionar control y enviar', () => {
    const setEntryForm = vi.fn();
    const handleRegisterEntry = vi.fn((event) => event.preventDefault());

    render(
      <StockEntryForm
        entryForm={{ stock_control_id: '', quantity: '', notes: '' }}
        setEntryForm={setEntryForm}
        availableControls={[{ id: 10, supplier_name: 'Acme', product: { name: 'Leche' } }]}
        handleRegisterEntry={handleRegisterEntry}
        savingEntry={false}
      />
    );

    fireEvent.change(screen.getByDisplayValue('Seleccionar producto controlado'), { target: { value: '10' } });
    expect(setEntryForm).toHaveBeenCalled();

    fireEvent.submit(screen.getByRole('button', { name: /Actualizar stock/i }).closest('form'));
    expect(handleRegisterEntry).toHaveBeenCalledTimes(1);
  });
});

describe('StockControlForm', () => {
  it('dispara toggle de dias y submit', () => {
    const handleToggleDay = vi.fn();
    const handleSaveControl = vi.fn((event) => event.preventDefault());

    render(
      <StockControlForm
        handleSaveControl={handleSaveControl}
        productSearch=""
        setProductSearch={vi.fn()}
        controlForm={{
          product_id: '',
          supplier_name: '',
          delivery_days: [],
          order_days: [],
          critical_threshold: '1',
          warning_threshold: '4',
          target_leftover: '2'
        }}
        setControlForm={vi.fn()}
        products={[]}
        handleToggleDay={handleToggleDay}
        savingConfig={false}
      />
    );

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(handleToggleDay).toHaveBeenCalled();

    fireEvent.submit(screen.getByRole('button', { name: /Guardar control/i }).closest('form'));
    expect(handleSaveControl).toHaveBeenCalledTimes(1);
  });
});
