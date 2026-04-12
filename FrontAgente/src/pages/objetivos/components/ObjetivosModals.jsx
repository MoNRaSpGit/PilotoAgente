import { Button, Modal } from 'react-bootstrap';

export function ObjetivosModals({
  celebrateOpen,
  setCelebrateOpen,
  activeReward,
  infoOpen,
  setInfoOpen,
  infoType,
  infoReward,
  objectiveUnlocked,
  recordUnlocked
}) {
  return (
    <>
      <Modal
        show={celebrateOpen}
        onHide={() => setCelebrateOpen(false)}
        centered
        restoreFocus={false}
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>{activeReward.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="objectives-reward-modal-body">
          <p className="objectives-reward-line">{activeReward.reward}</p>
          <p>{activeReward.claim}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="dark" onClick={() => setCelebrateOpen(false)}>
            Entendido
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={infoOpen} onHide={() => setInfoOpen(false)} centered restoreFocus={false}>
        <Modal.Header closeButton>
          <Modal.Title>{infoType === 'record' ? 'Premio de Record' : 'Premio de Objetivo'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="objectives-reward-modal-body">
          {((infoType === 'record' && recordUnlocked) || (infoType === 'objetivo' && objectiveUnlocked)) ? (
            <>
              <p className="objectives-reward-line">{infoReward.reward}</p>
              <p>{infoReward.claim}</p>
            </>
          ) : (
            <>
              <p className="objectives-reward-line">
                {infoType === 'record'
                  ? 'Si cumplimos el record ganamos un mega premio.'
                  : 'Si cumplimos el objetivo ganamos un alfajor.'}
              </p>
              <p>Se desbloquea automaticamente cuando la barra llega a la meta.</p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="dark" onClick={() => setInfoOpen(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
