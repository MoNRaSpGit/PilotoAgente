import { Button, Form, Modal } from 'react-bootstrap';
import { useScannerPageController } from './scanner/useScannerPageController';

function ScannerPage() {
  const {
    barcodeInputRef,
    manualPriceRef,
    unknownPriceRef,
    editPriceRef,
    barcode,
    setBarcode,
    userRole,
    clientQuery,
    setClientQuery,
    setSelectedClient,
    clients,
    focusScanner,
    clearSelectedClient,
    selectedClient,
    manualOpen,
    setManualOpen,
    manualPrice,
    setManualPrice,
    closeManualModal,
    handleManualConfirm,
    unknownOpen,
    unknownPrice,
    setUnknownPrice,
    closeUnknownModal,
    handleUnknownConfirm,
    editOpen,
    editName,
    setEditName,
    editPrice,
    setEditPrice,
    closeEditModal,
    handleEditConfirm,
    chargeOpen,
    closeChargeModal,
    totalAmount,
    handleChargeCancel,
    handleChargeConfirm,
    selectedClientData,
    chargeClientConfirmOpen,
    closeChargeClientConfirm,
    chargeSnapshotTotal,
    handleChargeToClientConfirm,
    items,
    handleItemPointerDown,
    clearItemPress,
    handleItemClick,
    openItemEditor,
    changeItemQuantity,
    handleCharge,
    handleScanSubmit
  } = useScannerPageController();
  return (
    <section className="page-section scanner-page">
      <div className="scanner-shell">
        <Form onSubmit={handleScanSubmit} className="scanner-form">
          <Form.Control
            ref={barcodeInputRef}
            className="scanner-input"
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            placeholder="Escanea aqui"
            autoComplete="off"
            inputMode="numeric"
          />
        </Form>

        {userRole === 'admin' ? (
          <div className="scanner-client-box">
            <div className="scanner-client-search">
              <Form.Control
                type="text"
                value={clientQuery}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setClientQuery(nextValue);
                  setSelectedClient(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    const normalizedQuery = String(clientQuery).trim().toLowerCase();
                    const nextClient =
                      clients.find((client) => String(client.id) === normalizedQuery) ||
                      clients.find((client) => String(client.nombre || '').toLowerCase() === normalizedQuery) ||
                      clients.find((client) => String(client.nombre || '').toLowerCase().includes(normalizedQuery)) ||
                      null;

                    if (nextClient) {
                      setSelectedClient(nextClient);
                      focusScanner();
                    }
                  }
                }}
                placeholder="ID o nombre del cliente"
                inputMode="text"
              />
              <Button variant="outline-secondary" onClick={clearSelectedClient}>
                Limpiar
              </Button>
            </div>

            {selectedClient ? (
              <div className="scanner-client-selected">
                <div>
                  <strong>{selectedClient.nombre}</strong>
                </div>
                <div>
                  <span>Deuda</span>
                  <strong>${Number(selectedClient.saldo).toFixed(2)}</strong>
                </div>
                <div>
                  <span>Estado</span>
                  <strong className={`client-status-pill client-status-${selectedClient.status}`}>
                    {selectedClient.status === 'entrega'
                      ? 'Casi al dia'
                      : selectedClient.status === 'alerta'
                        ? 'Por vencer'
                        : selectedClient.status === 'vencido'
                          ? 'Vencido'
                          : 'Al dia'}
                  </strong>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

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
      </div>

      <Modal
        show={manualOpen}
        onHide={closeManualModal}
        onEntered={() => manualPriceRef.current?.focus()}
        onExited={focusScanner}
        centered
        restoreFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Agregar Producto Manual</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            ref={manualPriceRef}
            type="text"
            value={manualPrice}
            onChange={(event) => {
              const nextValue = event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
              setManualPrice(nextValue);
            }}
            placeholder="Valor"
            inputMode="decimal"
            pattern="\d*\.?\d*"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleManualConfirm();
              }
            }}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeManualModal}>
            Cancelar
          </Button>
          <Button onClick={handleManualConfirm}>Agregar</Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={unknownOpen}
        onHide={closeUnknownModal}
        onEntered={() => unknownPriceRef.current?.focus()}
        onExited={focusScanner}
        centered
        restoreFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Agregar Producto Manual</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            ref={unknownPriceRef}
            type="text"
            value={unknownPrice}
            onChange={(event) => {
              const nextValue = event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
              setUnknownPrice(nextValue);
            }}
            placeholder="Valor"
            inputMode="decimal"
            pattern="\d*\.?\d*"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleUnknownConfirm();
              }
            }}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeUnknownModal}>
            Cancelar
          </Button>
          <Button onClick={handleUnknownConfirm}>Agregar</Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={editOpen}
        onHide={closeEditModal}
        onEntered={() => editPriceRef.current?.focus()}
        onExited={focusScanner}
        centered
        restoreFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Editar producto</Modal.Title>
        </Modal.Header>
        <Modal.Body className="scanner-edit-body">
          <Form.Group className="mb-3">
            <Form.Label>Nombre</Form.Label>
            <Form.Control
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              placeholder="Nombre"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Precio</Form.Label>
            <Form.Control
              ref={editPriceRef}
              type="text"
              value={editPrice}
              onChange={(event) => {
                const nextValue = event.target.value
                  .replace(/[^\d.,]/g, '')
                  .replace(/,/g, '.')
                  .replace(/(\..*)\./g, '$1');
                setEditPrice(nextValue);
              }}
              placeholder="Valor"
              inputMode="decimal"
              pattern="\d*\.?\d*"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleEditConfirm();
                }
              }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeEditModal}>
            Cancelar
          </Button>
          <Button variant="dark" onClick={handleEditConfirm}>
            Guardar
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={chargeOpen}
        onHide={closeChargeModal}
        onExited={focusScanner}
        centered
        size="lg"
        dialogClassName="scanner-charge-modal"
        restoreFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Cobro</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="scanner-charge-summary">
            <span>Total</span>
            <strong>${totalAmount.toFixed(2)}</strong>
          </div>
        </Modal.Body>
        <Modal.Footer className="scanner-charge-footer">
          <Button variant="outline-secondary" onClick={handleChargeCancel}>
            Cancelar
          </Button>
          <Button variant="dark" onClick={handleChargeConfirm}>
            {selectedClientData ? 'Siguiente' : 'Confirmar'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={chargeClientConfirmOpen}
        onHide={closeChargeClientConfirm}
        onExited={focusScanner}
        centered
        restoreFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirmar credito</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="scanner-charge-summary">
            <span>{selectedClientData ? `${selectedClientData.nombre} - ID ${selectedClientData.id}` : 'Cliente'}</span>
            <strong>${chargeSnapshotTotal.toFixed(2)}</strong>
          </div>
          <p className="empty-copy scanner-client-confirm-copy">
            Seguro que queres agregar ese monto a este cliente?
          </p>
        </Modal.Body>
        <Modal.Footer className="scanner-charge-footer">
          <Button variant="outline-secondary" onClick={closeChargeClientConfirm}>
            Cancelar
          </Button>
          <Button variant="dark" onClick={handleChargeToClientConfirm}>
            Confirmar
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}

export default ScannerPage;
