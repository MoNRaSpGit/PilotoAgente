import { Button } from 'react-bootstrap';

function ScannerTicketPanel({
  items,
  setManualOpen,
  handleItemPointerDown,
  clearItemPress,
  handleItemClick,
  openItemEditor,
  changeItemQuantity,
  focusScanner,
  totalAmount,
  handleCharge
}) {
  return (
    <>
      <div className="scanner-actions">
        <Button
          variant="dark"
          size="lg"
          className="scanner-manual-button"
          onClick={() => setManualOpen(true)}
        >
          Producto Manual
        </Button>
      </div>

      <div className="scanner-ticket-panel">
        <div className="scanner-list">
          {items.length === 0 ? (
            <p className="empty-copy scanner-empty">Todavia no agregaste productos.</p>
          ) : (
            items.map((item, index) => (
              <div
                className={`scanner-item ${index === items.length - 1 ? 'scanner-item-latest' : ''}`}
                key={item.key}
              >
                <div
                  className="scanner-item-hit-area"
                  role="button"
                  tabIndex={0}
                  onPointerDown={() => handleItemPointerDown(item)}
                  onPointerUp={clearItemPress}
                  onPointerLeave={clearItemPress}
                  onPointerCancel={clearItemPress}
                  onClick={() => handleItemClick(item.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleItemClick(item.key);
                    }
                  }}
                >
                  <div className="scanner-item-main">
                    {item.hasImage ? (
                      <img className="scanner-product-image" src={item.imageUrl} alt={item.name} loading="lazy" />
                    ) : (
                      <div className="scanner-product-fallback">IMG</div>
                    )}
                    <div className="scanner-item-text">
                      <span className="scanner-item-name">{item.name}</span>
                      <span className="scanner-item-price">${item.price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="scanner-item-edit"
                  aria-label={`Editar ${item.name}`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    openItemEditor(item);
                  }}
                >
                  Editar
                </button>

                <div className="scanner-item-meta">
                  <span className="scanner-meta-pill scanner-meta-pill-soft">x{item.quantity}</span>
                  <span className="scanner-meta-pill scanner-meta-pill-strong">${item.total.toFixed(2)}</span>
                  <button
                    type="button"
                    className="scanner-item-remove"
                    aria-label={`Reducir ${item.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      changeItemQuantity(item.key, -1);
                      focusScanner();
                    }}
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 ? (
          <div className="scanner-ticket-footer">
            <div className="scanner-ticket-total">
              <span>Total</span>
              <strong>${totalAmount.toFixed(2)}</strong>
            </div>

            <Button className="scanner-charge-button" variant="dark" size="lg" onClick={handleCharge}>
              Cobrar
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}

export default ScannerTicketPanel;
