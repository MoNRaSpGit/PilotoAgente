import { useStockPageController } from './stock/useStockPageController';
import StockAlertsPanel from './stock/components/StockAlertsPanel';
import StockControlForm from './stock/components/StockControlForm';
import StockEntryForm from './stock/components/StockEntryForm';
import StockExpectedPanel from './stock/components/StockExpectedPanel';
import StockHeader from './stock/components/StockHeader';

function StockPage() {
  const {
    loading,
    dashboard,
    products,
    productSearch,
    setProductSearch,
    savingConfig,
    savingEntry,
    controlForm,
    setControlForm,
    entryForm,
    setEntryForm,
    availableControls,
    handleToggleDay,
    handleSaveControl,
    handleRegisterEntry
  } = useStockPageController();

  return (
    <section className="page-section stock-page">
      <StockHeader totals={dashboard.totals} />

      <div className="stock-grid">
        <StockAlertsPanel loading={loading} items={dashboard.items || []} />
        <StockExpectedPanel expectedToday={dashboard.expected_today || []} />
        <StockEntryForm
          entryForm={entryForm}
          setEntryForm={setEntryForm}
          availableControls={availableControls}
          handleRegisterEntry={handleRegisterEntry}
          savingEntry={savingEntry}
        />
        <StockControlForm
          handleSaveControl={handleSaveControl}
          productSearch={productSearch}
          setProductSearch={setProductSearch}
          controlForm={controlForm}
          setControlForm={setControlForm}
          products={products}
          handleToggleDay={handleToggleDay}
          savingConfig={savingConfig}
        />
      </div>
    </section>
  );
}

export default StockPage;
