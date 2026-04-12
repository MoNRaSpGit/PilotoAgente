import { metricValue, money, trendClass, trendLabel } from '../cajaPage.utils';

function CajaSummaryGrid({ selectedDay, comparisonExpanded, onToggleComparison, trend }) {
  return (
    <div className="caja-grid">
      <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-soft">
        <span>Caja inicial</span>
        <strong>{money(selectedDay.opening_amount)}</strong>
      </article>
      <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-accent">
        <span>Ventas del dia</span>
        <strong>{money(selectedDay.sales_total)}</strong>
      </article>
      <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-profit">
        <span>Ganancia diaria</span>
        <strong>{money(selectedDay.profit_amount)}</strong>
      </article>
      <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-soft">
        <span>Monto actual</span>
        <strong>{money(selectedDay.current_amount)}</strong>
      </article>
      <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-soft">
        <span>Pagos registrados</span>
        <strong>{money(selectedDay.payments_total)}</strong>
      </article>
      <article className={`card-panel caja-trend-card caja-trend-card-compact ${comparisonExpanded ? 'is-expanded' : ''}`}>
        <span>Comparaciones</span>
        <div className="caja-trend-list">
          <div className="caja-trend-item caja-trend-item-main">
            <small>Hoy vs ayer</small>
            <strong className={trendClass(trend.comparisonPercent)}>{trendLabel(trend.comparisonPercent)}</strong>
            <p>{metricValue(selectedDay.sales_total, trend.compareDay.sales_total)}</p>
          </div>
          <div className={`caja-trend-flyout ${comparisonExpanded ? 'is-open' : ''}`}>
            <div className="caja-trend-item caja-trend-item-compact">
              <small>Semana pasada</small>
              <strong className={trendClass(trend.weeklySummary.comparison_percent)}>
                {trendLabel(trend.weeklySummary.comparison_percent)}
              </strong>
              <p>{metricValue(trend.weeklySummary.current.sales_total, trend.weeklySummary.previous.sales_total)}</p>
            </div>
            <div className="caja-trend-item caja-trend-item-compact">
              <small>Mes pasado</small>
              <strong className={trendClass(trend.monthlySummary.comparison_percent)}>
                {trendLabel(trend.monthlySummary.comparison_percent)}
              </strong>
              <p>{metricValue(trend.monthlySummary.current.sales_total, trend.monthlySummary.previous.sales_total)}</p>
            </div>
          </div>
        </div>
        <div className="caja-trend-footer">
          <span className="caja-trend-footer-label">{comparisonExpanded ? 'Ocultar detalle' : 'Ver semana y mes'}</span>
          <button
            type="button"
            className="caja-trend-toggle"
            onClick={onToggleComparison}
            aria-expanded={comparisonExpanded}
            aria-label={comparisonExpanded ? 'Contraer comparaciones' : 'Expandir comparaciones'}
          >
            <span className={`caja-trend-arrow ${comparisonExpanded ? 'is-open' : ''}`}>v</span>
          </button>
        </div>
      </article>
    </div>
  );
}

export default CajaSummaryGrid;
