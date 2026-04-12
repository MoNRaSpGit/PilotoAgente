import { Badge } from 'react-bootstrap';
import { formatClock, money } from '../cajaPage.utils';

function CajaLivePanel({ scannerStatusBadge, scannerLiveState }) {
  return (
    <article className="card-panel caja-live-panel">
      <div className="panel-heading">
        <div className="caja-panel-copy">
          <h3>Caja en vivo</h3>
          <p>Espejo en tiempo real de lo que arma el operario en el scanner.</p>
        </div>
        <Badge
          className={`caja-panel-status-badge ${scannerStatusBadge.tone === 'active' ? 'is-active' : ''}`}
          bg={scannerStatusBadge.bg}
          text={scannerStatusBadge.text}
        >
          {scannerStatusBadge.label}
        </Badge>
      </div>

      {scannerLiveState.editing ? (
        <div className="caja-live-editing-banner">
          <span>Editando producto</span>
          <strong>
            {scannerLiveState.editing.name || 'Producto'} · ${Number(scannerLiveState.editing.price || 0).toFixed(2)}
          </strong>
        </div>
      ) : null}
      {scannerLiveState.manual ? (
        <div className="caja-live-manual-banner">
          <span>Producto manual</span>
          <strong>El operario esta cargando un producto manualmente.</strong>
          <p>La caja lo ve en vivo mientras el modal sigue abierto.</p>
        </div>
      ) : null}
      {scannerLiveState.items.length === 0 ? (
        <div className="caja-live-empty">
          <strong>Sin productos escaneados todavia</strong>
          <p>Cuando el operario agregue o quite productos, la caja se va a clonar aca al instante.</p>
        </div>
      ) : (
        <div className="caja-live-feed">
          <div className="caja-live-scanner-head">
            <div>
              <strong>{scannerLiveState.operator?.name || 'Operario'}</strong>
              <span>{formatClock(scannerLiveState.updated_at)}</span>
            </div>
            <div className="caja-live-scanner-total">
              <small>Total actual</small>
              <strong>{money(scannerLiveState.total)}</strong>
            </div>
          </div>

          {scannerLiveState.items.map((item, index) => (
            <div className="caja-live-sale-item-row caja-live-scanner-row" key={`${item.barcode || item.name || 'item'}-${index}`}>
              <span className="caja-live-sale-item-name">
                {item.quantity} x {item.name}
              </span>
              <span className="caja-live-sale-item-total">{money(item.total)}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default CajaLivePanel;
