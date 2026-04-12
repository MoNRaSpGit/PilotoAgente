import { ObjetivosLoadingState } from './objetivos/components/ObjetivosLoadingState';
import { ObjetivosMainContent } from './objetivos/components/ObjetivosMainContent';
import { ObjetivosModals } from './objetivos/components/ObjetivosModals';
import { useObjetivosPageController } from './objetivos/useObjetivosPageController';

function ObjetivosPage() {
  const {
    loading,
    viewModel,
    celebrateOpen,
    setCelebrateOpen,
    activeReward,
    infoOpen,
    setInfoOpen,
    infoType,
    infoReward,
    objectiveUnlocked,
    recordUnlocked
  } = useObjetivosPageController();

  if (loading) {
    return <ObjetivosLoadingState />;
  }

  return (
    <section className="page-section objectives-page">
      <ObjetivosMainContent viewModel={viewModel} />
      <ObjetivosModals
        celebrateOpen={celebrateOpen}
        setCelebrateOpen={setCelebrateOpen}
        activeReward={activeReward}
        infoOpen={infoOpen}
        setInfoOpen={setInfoOpen}
        infoType={infoType}
        infoReward={infoReward}
        objectiveUnlocked={objectiveUnlocked}
        recordUnlocked={recordUnlocked}
      />
    </section>
  );
}

export default ObjetivosPage;
