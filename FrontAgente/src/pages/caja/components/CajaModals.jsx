import { Button, Form, Modal } from 'react-bootstrap';

function CajaModals({
  openModal,
  closeOpenModal,
  openingAmount,
  setOpeningAmount,
  handleOpenCashbox,
  user,
  savingOpen,
  closeConfirmOpen,
  closeCloseConfirmModal,
  savingClose,
  handleCloseCashbox
}) {
  return (
    <>
      <Modal show={openModal} onHide={closeOpenModal} centered restoreFocus={false}>
        <Modal.Header closeButton>
          <Modal.Title>Abrir caja</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            type="text"
            inputMode="decimal"
            pattern="\d*\.?\d*"
            placeholder="Monto inicial"
            value={openingAmount}
            onChange={(event) => {
              const nextValue = event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
              setOpeningAmount(nextValue);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleOpenCashbox();
              }
            }}
          />
          {user ? (
            <div className="caja-open-meta">
              <span>{user.name}</span>
              <small>{user.role}</small>
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeOpenModal}>
            Cancelar
          </Button>
          <Button variant="dark" onClick={handleOpenCashbox} disabled={savingOpen}>
            {savingOpen ? 'Abriendo...' : 'Abrir'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={closeConfirmOpen} onHide={closeCloseConfirmModal} centered restoreFocus={false}>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar cierre</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="caja-close-confirm">
            <strong>Queres cerrar la caja?</strong>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeCloseConfirmModal} disabled={savingClose}>
            Cancelar
          </Button>
          <Button
            variant="dark"
            onClick={async () => {
              closeCloseConfirmModal();
              await handleCloseCashbox();
            }}
            disabled={savingClose}
          >
            {savingClose ? 'Cerrando...' : 'Cerrar caja'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default CajaModals;
