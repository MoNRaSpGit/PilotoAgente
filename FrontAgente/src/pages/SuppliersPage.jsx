import { SuppliersHeader } from './suppliers/components/SuppliersHeader';
import { SuppliersWeekMovementPanel } from './suppliers/components/SuppliersWeekMovementPanel';
import { useSuppliersPageController } from './suppliers/useSuppliersPageController';

function SuppliersPage() {
  const {
    loading,
    simulatedDate,
    setSimulatedDate,
    realToday,
    agenda,
    todayHeadline,
    selectedDaySupplierDetail,
    selectedDaySupplierAlerts,
    loadingDaySupplierProducts,
    confirmingWeekSupplierId,
    handleChangeSelectedDaySupplierAlertQuantity,
    handleConfirmSelectedDaySupplierOrder,
    handleSelectDaySupplier,
    weekMovementSchedule
  } = useSuppliersPageController();

  return (
    <section className="page-section suppliers-page">
      <SuppliersHeader
        todayHeadline={todayHeadline}
        agenda={agenda}
        simulatedDate={simulatedDate}
        realToday={realToday}
        loading={loading}
        setSimulatedDate={setSimulatedDate}
      />

      <div className="suppliers-grid">
        <SuppliersWeekMovementPanel
          weekMovementSchedule={weekMovementSchedule}
          selectedDaySupplierDetail={selectedDaySupplierDetail}
          selectedDaySupplierAlerts={selectedDaySupplierAlerts}
          loadingDaySupplierProducts={loadingDaySupplierProducts}
          confirmingWeekSupplierId={confirmingWeekSupplierId}
          handleChangeSelectedDaySupplierAlertQuantity={handleChangeSelectedDaySupplierAlertQuantity}
          handleConfirmSelectedDaySupplierOrder={handleConfirmSelectedDaySupplierOrder}
          handleSelectDaySupplier={handleSelectDaySupplier}
        />
      </div>
    </section>
  );
}

export default SuppliersPage;
