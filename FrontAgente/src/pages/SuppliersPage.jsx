import { Button, Form } from 'react-bootstrap';
import { addDays, formatDateShort, formatMoney } from './suppliers/suppliersPage.utils';
import { useSuppliersPageController } from './suppliers/useSuppliersPageController';

function SuppliersPage() {
  const {
    loading,
    simulatedDate,
    setSimulatedDate,
    realToday,
    suppliers,
    agenda,
    recentOrders,
    savingOrder,
    orderForm,
    setOrderForm,
    todayHeadline,
    providerDaySchedule,
    handleCreateOrder
  } = useSuppliersPageController();

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
