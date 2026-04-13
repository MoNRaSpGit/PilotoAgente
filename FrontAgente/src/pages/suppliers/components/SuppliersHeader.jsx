import { Button } from 'react-bootstrap';
import { addDays, formatDateShort, formatMoney } from '../suppliersPage.utils';

export function SuppliersHeader({
  todayHeadline,
  agenda,
  simulatedDate,
  realToday,
  loading,
  setSimulatedDate
}) {
  const todayDeliveryTotal = Number(agenda?.today?.delivery_total_amount ?? agenda?.today?.total_amount ?? 0);
  const todayPickupTotal = Number(agenda?.today?.pickup_total_amount ?? 0);
  const todayDeliveriesCount = Number(agenda?.today?.delivery_items?.length ?? agenda?.today?.items?.length ?? 0);
  const todayPickupsCount = Number(agenda?.today?.pickup_items?.length ?? 0);

  return (
    <article className="card-panel suppliers-today-banner suppliers-hero-banner">
      <div className="suppliers-hero-head">
        <h2>Proveedores</h2>
        <span className="suppliers-hero-date-pill">
          {formatDateShort(agenda?.selected_date || simulatedDate)}
        </span>
      </div>
      <p className="suppliers-hero-copy">{todayHeadline}</p>
      <small className="suppliers-simulated-date">
        Fecha simulada: {formatDateShort(agenda?.selected_date || simulatedDate)}
      </small>

      <div className="suppliers-hero-metrics">
        <div className="suppliers-hero-metric">
          <span>Total de hoy</span>
          <strong>{formatMoney(agenda?.today?.total_amount || 0)}</strong>
        </div>
        <div className="suppliers-hero-metric">
          <span>Entregas</span>
          <strong>{todayDeliveriesCount} ({formatMoney(todayDeliveryTotal)})</strong>
        </div>
        <div className="suppliers-hero-metric">
          <span>Retiros</span>
          <strong>{todayPickupsCount} ({formatMoney(todayPickupTotal)})</strong>
        </div>
      </div>

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
  );
}
