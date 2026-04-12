export function SuppliersDayMovementPanel({ providerDaySchedule }) {
  return (
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
  );
}
