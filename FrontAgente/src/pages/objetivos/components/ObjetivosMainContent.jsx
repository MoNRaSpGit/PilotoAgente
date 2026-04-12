import { Smile } from 'lucide-react';

export function ObjetivosMainContent({ viewModel }) {
  return (
    <>
      <article className="card-panel objectives-hero">
        <div>
          <h1>Objetivos</h1>
          <p className="objectives-hero-copy">
            Cumple objetivos y gana premios <Smile size={18} aria-hidden="true" />
          </p>
        </div>
        <span className={`objectives-level-badge is-${viewModel.tone}`}>
          {viewModel.progress.level_label || 'En curso'}
        </span>
      </article>

      <article className="card-panel objectives-progress-card">
        <div className="objectives-progress-head">
          <h3>Ventas hoy</h3>
          <span className="objectives-head-target">{viewModel.formatMoney(viewModel.objective)}</span>
        </div>

        <div className="objectives-kpi-grid">
          <div className="objectives-kpi-item">
            <small>Objetivo del dia</small>
            <strong>{viewModel.formatMoney(viewModel.objective)}</strong>
          </div>
          <div className="objectives-kpi-item">
            <small>Progreso</small>
            <strong>{viewModel.formatMoney(viewModel.currentSales)}</strong>
            <span>{viewModel.objectiveProgressPercent}% del objetivo</span>
          </div>
          <div className="objectives-kpi-item">
            <small>Te falta</small>
            <strong>{viewModel.formatMoney(viewModel.remainingToObjective)}</strong>
            <span>Record: faltan {viewModel.formatMoney(viewModel.remainingToRecord)}</span>
          </div>
        </div>

        <div className="objectives-single-progress">
          <div className="objectives-progress-track is-large">
            <div className="objectives-progress-fill is-record" style={{ width: `${viewModel.fillPercent}%` }} />
            {viewModel.hasObjectiveGoal ? (
              <div
                className="objectives-marker objectives-marker-objective"
                style={{ left: `${viewModel.objectiveVisualPercent}%` }}
                role="button"
                tabIndex={0}
                onClick={() => viewModel.openInfoModal('objetivo')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    viewModel.openInfoModal('objetivo');
                  }
                }}
              >
                <span className="objectives-flag is-objective" aria-hidden="true" />
                <small>Objetivo</small>
              </div>
            ) : null}
            <div
              className="objectives-marker objectives-marker-record"
              role="button"
              tabIndex={0}
              onClick={() => viewModel.openInfoModal('record')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  viewModel.openInfoModal('record');
                }
              }}
            >
              <span className="objectives-flag is-record" aria-hidden="true" />
              <small>Record</small>
            </div>
          </div>

          <p className="objectives-help-text">
            {viewModel.hasObjectiveGoal
              ? 'Para saber que premio hay hoy, toca la bandera azul y la verde.'
              : 'Hoy no hay objetivo azul. Toca la bandera verde para ver el premio del record.'}
          </p>
        </div>
      </article>
    </>
  );
}
