import { Button, Form } from 'react-bootstrap';

function StockEntryForm({ entryForm, setEntryForm, availableControls, handleRegisterEntry, savingEntry }) {
  return (
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
  );
}

export default StockEntryForm;
