import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { createClient, fetchClientHistory, fetchClients, updateClientDelivery, updateClientPayment } from '../services/api';

function formatDisplayDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  }).format(date);
}

function getRowClass(status) {
  if (status === 'entrega') {
    return 'client-row client-row-delivery';
  }

  if (status === 'vencido') {
    return 'client-row client-row-danger';
  }

  if (status === 'alerta') {
    return 'client-row client-row-warning';
  }

  return 'client-row client-row-ok';
}

function getStatusLabel(client) {
  if (client.status === 'entrega') {
    return 'Casi al dia';
  }

  if (client.status === 'vencido') {
    return 'Vencido';
  }

  if (client.status === 'alerta') {
    return 'Por vencer';
  }

  return 'Al dia';
}

function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingClient, setEditingClient] = useState(null);
  const [historyClient, setHistoryClient] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyRange, setHistoryRange] = useState({
    from: '',
    to: ''
  });
  const [deliveryForm, setDeliveryForm] = useState({
    entrega: ''
  });
  const [form, setForm] = useState({
    nombre: '',
    saldo: '',
    ultima_fecha_pago: ''
  });

  const loadClients = async () => {
    try {
      setLoading(true);
      setError('');
      const items = await fetchClients();
      setClients(items);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nombre = form.nombre.trim();
    const saldo = form.saldo === '' ? 0 : Number(form.saldo);

    if (!nombre) {
      toast.error('Ingresa un nombre');
      return;
    }

    if (!Number.isFinite(saldo) || saldo < 0) {
      toast.error('Ingresa un saldo valido');
      return;
    }

    try {
      setSaving(true);
      const item = await createClient({
        nombre,
        saldo,
        ultima_fecha_pago: form.ultima_fecha_pago || undefined
      });

      setClients((current) => [item, ...current]);
      setForm({
        nombre: '',
        saldo: '',
        ultima_fecha_pago: ''
      });
      toast.success('Cliente creado');
    } catch (submitError) {
      toast.error(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePayment = async (client) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const updated = await updateClientPayment(client.id, {
        ultima_fecha_pago: today
      });

      setClients((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      toast.success('Pago actualizado');
    } catch (paymentError) {
      toast.error(paymentError.message);
    }
  };

  const openDeliveryModal = (client) => {
    setEditingClient(client);
    setDeliveryForm({
      entrega: ''
    });
  };

  const openHistoryModal = (client) => {
    setHistoryClient(client);
    setHistoryItems([]);
    setHistoryRange({
      from: '',
      to: ''
    });
  };

  const closeDeliveryModal = () => {
    setEditingClient(null);
    setDeliveryForm({
      entrega: ''
    });
  };

  const closeHistoryModal = () => {
    setHistoryClient(null);
    setHistoryItems([]);
    setHistoryRange({
      from: '',
      to: ''
    });
  };

  const handleDeliveryChange = (event) => {
    setDeliveryForm({
      entrega: event.target.value
    });
  };

  const handleDeliverySubmit = async () => {
    if (!editingClient) {
      return;
    }

    const entrega = deliveryForm.entrega === '' ? 0 : Number(deliveryForm.entrega);

    if (!Number.isFinite(entrega) || entrega <= 0) {
      toast.error('Ingresa una entrega valida');
      return;
    }

    try {
      const today = new Date().toISOString().slice(0, 10);
      const updated = await updateClientDelivery(editingClient.id, {
        entrega,
        ultima_fecha_pago: today
      });

      setClients((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      toast.success('Entrega registrada');
      closeDeliveryModal();
    } catch (deliveryError) {
      toast.error(deliveryError.message);
    }
  };

  const loadHistory = async () => {
    if (!historyClient) {
      return;
    }

    try {
      setHistoryLoading(true);
      const items = await fetchClientHistory(historyClient.id, {
        from: historyRange.from || undefined,
        to: historyRange.to || undefined
      });
      setHistoryItems(items);
    } catch (historyError) {
      toast.error(historyError.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!historyClient) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      loadHistory();
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [historyClient, historyRange.from, historyRange.to]);

  const editingPreview = useMemo(() => {
    if (!editingClient) {
      return null;
    }

    const entrega = deliveryForm.entrega === '' ? 0 : Number(deliveryForm.entrega);
    if (!Number.isFinite(entrega) || entrega <= 0) {
      return null;
    }

    return Math.max(Number(editingClient.saldo) - entrega, 0);
  }, [deliveryForm.entrega, editingClient]);

  return (
    <section className="page-section clients-page">
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

      <div className="card-panel">
        <div className="panel-heading">
          <div>
            <h3>Lista de clientes</h3>
            <p>La tabla marca automaticamente el estado segun la fecha de vencimiento.</p>
          </div>
        </div>

        {loading ? (
          <p className="empty-copy">Cargando clientes...</p>
        ) : error ? (
          <p className="error-copy">{error}</p>
        ) : clients.length === 0 ? (
          <p className="empty-copy">Todavia no hay clientes cargados.</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle clients-table">
              <thead>
                <tr>
                  <th className="client-id-column">ID</th>
                  <th>Cliente</th>
                  <th>Deuda</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr className={getRowClass(client.status)} key={client.id}>
                    <td className="client-id-column">{client.id}</td>
                    <td>
                      <strong className="client-name-strong">{client.nombre}</strong>
                    </td>
                    <td>${Number(client.saldo).toFixed(2)}</td>
                    <td>
                      <span className={`client-status-pill client-status-${client.status}`}>{getStatusLabel(client)}</span>
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-2 flex-wrap justify-content-end">
                        <Button size="sm" variant="outline-dark" onClick={() => openHistoryModal(client)}>
                          Ver
                        </Button>
                        <Button size="sm" variant="outline-dark" onClick={() => openDeliveryModal(client)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="dark" onClick={() => handlePayment(client)}>
                          Pago hoy
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal show={Boolean(editingClient)} onHide={closeDeliveryModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Editar deuda</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingClient ? (
            <div className="client-edit-modal">
              <div className="client-edit-row">
                <span>Cliente</span>
                <strong>{editingClient.nombre}</strong>
              </div>
              <div className="client-edit-row">
                <span>Deuda</span>
                <strong>${Number(editingClient.saldo).toFixed(2)}</strong>
              </div>
              <div className="client-edit-row">
                <span>Entregas</span>
                <strong>{editingClient.entregas_count || 0}</strong>
              </div>
              <Form.Group>
                <Form.Label>Entrega</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  step="1"
                  value={deliveryForm.entrega}
                  onChange={handleDeliveryChange}
                  placeholder="Monto entregado"
                />
              </Form.Group>
              {editingPreview !== null ? (
                <div className="client-edit-preview">
                  Nueva deuda: ${editingPreview.toFixed(2)}
                </div>
              ) : null}
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeDeliveryModal}>
            Cancelar
          </Button>
          <Button variant="dark" onClick={handleDeliverySubmit}>
            Guardar entrega
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(historyClient)} onHide={closeHistoryModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Historial</Modal.Title>
        </Modal.Header>
        <Modal.Body className="client-history-body">
          {historyClient ? (
            <>
              <div className="client-history-summary">
                <strong>{historyClient.nombre}</strong>
                <span>Deuda actual: ${Number(historyClient.saldo).toFixed(2)}</span>
              </div>

              <div className="client-history-filters">
                <Form.Control
                  type="date"
                  value={historyRange.from}
                  onChange={(event) =>
                    setHistoryRange((current) => ({
                      ...current,
                      from: event.target.value
                    }))
                  }
                />
                <Form.Control
                  type="date"
                  value={historyRange.to}
                  onChange={(event) =>
                    setHistoryRange((current) => ({
                      ...current,
                      to: event.target.value
                    }))
                  }
                />
              </div>

              {historyLoading ? (
                <p className="empty-copy">Cargando historial...</p>
              ) : historyItems.length === 0 ? (
                <p className="empty-copy">Sin movimientos en ese rango.</p>
              ) : (
                <div className="client-history-list">
                  {historyItems.map((item) => (
                    <div className="client-history-item" key={item.id}>
                      <div>
                        <strong>{item.articulo}</strong>
                        <span>{formatDisplayDate(item.fecha_movimiento)}</span>
                      </div>
                      <div>
                        <span>x{item.cantidad}</span>
                        <strong>${Number(item.total).toFixed(2)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </Modal.Body>
      </Modal>
    </section>
  );
}

export default ClientsPage;
