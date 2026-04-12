import { formatMoney } from '../suppliersPage.utils';

export function SuppliersRecentOrdersPanel({ recentOrders }) {
  return (
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
  );
}
