import { Button, Form } from 'react-bootstrap';

export function SuppliersOrderFormPanel({
  suppliers,
  orderForm,
  setOrderForm,
  savingOrder,
  handleCreateOrder
}) {
  return (
    <article className="card-panel suppliers-panel">
      <h3>Cargar pedido al proveedor</h3>
      <Form onSubmit={handleCreateOrder} className="suppliers-form">
        <Form.Select
          value={orderForm.supplier_id}
          onChange={(event) => setOrderForm((current) => ({ ...current, supplier_id: event.target.value }))}
        >
          <option value="">Seleccionar proveedor</option>
          {suppliers.map((supplier) => (
            <option key={`sup-${supplier.id}`} value={supplier.id}>
              {supplier.nombre}
            </option>
          ))}
        </Form.Select>
        <Form.Control
          type="date"
          value={orderForm.delivery_date}
          onChange={(event) => setOrderForm((current) => ({ ...current, delivery_date: event.target.value }))}
        />
        <Form.Control
          type="number"
          min="0"
          step="0.01"
          placeholder="Monto esperado"
          value={orderForm.expected_amount}
          onChange={(event) => setOrderForm((current) => ({ ...current, expected_amount: event.target.value }))}
        />
        <Form.Control
          type="text"
          placeholder="Nota opcional"
          value={orderForm.notes}
          onChange={(event) => setOrderForm((current) => ({ ...current, notes: event.target.value }))}
        />
        <Button type="submit" variant="dark" disabled={savingOrder}>
          {savingOrder ? 'Guardando...' : 'Guardar pedido'}
        </Button>
      </Form>
    </article>
  );
}
