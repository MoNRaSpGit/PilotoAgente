import { money } from '../gastosPage.utils';

export function GastosSummaryGrid({ totals }) {
  return (
    <div className="gastos-summary-grid">
      <article className="card-panel caja-stat-card caja-metric-card">
        <span>Negocio diario</span>
        <strong>{money(totals.business_daily_total)}</strong>
      </article>
      <article className="card-panel caja-stat-card caja-metric-card">
        <span>Hogar diario</span>
        <strong>{money(totals.home_daily_total)}</strong>
      </article>
      <article className="card-panel caja-stat-card caja-metric-card">
        <span>Total diario</span>
        <strong>{money(totals.daily_total)}</strong>
      </article>
      <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-accent">
        <span>Total mensual</span>
        <strong>{money(totals.monthly_total)}</strong>
      </article>
    </div>
  );
}
