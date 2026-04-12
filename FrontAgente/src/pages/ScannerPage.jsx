import { useScannerPageController } from './scanner/useScannerPageController';
import ScannerClientBox from './scanner/components/ScannerClientBox';
import ScannerInputForm from './scanner/components/ScannerInputForm';
import ScannerModals from './scanner/components/ScannerModals';
import ScannerTicketPanel from './scanner/components/ScannerTicketPanel';

function ScannerPage() {
  const {
    barcodeInputRef,
    manualPriceRef,
    unknownPriceRef,
    editPriceRef,
    barcode,
    setBarcode,
    userRole,
    clientQuery,
    setClientQuery,
    setSelectedClient,
    clients,
    focusScanner,
    clearSelectedClient,
    selectedClient,
    manualOpen,
    setManualOpen,
    manualPrice,
    setManualPrice,
    closeManualModal,
    handleManualConfirm,
    unknownOpen,
    unknownPrice,
    setUnknownPrice,
    closeUnknownModal,
    handleUnknownConfirm,
    editOpen,
    editName,
    setEditName,
    editPrice,
    setEditPrice,
    closeEditModal,
    handleEditConfirm,
    chargeOpen,
    closeChargeModal,
    totalAmount,
    handleChargeCancel,
    handleChargeConfirm,
    selectedClientData,
    chargeClientConfirmOpen,
    closeChargeClientConfirm,
    chargeSnapshotTotal,
    handleChargeToClientConfirm,
    items,
    handleItemPointerDown,
    clearItemPress,
    handleItemClick,
    openItemEditor,
    changeItemQuantity,
    handleCharge,
    handleScanSubmit
  } = useScannerPageController();

  return (
    <section className="page-section scanner-page">
      <div className="scanner-shell">
        <ScannerInputForm
          barcodeInputRef={barcodeInputRef}
          barcode={barcode}
          setBarcode={setBarcode}
          handleScanSubmit={handleScanSubmit}
        />

        <ScannerClientBox
          userRole={userRole}
          clientQuery={clientQuery}
          setClientQuery={setClientQuery}
          setSelectedClient={setSelectedClient}
          clients={clients}
          focusScanner={focusScanner}
          clearSelectedClient={clearSelectedClient}
          selectedClient={selectedClient}
        />

        <ScannerTicketPanel
          items={items}
          setManualOpen={setManualOpen}
          handleItemPointerDown={handleItemPointerDown}
          clearItemPress={clearItemPress}
          handleItemClick={handleItemClick}
          openItemEditor={openItemEditor}
          changeItemQuantity={changeItemQuantity}
          focusScanner={focusScanner}
          totalAmount={totalAmount}
          handleCharge={handleCharge}
        />
      </div>

      <ScannerModals
        manualOpen={manualOpen}
        closeManualModal={closeManualModal}
        manualPriceRef={manualPriceRef}
        focusScanner={focusScanner}
        manualPrice={manualPrice}
        setManualPrice={setManualPrice}
        handleManualConfirm={handleManualConfirm}
        unknownOpen={unknownOpen}
        closeUnknownModal={closeUnknownModal}
        unknownPriceRef={unknownPriceRef}
        unknownPrice={unknownPrice}
        setUnknownPrice={setUnknownPrice}
        handleUnknownConfirm={handleUnknownConfirm}
        editOpen={editOpen}
        closeEditModal={closeEditModal}
        editPriceRef={editPriceRef}
        editName={editName}
        setEditName={setEditName}
        editPrice={editPrice}
        setEditPrice={setEditPrice}
        handleEditConfirm={handleEditConfirm}
        chargeOpen={chargeOpen}
        closeChargeModal={closeChargeModal}
        totalAmount={totalAmount}
        handleChargeCancel={handleChargeCancel}
        handleChargeConfirm={handleChargeConfirm}
        selectedClientData={selectedClientData}
        chargeClientConfirmOpen={chargeClientConfirmOpen}
        closeChargeClientConfirm={closeChargeClientConfirm}
        chargeSnapshotTotal={chargeSnapshotTotal}
        handleChargeToClientConfirm={handleChargeToClientConfirm}
      />
    </section>
  );
}

export default ScannerPage;
