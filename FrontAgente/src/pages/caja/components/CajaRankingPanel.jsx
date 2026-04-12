import { CAJA_ACTION_LABELS } from '../cajaText.constants';
import { formatShortDate } from '../cajaPage.utils';

function CajaRankingPanel({ rankingMode, rankingLoading, loadRanking, rankingItems }) {
  return (
    <article className="card-panel caja-live-panel caja-ranking-panel">
      <div className="panel-heading">
        <div className="caja-panel-copy">
          <h3>Ranking</h3>
          <p>Ranking del {formatShortDate(new Date())}</p>
        </div>
        <div className="caja-movements-tools">
          <div className="caja-movements-actions">
            {rankingMode === 'top5' ? (
              <button type="button" className="caja-inline-link" onClick={() => loadRanking('top10')} disabled={rankingLoading}>
                {CAJA_ACTION_LABELS.showMore}
              </button>
            ) : null}
            {rankingMode === 'top10' ? (
              <button type="button" className="caja-inline-link" onClick={() => loadRanking('all')} disabled={rankingLoading}>
                {CAJA_ACTION_LABELS.showAll}
              </button>
            ) : null}
            {rankingMode === 'all' ? (
              <button type="button" className="caja-inline-link" onClick={() => loadRanking('top5')} disabled={rankingLoading}>
                {CAJA_ACTION_LABELS.backToFive}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {rankingItems.length === 0 ? (
        <div className="caja-live-empty">
          <strong>Sin ranking disponible</strong>
          <p>El ranking aparece cuando se registran ventas con productos.</p>
        </div>
      ) : (
        <div className="caja-ranking-list">
          {rankingItems.map((item) => (
            <div className="caja-ranking-row" key={`${item.rank}-${item.productName}-${item.barcode || 'sin-codigo'}`}>
              <div className="caja-ranking-main">
                <div className="caja-ranking-product">
                  {item.hasImage ? (
                    <img className="caja-ranking-image" src={item.imageUrl} alt={item.productName} loading="lazy" />
                  ) : (
                    <span className="caja-ranking-image-fallback">IMG</span>
                  )}
                  <div className="caja-ranking-product-copy">
                    <strong>{item.productName}</strong>
                    <small className="caja-ranking-barcode">COD: {item.barcode || 'sin-codigo'}</small>
                  </div>
                </div>
              </div>
              <span className="caja-ranking-sales">{item.totalQuantity}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default CajaRankingPanel;
