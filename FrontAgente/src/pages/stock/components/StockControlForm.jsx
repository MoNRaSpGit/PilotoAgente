import { Button, Form } from 'react-bootstrap';
import { WEEK_DAYS } from '../stockPage.utils';

function StockControlForm({
  handleSaveControl,
  productSearch,
  setProductSearch,
  controlForm,
  setControlForm,
  products,
  handleToggleDay,
  savingConfig
}) {
  return (
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
  );
}

export default StockControlForm;
