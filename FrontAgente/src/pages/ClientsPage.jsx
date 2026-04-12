import { ClientsHeroForm } from './clients/components/ClientsHeroForm';
import { ClientsModals } from './clients/components/ClientsModals';
import { ClientsTablePanel } from './clients/components/ClientsTablePanel';
import { useClientsPageController } from './clients/useClientsPageController';

function ClientsPage() {
  const {
    clients,
    loading,
    saving,
    error,
    editingClient,
    historyClient,
    historyLoading,
    historyItems,
    historyRange,
    setHistoryRange,
    deliveryForm,
    form,
    handleChange,
    handleSubmit,
    handlePayment,
    openDeliveryModal,
    openHistoryModal,
    closeDeliveryModal,
    closeHistoryModal,
    handleDeliveryChange,
    handleDeliverySubmit,
    editingPreview
  } = useClientsPageController();

  return (
    <section className="page-section clients-page">
      <ClientsHeroForm form={form} saving={saving} handleChange={handleChange} handleSubmit={handleSubmit} />

      <ClientsTablePanel
        loading={loading}
        error={error}
        clients={clients}
        openHistoryModal={openHistoryModal}
        openDeliveryModal={openDeliveryModal}
        handlePayment={handlePayment}
      />

      <ClientsModals
        editingClient={editingClient}
        closeDeliveryModal={closeDeliveryModal}
        deliveryForm={deliveryForm}
        handleDeliveryChange={handleDeliveryChange}
        editingPreview={editingPreview}
        handleDeliverySubmit={handleDeliverySubmit}
        historyClient={historyClient}
        closeHistoryModal={closeHistoryModal}
        historyRange={historyRange}
        setHistoryRange={setHistoryRange}
        historyLoading={historyLoading}
        historyItems={historyItems}
      />
    </section>
  );
}

export default ClientsPage;
