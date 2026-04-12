import { SuppliersDayMovementPanel } from './suppliers/components/SuppliersDayMovementPanel';
import { SuppliersHeader } from './suppliers/components/SuppliersHeader';
import { SuppliersOrderFormPanel } from './suppliers/components/SuppliersOrderFormPanel';
import { SuppliersRecentOrdersPanel } from './suppliers/components/SuppliersRecentOrdersPanel';
import { SuppliersWeekAgendaPanel } from './suppliers/components/SuppliersWeekAgendaPanel';
import { useSuppliersPageController } from './suppliers/useSuppliersPageController';

function SuppliersPage() {
  const {
    loading,
    simulatedDate,
    setSimulatedDate,
    realToday,
    suppliers,
    agenda,
    recentOrders,
    savingOrder,
    orderForm,
    setOrderForm,
    todayHeadline,
    providerDaySchedule,
    handleCreateOrder
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
        <SuppliersDayMovementPanel providerDaySchedule={providerDaySchedule} />
        <SuppliersWeekAgendaPanel loading={loading} agenda={agenda} />
        <SuppliersOrderFormPanel
          suppliers={suppliers}
          orderForm={orderForm}
          setOrderForm={setOrderForm}
          savingOrder={savingOrder}
          handleCreateOrder={handleCreateOrder}
        />
        <SuppliersRecentOrdersPanel recentOrders={recentOrders} />
      </div>
    </section>
  );
}

export default SuppliersPage;
