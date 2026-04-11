import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Form, Table } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  createExpense,
  fetchExpenses,
  fetchExpensesSummary,
  updateExpense
} from '../services/api';

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function frequencyLabel(value) {
  if (value === 'daily') return 'Diario';
  if (value === 'weekly') return 'Semanal';
  return 'Mensual';
}

const EMPTY_FORM = {
  name: '',
  amount: '',
  frequency: 'monthly',
  scope: 'business',
  notes: '',
  active: true
};

function GastosPage() {
  const formRef = useRef(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    totals: {
      daily_total: 0,
      monthly_total: 0,
      business_daily_total: 0,
      business_monthly_total: 0,
      home_daily_total: 0,
      home_monthly_total: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = async () => {
    try {
      setLoading(true);
      const [nextItems, nextSummary] = await Promise.all([fetchExpenses(), fetchExpensesSummary()]);
      setItems(nextItems);
      setSummary(nextSummary);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      amount: String(item.amount ?? ''),
      frequency: item.frequency || 'monthly',
      scope: item.scope || 'business',
      notes: item.notes || '',
      active: item.active
    });

    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      ...form,
      amount: Number.parseFloat(form.amount)
    };

    if (!payload.name.trim()) {
      toast.error('Ingresá un nombre');
      return;
    }

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      toast.error('Ingresá un monto válido');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await updateExpense(editingId, payload);
        toast.success('Gasto actualizado');
      } else {
        await createExpense(payload);
        toast.success('Gasto creado');
      }
      resetForm();
      await loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item) => {
    try {
      await updateExpense(item.id, {
        active: !item.active
      });
      toast.success(item.active ? 'Gasto desactivado' : 'Gasto activado');
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const totals = summary?.totals || EMPTY_FORM;
  const businessItems = items.filter((item) => item.scope === 'business');
  const homeItems = items.filter((item) => item.scope === 'home');

  const renderExpenseTable = (title, description, rows) => (
    <div className="gastos-group">
      <div className="panel-heading gastos-group-heading">
        <div>
          <h3>{title}</h3>
          <p className="empty-copy">{description}</p>
        </div>
        <Badge bg="light" text="dark">
          {rows.length}
        </Badge>
      </div>

      <Table responsive hover className="gastos-table align-middle">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Monto</th>
            <th>Frecuencia</th>
            <th>Equiv. diario</th>
            <th>Equiv. mensual</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="gastos-item-name">{item.name}</div>
                {item.notes ? <small>{item.notes}</small> : null}
              </td>
              <td>{money(item.amount)}</td>
              <td>{frequencyLabel(item.frequency)}</td>
              <td>{money(item.daily_equivalent)}</td>
              <td>{money(item.monthly_equivalent)}</td>
              <td>
                <Badge bg={item.active ? 'success' : 'secondary'}>{item.active ? 'Activo' : 'Inactivo'}</Badge>
              </td>
              <td>
                <div className="gastos-row-actions">
                  <Button variant="outline-dark" size="sm" onClick={() => handleEdit(item)}>
                    Editar
                  </Button>
                  <Button
                    variant={item.active ? 'outline-danger' : 'outline-success'}
                    size="sm"
                    onClick={() => handleToggleActive(item)}
                  >
                    {item.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );

  return (
    <section className="page-section gastos-page">
      <div className="hero-panel caja-hero gastos-hero">
        <div>
          <p className="eyebrow">Gastos</p>
          <h1>Configuración de costos</h1>
          <p className="empty-copy">Editá costos fijos y variables para estimar mejor la caja.</p>
        </div>
        <div className="gastos-hero-actions">
          <Button as={Link} to="/caja" variant="outline-dark">
            Volver a Caja
          </Button>
          <Button variant="dark" onClick={resetForm}>
            Nuevo gasto
          </Button>
        </div>
      </div>

      <div className="gastos-summary-grid">
        <article className="card-panel caja-stat-card caja-metric-card">
          <span>Negocio diario</span>
          <strong>{money(totals.business_daily_total)}</strong>
        </article>
        <article className="card-panel caja-stat-card caja-metric-card">
          <span>Hogar diario</span>
          <strong>{money(totals.home_daily_total)}</strong>
        </article>
        <article className="card-panel caja-stat-card caja-metric-card">
          <span>Total diario</span>
          <strong>{money(totals.daily_total)}</strong>
        </article>
        <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-accent">
          <span>Total mensual</span>
          <strong>{money(totals.monthly_total)}</strong>
        </article>
      </div>

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
              const nextValue = event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
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

      <div className="card-panel gastos-table-panel">
        <div className="panel-heading">
          <div>
            <h3>Gastos registrados</h3>
            <p className="empty-copy">Primero negocio, después hogar.</p>
          </div>
        </div>

        {loading ? (
          <p className="empty-copy">Cargando gastos...</p>
        ) : (
          <>
            {renderExpenseTable('Negocio', 'Costos del negocio y operación.', businessItems)}
            {renderExpenseTable('Hogar', 'Costos personales y del hogar.', homeItems)}
          </>
        )}
      </div>
    </section>
  );
}

export default GastosPage;
