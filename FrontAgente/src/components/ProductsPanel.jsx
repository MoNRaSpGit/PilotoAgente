function ProductsPanel({ products, loading, error }) {
  return (
    <div className="card-panel">
      <div className="panel-heading">
        <div>
          <h3>Productos desde Render</h3>
          <p>Consulta de ejemplo a `/api/products`.</p>
        </div>
      </div>

      {loading ? <p className="empty-copy">Cargando productos...</p> : null}
      {error ? <p className="error-copy">{error}</p> : null}

      {!loading && !error && products.length === 0 ? (
        <p className="empty-copy">No llegaron productos desde el backend.</p>
      ) : null}

      {!loading && !error && products.length > 0 ? (
        <div className="product-list">
          {products.map((product) => (
            <article className="product-item" key={product.id}>
              <div>
                <strong>{product.nombre}</strong>
                <p>{product.categoria || 'Sin categoría'}</p>
              </div>
              <div className="product-meta">
                <span>${Number(product.precio_venta).toFixed(2)}</span>
                <small>Stock: {product.stock_actual}</small>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ProductsPanel;
