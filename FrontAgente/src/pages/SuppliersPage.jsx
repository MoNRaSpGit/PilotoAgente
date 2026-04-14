import { SuppliersHeader } from './suppliers/components/SuppliersHeader';
import { SuppliersInvoiceIncidentsPanel } from './suppliers/components/SuppliersInvoiceIncidentsPanel';
import { SuppliersUnassignedCriticalPanel } from './suppliers/components/SuppliersUnassignedCriticalPanel';
import { SuppliersWeekMovementPanel } from './suppliers/components/SuppliersWeekMovementPanel';
import { useSuppliersPageController } from './suppliers/useSuppliersPageController';

function SuppliersPage() {
  const {
    loading,
    simulatedDate,
    setSimulatedDate,
    realToday,
    suppliers,
    agenda,
    todayHeadline,
    selectedDaySupplierDetail,
    selectedDaySupplierAlerts,
    selectedDaySupplierReceivingItems,
    selectedDaySupplierInvoiceSummary,
    invoiceIncidents,
    unassignedCriticalProducts,
    loadingUnassignedCriticalProducts,
    assigningSupplierProductId,
    selectedSupplierByProductId,
    loadingDaySupplierProducts,
    confirmingWeekSupplierId,
    receivingOrderId,
    handleChangeSelectedDaySupplierAlertQuantity,
    handleChangeSelectedDaySupplierAlertUnitCost,
    handleChangeReceivedItemQuantity,
    handleChangeInvoiceAmount,
    handleConfirmSelectedDaySupplierOrder,
    handleReceiveSelectedDaySupplierOrder,
    handleCancelSelectedDaySupplierFlow,
    handleSelectSupplierForUnassignedProduct,
    handleAssignSupplierToUnassignedProduct,
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
          selectedDaySupplierInvoiceSummary={selectedDaySupplierInvoiceSummary}
          loadingDaySupplierProducts={loadingDaySupplierProducts}
          confirmingWeekSupplierId={confirmingWeekSupplierId}
          receivingOrderId={receivingOrderId}
          allowReceiveConfirmation={false}
          handleChangeSelectedDaySupplierAlertQuantity={handleChangeSelectedDaySupplierAlertQuantity}
          handleChangeSelectedDaySupplierAlertUnitCost={handleChangeSelectedDaySupplierAlertUnitCost}
          handleChangeReceivedItemQuantity={handleChangeReceivedItemQuantity}
          handleChangeInvoiceAmount={handleChangeInvoiceAmount}
          handleConfirmSelectedDaySupplierOrder={handleConfirmSelectedDaySupplierOrder}
          handleReceiveSelectedDaySupplierOrder={handleReceiveSelectedDaySupplierOrder}
          handleCancelSelectedDaySupplierFlow={handleCancelSelectedDaySupplierFlow}
          handleSelectDaySupplier={handleSelectDaySupplier}
        />

        <SuppliersUnassignedCriticalPanel
          items={unassignedCriticalProducts}
          suppliers={suppliers}
          loading={loadingUnassignedCriticalProducts}
          assigningProductId={assigningSupplierProductId}
          selectedSupplierByProductId={selectedSupplierByProductId}
          onSelectSupplier={handleSelectSupplierForUnassignedProduct}
          onAssignSupplier={handleAssignSupplierToUnassignedProduct}
        />

        <SuppliersInvoiceIncidentsPanel items={invoiceIncidents} />
      </div>
    </section>
  );
}

export default SuppliersPage;
