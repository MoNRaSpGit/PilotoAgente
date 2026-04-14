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
    selectedDaySupplierReceivingItems,
    loadingDaySupplierProducts,
    confirmingWeekSupplierId,
    receivingOrderId,
    handleChangeSelectedDaySupplierAlertQuantity,
    handleChangeReceivedItemQuantity,
    handleConfirmSelectedDaySupplierOrder,
    handleReceiveSelectedDaySupplierOrder,
    handleCancelSelectedDaySupplierFlow,
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
          selectedDaySupplierReceivingItems={selectedDaySupplierReceivingItems}
          loadingDaySupplierProducts={loadingDaySupplierProducts}
          confirmingWeekSupplierId={confirmingWeekSupplierId}
          receivingOrderId={receivingOrderId}
          handleChangeSelectedDaySupplierAlertQuantity={handleChangeSelectedDaySupplierAlertQuantity}
          handleChangeReceivedItemQuantity={handleChangeReceivedItemQuantity}
          handleConfirmSelectedDaySupplierOrder={handleConfirmSelectedDaySupplierOrder}
          handleReceiveSelectedDaySupplierOrder={handleReceiveSelectedDaySupplierOrder}
          handleCancelSelectedDaySupplierFlow={handleCancelSelectedDaySupplierFlow}
          handleSelectDaySupplier={handleSelectDaySupplier}
        />
      </div>
    </section>
  );
}

export default SuppliersPage;
