import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import toast from 'react-hot-toast';
import {
  createSupplierOrder,
  fetchSupplierOrders,
  fetchSuppliers,
  fetchSuppliersAgenda
} from '../services/api';
import {
  addDays,
  formatDateShort,
  formatMoney,
  getSpanishDayName,
  INITIAL_SUPPLIERS_AGENDA,
  INITIAL_SUPPLIER_ORDER_FORM,
  normalizeISODate,
  parseCsvDays
} from './suppliers/suppliersPage.utils';

function SuppliersPage() {
  const realToday = new Date().toISOString().slice(0, 10);
  const [loading, setLoading] = useState(true);
  const [simulatedDate, setSimulatedDate] = useState(realToday);
  const [suppliers, setSuppliers] = useState([]);
  const [agenda, setAgenda] = useState(INITIAL_SUPPLIERS_AGENDA(realToday));
  const [recentOrders, setRecentOrders] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderForm, setOrderForm] = useState(INITIAL_SUPPLIER_ORDER_FORM);

  const loadData = useCallback(async (dateToLoad) => {
    const targetDate = normalizeISODate(dateToLoad || simulatedDate || realToday);
    try {
      setLoading(true);
      const [supplierItems, agendaData, orderItems] = await Promise.all([
        fetchSuppliers(),
        fetchSuppliersAgenda({ date: targetDate }),
        fetchSupplierOrders({ limit: 8 })
      ]);
      setSuppliers(supplierItems);
      setAgenda(agendaData);
      setRecentOrders(orderItems);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [simulatedDate, realToday]);

  useEffect(() => {
    loadData(simulatedDate);
  }, [loadData, simulatedDate]);

  const todayHeadline = useMemo(() => {
    if (!agenda?.today?.items?.length) {
      return 'Hoy no hay llegadas cargadas';
    }

    const first = agenda.today.items[0];
    return `Hoy llega ${first.supplier_name} - ${formatMoney(first.expected_amount)}`;
  }, [agenda]);

  const providerDaySchedule = useMemo(() => {
    const selectedDay = getSpanishDayName(agenda?.selected_date || simulatedDate);
    const pickup = [];
    const delivery = [];

    for (const supplier of suppliers) {
      const pickupDays = parseCsvDays(supplier?.dias_pedido?.join(','));
      const deliveryDays = parseCsvDays(supplier?.dias_entrega?.join(','));

      if (pickupDays.includes(selectedDay)) {
        pickup.push(supplier);
      }
      if (deliveryDays.includes(selectedDay)) {
        delivery.push(supplier);
      }
    }

    pickup.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));
    delivery.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

    return {
      day: selectedDay,
      pickup,
      delivery
    };
  }, [agenda?.selected_date, simulatedDate, suppliers]);

  const handleCreateOrder = async (event) => {
    event.preventDefault();

    if (!orderForm.supplier_id) {
      toast.error('Selecciona un proveedor');
      return;
    }
    if (!orderForm.delivery_date) {
      toast.error('Selecciona fecha de llegada');
      return;
    }
    if (!Number(orderForm.expected_amount) || Number(orderForm.expected_amount) <= 0) {
      toast.error('Ingresa el monto esperado');
      return;
    }

    try {
      setSavingOrder(true);
      await createSupplierOrder({
        supplier_id: Number(orderForm.supplier_id),
        delivery_date: normalizeISODate(orderForm.delivery_date),
        expected_amount: Number(orderForm.expected_amount),
        notes: orderForm.notes
      });
      toast.success('Pedido guardado');
      setOrderForm(INITIAL_SUPPLIER_ORDER_FORM);
      await loadData(simulatedDate);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <section className="page-section suppliers-page">
      <article className="card-panel suppliers-today-banner">
        <h2>Proveedores</h2>
        <p>{todayHeadline}</p>
        <small className="suppliers-simulated-date">
          Fecha simulada: {formatDateShort(agenda?.selected_date || simulatedDate)}
        </small>
        <strong>Total de hoy: {formatMoney(agenda?.today?.total_amount || 0)}</strong>
        <div className="suppliers-sim-actions">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setSimulatedDate((current) => addDays(current, -1))}
            disabled={loading}
          >
            Dia anterior
          </Button>
          <Button
            variant="outline-dark"
            size="sm"
            onClick={() => setSimulatedDate(realToday)}
            disabled={loading || simulatedDate === realToday}
          >
            Hoy real
          </Button>
          <Button
            variant="dark"
            size="sm"
            onClick={() => setSimulatedDate((current) => addDays(current, 1))}
            disabled={loading}
          >
            Dia siguiente
          </Button>
        </div>
      </article>

      <div className="suppliers-grid">
        <article className="card-panel suppliers-panel">
          <h3>Movimiento de proveedores de hoy</h3>
          <p className="suppliers-panel-subtitle">Dia: {providerDaySchedule.day}</p>
          <div className="suppliers-day-type-grid">
            <div className="suppliers-day-type-col">
              <strong>Levantan pedido</strong>
              {providerDaySchedule.pickup.length === 0 ? (
                <p className="empty-copy">No hay proveedores.</p>
              ) : (
                <div className="suppliers-day-type-list">
                  {providerDaySchedule.pickup.map((supplier) => (
                    <span key={`pickup-${supplier.id}`} className="suppliers-day-chip">
                      {supplier.nombre}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="suppliers-day-type-col">
              <strong>Entregan pedido</strong>
              {providerDaySchedule.delivery.length === 0 ? (
                <p className="empty-copy">No hay proveedores.</p>
              ) : (
                <div className="suppliers-day-type-list">
                  {providerDaySchedule.delivery.map((supplier) => (
                    <span key={`delivery-${supplier.id}`} className="suppliers-day-chip">
                      {supplier.nombre}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="card-panel suppliers-panel">
          <h3>Agenda semanal de llegadas</h3>
          {loading ? <p>Cargando...</p> : null}
          {!loading && (!agenda.week || agenda.week.length === 0) ? (
            <p className="empty-copy">No hay agenda cargada esta semana.</p>
          ) : null}
          <div className="suppliers-week-list">
            {(agenda.week || []).map((day) => (
              <div key={day.date} className="suppliers-day-card">
                <div className="suppliers-day-head">
                  <strong>{day.day_name}</strong>
                  <span>{day.date}</span>
                </div>
                {day.items.length === 0 ? (
                  <p className="empty-copy">Sin llegadas</p>
                ) : (
                  day.items.map((item) => (
                    <div key={`agenda-${item.id}`} className="suppliers-day-item">
                      <span>{item.supplier_name}</span>
                      <strong>{formatMoney(item.expected_amount)}</strong>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </article>

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

        <article className="card-panel suppliers-panel suppliers-panel-full">
          <h3>Pedidos recientes</h3>
          {recentOrders.length === 0 ? (
            <p className="empty-copy">Sin pedidos cargados.</p>
          ) : (
            <div className="suppliers-recent-list">
              {recentOrders.map((order) => (
                <div key={`order-${order.id}`} className="suppliers-recent-row">
                  <div>
                    <strong>{order.supplier_name}</strong>
                    <small>Entrega: {order.delivery_date}</small>
                  </div>
                  <div className="suppliers-recent-amount">
                    <strong>{formatMoney(order.expected_amount)}</strong>
                    <small>{order.status}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

export default SuppliersPage;
