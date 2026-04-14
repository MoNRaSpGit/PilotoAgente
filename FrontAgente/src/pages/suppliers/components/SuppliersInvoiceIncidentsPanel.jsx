import { useMemo, useState } from 'react';
import { formatMoney } from '../suppliersPage.utils';

export function SuppliersInvoiceIncidentsPanel({ items = [] }) {
  const total = Array.isArray(items) ? items.length : 0;
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(3);
  const visibleItems = useMemo(
    () => (Array.isArray(items) ? items.slice(0, visibleCount) : []),
    [items, visibleCount]
  );
  const hasMore = total > visibleCount;

  const handleExpand = () => {
    setExpanded(true);
    setVisibleCount(3);
  };

  const handleShowMore = () => {
    setVisibleCount((current) => current + 3);
  };

  return (
    <article className="card-panel suppliers-panel suppliers-panel-full suppliers-incidents-panel">
      <h3>Boletas con inconsistencias ({total})</h3>
      {!Array.isArray(items) || total === 0 ? (
        <p className="empty-copy">Sin inconsistencias registradas.</p>
      ) : !expanded ? (
        <button type="button" className="suppliers-link-btn" onClick={handleExpand}>
          Ver mas
        </button>
      ) : (
        <div className="suppliers-incidents-list">
          {visibleItems.map((incident, incidentIndex) => (
            <div
              key={`incident-${incident?.id || `${incident?.supplier_id || 'na'}-${incident?.delivery_date || 'na'}-${incidentIndex}`}`}
              className="suppliers-incident-card"
            >
              <div className="suppliers-incident-head">
                <strong>{incident?.supplier_name || 'Proveedor'}</strong>
                <span>
                  Esperado {formatMoney(incident?.expected_amount || 0)} | Boleta {formatMoney(incident?.invoice_amount || 0)}
                </span>
              </div>
              <small>
                Diferencia: {formatMoney(incident?.invoice_diff || 0)} | Entrega: {incident?.delivery_date || '-'}
              </small>
              <div className="suppliers-incident-details">
                {(incident?.details || []).length === 0 ? (
                  <p className="empty-copy">No hay detalle por item, revisar boleta cargada.</p>
                ) : (
                  (incident.details || []).map((detail, detailIndex) => (
                    <div
                      key={`incident-detail-${detail?.id || `${incident?.id || incidentIndex}-${detail?.order_item_id || detailIndex}`}`}
                      className="suppliers-incident-detail-row"
                    >
                      <strong>{detail?.product_name || 'Producto'}</strong>
                      <small>
                        Pedido: {Number(detail?.ordered_quantity || 0)} | Recibido: {Number(detail?.received_quantity || 0)} | Faltante:{' '}
                        {Number(detail?.missing_quantity || 0)}
                      </small>
                      {detail?.discrepancy_note ? (
                        <small>Detalle: {detail.discrepancy_note}</small>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}

          {hasMore ? (
            <button type="button" className="suppliers-link-btn" onClick={handleShowMore}>
              Ver 3 mas
            </button>
          ) : null}
          <small className="empty-copy">
            Mostrando {Math.min(visibleCount, total)} de {total} inconsistencias
          </small>
        </div>
      )}
    </article>
  );
}
