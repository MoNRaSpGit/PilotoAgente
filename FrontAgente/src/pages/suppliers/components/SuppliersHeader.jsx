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
  return (
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
  );
}
