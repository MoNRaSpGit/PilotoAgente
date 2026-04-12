import { GastosFormPanel } from './gastos/components/GastosFormPanel';
import { GastosHero } from './gastos/components/GastosHero';
import { GastosSummaryGrid } from './gastos/components/GastosSummaryGrid';
import { GastosTablesPanel } from './gastos/components/GastosTablesPanel';
import { useGastosPageController } from './gastos/useGastosPageController';

function GastosPage() {
  const {
    formRef,
    totals,
    loading,
    saving,
    editingId,
    form,
    setForm,
    resetForm,
    handleEdit,
    handleSubmit,
    handleToggleActive,
    businessItems,
    homeItems
  } = useGastosPageController();

  return (
    <section className="page-section gastos-page">
      <GastosHero resetForm={resetForm} />
      <GastosSummaryGrid totals={totals} />
      <GastosFormPanel
        formRef={formRef}
        editingId={editingId}
        form={form}
        setForm={setForm}
        saving={saving}
        handleSubmit={handleSubmit}
        resetForm={resetForm}
      />
      <GastosTablesPanel
        loading={loading}
        businessItems={businessItems}
        homeItems={homeItems}
        handleEdit={handleEdit}
        handleToggleActive={handleToggleActive}
      />
    </section>
  );
}

export default GastosPage;
