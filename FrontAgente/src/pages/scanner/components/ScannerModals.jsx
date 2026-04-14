import { Button, Form, Modal } from 'react-bootstrap';

function ScannerModals({
  manualOpen,
  closeManualModal,
  manualPriceRef,
  focusScanner,
  manualPrice,
  setManualPrice,
  handleManualConfirm,
  unknownOpen,
  closeUnknownModal,
  unknownPriceRef,
  unknownPrice,
  setUnknownPrice,
  handleUnknownConfirm,
  editOpen,
  closeEditModal,
  editPriceRef,
  editName,
  setEditName,
  editPrice,
  setEditPrice,
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
  handleChargeToClientConfirm
}) {
  return (
    <>
      <Modal
        show={manualOpen}
        onHide={closeManualModal}
        onEntered={() => manualPriceRef.current?.focus()}
        onExited={focusScanner}
        centered
        restoreFocus={false}
      >
        <Modal.Header>
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
        <Modal.Header>
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
    </>
  );
}

export default ScannerModals;
