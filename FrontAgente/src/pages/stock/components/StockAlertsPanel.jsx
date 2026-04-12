import { statusLabel } from '../stockPage.utils';

function StockAlertsPanel({ loading, items = [] }) {
  return (
    <article className="card-panel stock-panel">
      <h3>Alertas</h3>
      {loading ? <p>Cargando...</p> : null}
      {!loading && items.length === 0 ? (
        <p className="empty-copy">No hay alertas de stock por ahora.</p>
      ) : null}
      <div className="stock-alert-list">
        {items.map((item) => (
          <div key={item.id} className={`stock-alert-row stock-${item.status}`}>
            <div>
              <strong>{item.product.name}</strong>
              <small>{item.supplier_name || 'Sin proveedor'}</small>
            </div>
            <div className="stock-alert-meta">
              <span>{statusLabel(item.status)}</span>
              <strong>Stock {item.product.stock_actual}</strong>
              <small>Sugerido: {item.metrics.suggested_purchase}</small>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export default StockAlertsPanel;
