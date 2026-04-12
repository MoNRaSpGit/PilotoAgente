import { Button, Form, Modal } from 'react-bootstrap';
import { CAJA_ACTION_LABELS } from '../cajaText.constants';

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
            {CAJA_ACTION_LABELS.cancel}
          </Button>
          <Button variant="dark" onClick={handleOpenCashbox} disabled={savingOpen}>
            {savingOpen ? CAJA_ACTION_LABELS.openInProgress : CAJA_ACTION_LABELS.open}
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
            {CAJA_ACTION_LABELS.cancel}
          </Button>
          <Button
            variant="dark"
            onClick={async () => {
              closeCloseConfirmModal();
              await handleCloseCashbox();
            }}
            disabled={savingClose}
          >
            {savingClose ? CAJA_ACTION_LABELS.closeInProgress : CAJA_ACTION_LABELS.closeCashbox}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default CajaModals;
