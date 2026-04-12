import { formatDateTime, formatMovementAmount, money } from '../cajaPage.utils';

function CajaMovementsPanel({
  movementsMode,
  movementsLoading,
  loadMovements,
  movementSummaryLabel,
  liveSales,
  expandedMovements,
  toggleMovementDetails
}) {
  return (
    <article className="card-panel caja-live-panel">
      <div className="panel-heading">
        <div className="caja-panel-copy">
          <h3>Movimientos</h3>
          <p>Resumen compacto de ventas y pagos confirmados.</p>
        </div>
        <div className="caja-movements-tools">
          <div className="caja-movements-actions">
            {movementsMode === 'recent' ? (
              <button type="button" className="caja-inline-link" onClick={() => loadMovements('top10')} disabled={movementsLoading}>
                Ver mas
              </button>
            ) : null}
            {movementsMode === 'top10' ? (
              <button type="button" className="caja-inline-link" onClick={() => loadMovements('all')} disabled={movementsLoading}>
                Ver todo
              </button>
            ) : null}
            {movementsMode === 'all' ? (
              <button type="button" className="caja-inline-link" onClick={() => loadMovements('recent')} disabled={movementsLoading}>
                Volver a 3
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <small className="caja-movements-caption">{movementSummaryLabel}</small>

      {liveSales.length === 0 ? (
        <div className="caja-live-empty">
          <strong>Sin movimientos recientes</strong>
          <p>Cuando haya ventas confirmadas, este resumen acompana el panel de caja en vivo.</p>
        </div>
      ) : (
        <div className="caja-movements-list">
          {liveSales.map((sale) => (
            <div className="caja-movement-row" key={`movement-${sale.id}`}>
              <div className="caja-movement-head">
                <div>
                  {sale.type === 'payment' ? (
                    <>
                      <strong className="caja-movement-kind">Pago</strong>
                      <span className="caja-movement-meta">{`${sale.operatorName} · ${formatDateTime(sale.createdAt)}`}</span>
                      <p className="caja-movement-description is-highlighted">{sale.description || 'Pago registrado'}</p>
                    </>
                  ) : (
                    <>
                      <strong className="caja-movement-kind is-sale">Venta</strong>
                      <span className="caja-movement-meta">{`${sale.operatorName} · ${formatDateTime(sale.createdAt)}`}</span>
                      <p className="caja-movement-description is-highlighted is-sale">{sale.description || 'Venta desde escaner'}</p>
                    </>
                  )}
                </div>
                <div className="caja-live-sale-head-actions">
                  <strong className={`caja-movement-amount ${sale.type === 'payment' ? 'is-payment' : 'is-sale'}`}>
                    {formatMovementAmount(sale.amount, sale.type)}
                  </strong>
                  {sale.items.length > 0 ? (
                    <button
                      type="button"
                      className="caja-live-sale-toggle"
                      onClick={() => toggleMovementDetails(sale.id)}
                      aria-expanded={Boolean(expandedMovements[sale.id])}
                      aria-label={expandedMovements[sale.id] ? 'Ocultar detalle' : 'Ver detalle'}
                    >
                      <span className={`caja-live-sale-toggle-icon ${expandedMovements[sale.id] ? 'is-open' : ''}`}>
                        {expandedMovements[sale.id] ? '-' : '+'}
                      </span>
                      <span className="caja-live-sale-toggle-label">
                        {expandedMovements[sale.id] ? 'Ocultar' : 'Detalle'}
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>

              {sale.items.length > 0 ? (
                <div className={`caja-live-sale-items ${expandedMovements[sale.id] ? 'is-open' : ''}`}>
                  {sale.items.map((item, index) => (
                    <div className="caja-live-sale-item-row" key={`${sale.id}-${item.barcode || item.name || 'item'}-${index}`}>
                      <span className="caja-live-sale-item-name">
                        {item.quantity} x {item.name}
                      </span>
                      <span className="caja-live-sale-item-total">{money(item.total)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default CajaMovementsPanel;
