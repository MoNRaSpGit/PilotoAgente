function StockHeader({ totals }) {
  return (
    <header className="stock-header card-panel">
      <h2>Stock Controlado</h2>
      <p>Solo muestra alertas. Si un producto esta bien regulado, no aparece.</p>
      <div className="stock-kpis">
        <span>Total controlados: <strong>{totals?.tracked || 0}</strong></span>
        <span>Alertas: <strong>{totals?.alerts || 0}</strong></span>
        <span>Rojos: <strong>{totals?.critical || 0}</strong></span>
        <span>Amarillos: <strong>{totals?.warning || 0}</strong></span>
      </div>
    </header>
  );
}

export default StockHeader;
