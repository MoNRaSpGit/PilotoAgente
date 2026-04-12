import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import GastosPage from '../pages/GastosPage';
import { GastosFormPanel } from '../pages/gastos/components/GastosFormPanel';
import { GastosHero } from '../pages/gastos/components/GastosHero';
import { GastosSummaryGrid } from '../pages/gastos/components/GastosSummaryGrid';
import { GastosTablesPanel } from '../pages/gastos/components/GastosTablesPanel';
import { useGastosPageController } from '../pages/gastos/useGastosPageController';

vi.mock('../pages/gastos/useGastosPageController', () => ({
  useGastosPageController: vi.fn()
}));

function createControllerState(overrides = {}) {
  return {
    formRef: { current: null },
    totals: {
      daily_total: 30,
      monthly_total: 300,
      business_daily_total: 20,
      business_monthly_total: 200,
      home_daily_total: 10,
      home_monthly_total: 100
    },
    loading: false,
    saving: false,
    editingId: null,
    form: {
      name: '',
      amount: '',
      frequency: 'monthly',
      scope: 'business',
      notes: '',
      active: true
    },
    setForm: vi.fn(),
    resetForm: vi.fn(),
    handleEdit: vi.fn(),
    handleSubmit: vi.fn((event) => event.preventDefault()),
    handleToggleActive: vi.fn(),
    businessItems: [],
    homeItems: [],
    ...overrides
  };
}

describe('GastosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza la vista principal', () => {
    useGastosPageController.mockReturnValue(createControllerState());

    render(
      <MemoryRouter>
        <GastosPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Configuracion de costos/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Gastos registrados/i })).toBeInTheDocument();
  });

  it('dispara submit del formulario de gastos', () => {
    const handleSubmit = vi.fn((event) => event.preventDefault());
    useGastosPageController.mockReturnValue(createControllerState({ handleSubmit }));

    render(
      <MemoryRouter>
        <GastosPage />
      </MemoryRouter>
    );
    fireEvent.submit(screen.getByRole('button', { name: /Agregar/i }).closest('form'));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('Gastos components', () => {
  it('GastosHero renderiza acciones', () => {
    render(
      <MemoryRouter>
        <GastosHero resetForm={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /Volver a Caja/i })).toBeInTheDocument();
  });

  it('GastosSummaryGrid muestra totales', () => {
    render(
      <GastosSummaryGrid
        totals={{
          business_daily_total: 20,
          home_daily_total: 10,
          daily_total: 30,
          monthly_total: 300
        }}
      />
    );

    expect(screen.getByText('$30.00')).toBeInTheDocument();
  });

  it('GastosFormPanel sanitiza monto y envia formulario', () => {
    const setForm = vi.fn();
    const handleSubmit = vi.fn((event) => event.preventDefault());

    render(
      <GastosFormPanel
        formRef={{ current: null }}
        editingId={null}
        form={{ name: '', amount: '', frequency: 'monthly', scope: 'business', notes: '', active: true }}
        setForm={setForm}
        saving={false}
        handleSubmit={handleSubmit}
        resetForm={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Monto'), { target: { value: '12.3.4a' } });
    expect(setForm).toHaveBeenCalled();

    fireEvent.submit(screen.getByRole('button', { name: /Agregar/i }).closest('form'));
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('GastosTablesPanel muestra estado vacio', () => {
    render(
      <GastosTablesPanel
        loading={false}
        businessItems={[]}
        homeItems={[]}
        handleEdit={vi.fn()}
        handleToggleActive={vi.fn()}
      />
    );

    expect(screen.getByText(/Gastos registrados/i)).toBeInTheDocument();
  });
});
