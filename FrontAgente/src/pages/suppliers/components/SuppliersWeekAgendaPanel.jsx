import { formatMoney } from '../suppliersPage.utils';

export function SuppliersWeekAgendaPanel({ loading, agenda }) {
  return (
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
  );
}
