import { Button, Form } from 'react-bootstrap';

export function ClientsHeroForm({ form, saving, handleChange, handleSubmit }) {
  return (
    <div className="hero-panel clients-hero">
      <div>
        <p className="eyebrow">Clientes</p>
        <h1>Control rapido de cuentas</h1>
        <p>Verde al dia, amarillo a 10 dias o menos, rojo si ya vencio.</p>
      </div>

      <Form onSubmit={handleSubmit} className="clients-form">
        <Form.Control name="nombre" value={form.nombre} onChange={handleChange} placeholder="Nombre" />
        <Form.Control
          name="saldo"
          type="number"
          min="0"
          step="0.01"
          value={form.saldo}
          onChange={handleChange}
          placeholder="Deuda"
        />
        <Form.Control
          name="ultima_fecha_pago"
          type="date"
          value={form.ultima_fecha_pago}
          onChange={handleChange}
        />
        <Button type="submit" variant="dark" disabled={saving}>
          {saving ? 'Guardando...' : 'Agregar cliente'}
        </Button>
      </Form>
    </div>
  );
}
