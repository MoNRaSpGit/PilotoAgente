import { Button } from 'react-bootstrap';
import { useCajaPageController } from './caja/useCajaPageController';
import CajaHero from './caja/components/CajaHero';
import CajaLivePanel from './caja/components/CajaLivePanel';
import CajaModals from './caja/components/CajaModals';
import CajaMovementsPanel from './caja/components/CajaMovementsPanel';
import CajaPaymentPanel from './caja/components/CajaPaymentPanel';
import CajaRankingPanel from './caja/components/CajaRankingPanel';
import CajaSummaryGrid from './caja/components/CajaSummaryGrid';

function CajaPage() {
  const {
    closeConfirmOpen,
    closeCloseConfirmModal,
    closeOpenModal,
    comparisonExpanded,
    expandedMovements,
    handleCloseCashbox,
    handleOpenCashbox,
    handlePaymentSubmit,
    isOpen,
    liveSales,
    loading,
    movementSummaryLabel,
    movementsLoading,
    movementsMode,
    openCashboxInfo,
    openCloseConfirmModal,
    openModal,
    openingAmount,
    paymentForm,
    rankingItems,
    rankingLoading,
    rankingMode,
    savingClose,
    savingOpen,
    savingPayment,
    scannerLiveState,
    scannerStatusBadge,
    selectedDay,
    setComparisonExpanded,
    setOpenModal,
    setOpeningAmount,
    setPaymentForm,
    toggleMovementDetails,
    trend,
    user,
    loadMovements,
    loadRanking
  } = useCajaPageController();

  return (
    <section className="page-section caja-page">
      <CajaHero isOpen={isOpen} openCashboxInfo={openCashboxInfo} />

      {!loading && !isOpen ? (
        <div className="card-panel caja-empty-state">
          <h2>La caja del dia no esta abierta</h2>
          <Button variant="dark" onClick={() => setOpenModal(true)}>
            Abrir caja
          </Button>
        </div>
      ) : null}

      {isOpen ? (
        <>
          <div className="caja-section-label">
            <p className="eyebrow">Seccion Caja</p>
          </div>

          <CajaSummaryGrid
            selectedDay={selectedDay}
            comparisonExpanded={comparisonExpanded}
            onToggleComparison={() => setComparisonExpanded((current) => !current)}
            trend={trend}
          />

          <div className="caja-bottom-grid">
            <div className="caja-left-stack">
              <CajaLivePanel scannerStatusBadge={scannerStatusBadge} scannerLiveState={scannerLiveState} />
              <CajaMovementsPanel
                movementsMode={movementsMode}
                movementsLoading={movementsLoading}
                loadMovements={loadMovements}
                movementSummaryLabel={movementSummaryLabel}
                liveSales={liveSales}
                expandedMovements={expandedMovements}
                toggleMovementDetails={toggleMovementDetails}
              />
            </div>

            <div className="caja-right-stack">
              <CajaRankingPanel
                rankingMode={rankingMode}
                rankingLoading={rankingLoading}
                loadRanking={loadRanking}
                rankingItems={rankingItems}
              />
              <CajaPaymentPanel
                handlePaymentSubmit={handlePaymentSubmit}
                paymentForm={paymentForm}
                setPaymentForm={setPaymentForm}
                savingPayment={savingPayment}
                isOpen={isOpen}
                openCloseConfirmModal={openCloseConfirmModal}
                savingClose={savingClose}
              />
            </div>
          </div>
        </>
      ) : null}

      <CajaModals
        openModal={openModal}
        closeOpenModal={closeOpenModal}
        openingAmount={openingAmount}
        setOpeningAmount={setOpeningAmount}
        handleOpenCashbox={handleOpenCashbox}
        user={user}
        savingOpen={savingOpen}
        closeConfirmOpen={closeConfirmOpen}
        closeCloseConfirmModal={closeCloseConfirmModal}
        savingClose={savingClose}
        handleCloseCashbox={handleCloseCashbox}
      />
    </section>
  );
}

export default CajaPage;
