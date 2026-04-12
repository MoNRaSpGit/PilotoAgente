import { Button, Form } from 'react-bootstrap';
import { sanitizeAmountInput } from '../gastosPage.utils';

export function GastosFormPanel({ formRef, editingId, form, setForm, saving, handleSubmit, resetForm }) {
  return (
    <div className="card-panel gastos-form-panel" ref={formRef}>
      <div className="panel-heading">
        <div>
          <h3>{editingId ? 'Editar gasto' : 'Nuevo gasto'}</h3>
        </div>
      </div>

      <Form className="gastos-form" onSubmit={handleSubmit}>
        <Form.Control
          type="text"
          placeholder="Nombre"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        />
        <Form.Control
          type="text"
          inputMode="decimal"
          placeholder="Monto"
          value={form.amount}
          onChange={(event) => {
            const nextValue = sanitizeAmountInput(event.target.value);
            setForm((current) => ({ ...current, amount: nextValue }));
          }}
        />
        <Form.Select
          value={form.frequency}
          onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value }))}
        >
          <option value="monthly">Mensual</option>
          <option value="weekly">Semanal</option>
          <option value="daily">Diario</option>
        </Form.Select>
        <Form.Select
          value={form.scope}
          onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value }))}
        >
          <option value="business">Negocio</option>
          <option value="home">Hogar</option>
        </Form.Select>
        <Form.Control
          type="text"
          placeholder="Nota"
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
        />
        <Form.Check
          type="switch"
          label="Activo"
          checked={form.active}
          onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
        />
        <div className="gastos-form-actions">
          <Button type="submit" variant="dark" disabled={saving}>
            {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Agregar'}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline-secondary" onClick={resetForm}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </Form>
    </div>
  );
}
