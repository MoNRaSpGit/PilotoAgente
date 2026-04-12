function StockExpectedPanel({ expectedToday = [] }) {
  return (
    <article className="card-panel stock-panel">
      <h3>Llegadas de Hoy</h3>
      {expectedToday.length === 0 ? (
        <p className="empty-copy">Hoy no hay entregas configuradas.</p>
      ) : (
        <div className="stock-expected-list">
          {expectedToday.map((item) => (
            <div key={`expected-${item.id}`} className="stock-expected-row">
              <strong>{item.product.name}</strong>
              <span>{item.supplier_name || 'Sin proveedor'}</span>
              <small>Stock actual: {item.product.stock_actual}</small>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default StockExpectedPanel;
