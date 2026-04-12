import { Button, Form } from 'react-bootstrap';
import { useStockPageController } from './stock/useStockPageController';
import {
  statusLabel,
  WEEK_DAYS
} from './stock/stockPage.utils';

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
      <header className="stock-header card-panel">
        <h2>Stock Controlado</h2>
        <p>Solo muestra alertas. Si un producto esta bien regulado, no aparece.</p>
        <div className="stock-kpis">
          <span>Total controlados: <strong>{dashboard.totals?.tracked || 0}</strong></span>
          <span>Alertas: <strong>{dashboard.totals?.alerts || 0}</strong></span>
          <span>Rojos: <strong>{dashboard.totals?.critical || 0}</strong></span>
          <span>Amarillos: <strong>{dashboard.totals?.warning || 0}</strong></span>
        </div>
      </header>

      <div className="stock-grid">
        <article className="card-panel stock-panel">
          <h3>Alertas</h3>
          {loading ? <p>Cargando...</p> : null}
          {!loading && dashboard.items?.length === 0 ? (
            <p className="empty-copy">No hay alertas de stock por ahora.</p>
          ) : null}
          <div className="stock-alert-list">
            {(dashboard.items || []).map((item) => (
              <div key={item.id} className={`stock-alert-row stock-${item.status}`}>
                <div>
                  <strong>{item.product.name}</strong>
                  <small>{item.supplier_name || 'Sin proveedor'}</small>
                </div>
                <div className="stock-alert-meta">
                  <span>{statusLabel(item.status)}</span>
                  <strong>Stock {item.product.stock_actual}</strong>
                  <small>Sugerido: {item.metrics.suggested_purchase}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card-panel stock-panel">
          <h3>Llegadas de Hoy</h3>
          {(dashboard.expected_today || []).length === 0 ? (
            <p className="empty-copy">Hoy no hay entregas configuradas.</p>
          ) : (
            <div className="stock-expected-list">
              {(dashboard.expected_today || []).map((item) => (
                <div key={`expected-${item.id}`} className="stock-expected-row">
                  <strong>{item.product.name}</strong>
                  <span>{item.supplier_name || 'Sin proveedor'}</span>
                  <small>Stock actual: {item.product.stock_actual}</small>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card-panel stock-panel">
          <h3>Ingresar Mercaderia</h3>
          <Form onSubmit={handleRegisterEntry} className="stock-form">
            <Form.Select
              value={entryForm.stock_control_id}
              onChange={(event) => setEntryForm((current) => ({ ...current, stock_control_id: event.target.value }))}
            >
              <option value="">Seleccionar producto controlado</option>
              {availableControls.map((control) => (
                <option key={`entry-${control.id}`} value={control.id}>
                  {control.product?.name} ({control.supplier_name || 'Sin proveedor'})
                </option>
              ))}
            </Form.Select>
            <Form.Control
              type="number"
              min="1"
              placeholder="Cantidad que llego"
              value={entryForm.quantity}
              onChange={(event) => setEntryForm((current) => ({ ...current, quantity: event.target.value }))}
            />
            <Form.Control
              type="text"
              placeholder="Nota opcional"
              value={entryForm.notes}
              onChange={(event) => setEntryForm((current) => ({ ...current, notes: event.target.value }))}
            />
            <Button type="submit" variant="dark" disabled={savingEntry}>
              {savingEntry ? 'Guardando...' : 'Actualizar stock'}
            </Button>
          </Form>
        </article>

        <article className="card-panel stock-panel stock-panel-full">
          <h3>Configurar Producto Controlado</h3>
          <Form onSubmit={handleSaveControl} className="stock-form">
            <Form.Control
              type="text"
              placeholder="Buscar por nombre, codigo o categoria"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
            />
            <Form.Select
              value={controlForm.product_id}
              onChange={(event) => setControlForm((current) => ({ ...current, product_id: event.target.value }))}
            >
              <option value="">Seleccionar producto</option>
              {products.map((product) => (
                <option key={`product-${product.id}`} value={product.id}>
                  {product.name} - stock {product.stock_actual}
                </option>
              ))}
            </Form.Select>
            <Form.Control
              type="text"
              placeholder="Proveedor (ej: Conaprole)"
              value={controlForm.supplier_name}
              onChange={(event) => setControlForm((current) => ({ ...current, supplier_name: event.target.value }))}
            />

            <div className="stock-days-grid">
              <div>
                <strong>Dias de pedido</strong>
                <div className="stock-days-row">
                  {WEEK_DAYS.map((day) => (
                    <label key={`order-${day.value}`} className="stock-day-pill">
                      <input
                        type="checkbox"
                        checked={controlForm.order_days.includes(day.value)}
                        onChange={() => handleToggleDay('order_days', day.value)}
                      />
                      <span>{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <strong>Dias de llegada</strong>
                <div className="stock-days-row">
                  {WEEK_DAYS.map((day) => (
                    <label key={`delivery-${day.value}`} className="stock-day-pill">
                      <input
                        type="checkbox"
                        checked={controlForm.delivery_days.includes(day.value)}
                        onChange={() => handleToggleDay('delivery_days', day.value)}
                      />
                      <span>{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="stock-threshold-row">
              <Form.Control
                type="number"
                min="0"
                placeholder="Rojo (critico)"
                value={controlForm.critical_threshold}
                onChange={(event) => setControlForm((current) => ({ ...current, critical_threshold: event.target.value }))}
              />
              <Form.Control
                type="number"
                min="0"
                placeholder="Amarillo"
                value={controlForm.warning_threshold}
                onChange={(event) => setControlForm((current) => ({ ...current, warning_threshold: event.target.value }))}
              />
              <Form.Control
                type="number"
                min="0"
                placeholder="Sobra ideal"
                value={controlForm.target_leftover}
                onChange={(event) => setControlForm((current) => ({ ...current, target_leftover: event.target.value }))}
              />
            </div>

            <Button type="submit" variant="dark" disabled={savingConfig}>
              {savingConfig ? 'Guardando...' : 'Guardar control'}
            </Button>
          </Form>
        </article>
      </div>
    </section>
  );
}

export default StockPage;
