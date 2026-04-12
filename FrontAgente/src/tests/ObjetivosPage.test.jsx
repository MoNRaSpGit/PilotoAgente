import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ObjetivosPage from '../pages/ObjetivosPage';
import { ObjetivosLoadingState } from '../pages/objetivos/components/ObjetivosLoadingState';
import { ObjetivosMainContent } from '../pages/objetivos/components/ObjetivosMainContent';
import { ObjetivosModals } from '../pages/objetivos/components/ObjetivosModals';
import { useObjetivosPageController } from '../pages/objetivos/useObjetivosPageController';

vi.mock('../pages/objetivos/useObjetivosPageController', () => ({
  useObjetivosPageController: vi.fn()
}));

function createControllerState(overrides = {}) {
  return {
    loading: false,
    viewModel: {
      formatMoney: (value) => `$${value}.00`,
      tone: 'curso',
      progress: { level_label: 'En curso' },
      objective: 100,
      currentSales: 50,
      objectiveProgressPercent: 50,
      remainingToObjective: 50,
      remainingToRecord: 100,
      hasObjectiveGoal: true,
      objectiveVisualPercent: 20,
      fillPercent: 50,
      objectiveUnlocked: false,
      recordUnlocked: false,
      openInfoModal: vi.fn()
    },
    celebrateOpen: false,
    setCelebrateOpen: vi.fn(),
    activeReward: { title: 'Objetivo cumplido', reward: 'Ganaste un alfajor', claim: 'Reclama' },
    infoOpen: false,
    setInfoOpen: vi.fn(),
    infoType: 'objetivo',
    infoReward: { reward: 'Ganaste un alfajor', claim: 'Reclama' },
    objectiveUnlocked: false,
    recordUnlocked: false,
    ...overrides
  };
}

describe('ObjetivosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza estado de carga', () => {
    useObjetivosPageController.mockReturnValue(createControllerState({ loading: true }));

    render(<ObjetivosPage />);

    expect(screen.getByRole('heading', { name: /Objetivos/i })).toBeInTheDocument();
    expect(screen.getByText(/Cargando objetivos del dia/i)).toBeInTheDocument();
  });

  it('renderiza contenido principal cuando ya cargo', () => {
    useObjetivosPageController.mockReturnValue(createControllerState());

    render(<ObjetivosPage />);

    expect(screen.getByRole('heading', { name: /^Objetivos$/i })).toBeInTheDocument();
    expect(screen.getByText(/Ventas hoy/i)).toBeInTheDocument();
  });
});

describe('Objetivos components', () => {
  it('ObjetivosLoadingState muestra loading', () => {
    render(<ObjetivosLoadingState />);
    expect(screen.getByText(/Cargando objetivos del dia/i)).toBeInTheDocument();
  });

  it('ObjetivosMainContent dispara modal de objetivo', () => {
    const openInfoModal = vi.fn();

    render(
      <ObjetivosMainContent
        viewModel={{
          formatMoney: (value) => `$${value}.00`,
          tone: 'curso',
          progress: { level_label: 'En curso' },
          objective: 100,
          currentSales: 50,
          objectiveProgressPercent: 50,
          remainingToObjective: 50,
          remainingToRecord: 100,
          hasObjectiveGoal: true,
          objectiveVisualPercent: 20,
          fillPercent: 50,
          openInfoModal
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Objetivo/i }));
    expect(openInfoModal).toHaveBeenCalledWith('objetivo');
  });

  it('ObjetivosModals renderiza premios', () => {
    render(
      <ObjetivosModals
        celebrateOpen={true}
        setCelebrateOpen={vi.fn()}
        activeReward={{ title: 'Objetivo cumplido', reward: 'Ganaste un alfajor', claim: 'Reclama' }}
        infoOpen={true}
        setInfoOpen={vi.fn()}
        infoType="objetivo"
        infoReward={{ reward: 'Ganaste un alfajor', claim: 'Reclama' }}
        objectiveUnlocked={false}
        recordUnlocked={false}
      />
    );

    expect(screen.getByText(/Ganaste un alfajor/i)).toBeInTheDocument();
  });
});
