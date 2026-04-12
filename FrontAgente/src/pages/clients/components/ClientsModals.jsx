import { Button, Form, Modal } from 'react-bootstrap';
import { formatDisplayDate } from '../clientsPage.utils';

export function ClientsModals({
  editingClient,
  closeDeliveryModal,
  deliveryForm,
  handleDeliveryChange,
  editingPreview,
  handleDeliverySubmit,
  historyClient,
  closeHistoryModal,
  historyRange,
  setHistoryRange,
  historyLoading,
  historyItems
}) {
  return (
    <>
      <Modal show={Boolean(editingClient)} onHide={closeDeliveryModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Editar deuda</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingClient ? (
            <div className="client-edit-modal">
              <div className="client-edit-row">
                <span>Cliente</span>
                <strong>{editingClient.nombre}</strong>
              </div>
              <div className="client-edit-row">
                <span>Deuda</span>
                <strong>${Number(editingClient.saldo).toFixed(2)}</strong>
              </div>
              <div className="client-edit-row">
                <span>Entregas</span>
                <strong>{editingClient.entregas_count || 0}</strong>
              </div>
              <Form.Group>
                <Form.Label>Entrega</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  step="1"
                  value={deliveryForm.entrega}
                  onChange={handleDeliveryChange}
                  placeholder="Monto entregado"
                />
              </Form.Group>
              {editingPreview !== null ? (
                <div className="client-edit-preview">
                  Nueva deuda: ${editingPreview.toFixed(2)}
                </div>
              ) : null}
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeDeliveryModal}>
            Cancelar
          </Button>
          <Button variant="dark" onClick={handleDeliverySubmit}>
            Guardar entrega
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(historyClient)} onHide={closeHistoryModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Historial</Modal.Title>
        </Modal.Header>
        <Modal.Body className="client-history-body">
          {historyClient ? (
            <>
              <div className="client-history-summary">
                <strong>{historyClient.nombre}</strong>
                <span>Deuda actual: ${Number(historyClient.saldo).toFixed(2)}</span>
              </div>

              <div className="client-history-filters">
                <Form.Control
                  type="date"
                  value={historyRange.from}
                  onChange={(event) =>
                    setHistoryRange((current) => ({
                      ...current,
                      from: event.target.value
                    }))
                  }
                />
                <Form.Control
                  type="date"
                  value={historyRange.to}
                  onChange={(event) =>
                    setHistoryRange((current) => ({
                      ...current,
                      to: event.target.value
                    }))
                  }
                />
              </div>

              {historyLoading ? (
                <p className="empty-copy">Cargando historial...</p>
              ) : historyItems.length === 0 ? (
                <p className="empty-copy">Sin movimientos en ese rango.</p>
              ) : (
                <div className="client-history-list">
                  {historyItems.map((item) => (
                    <div className="client-history-item" key={item.id}>
                      <div>
                        <strong>{item.articulo}</strong>
                        <span>{formatDisplayDate(item.fecha_movimiento)}</span>
                      </div>
                      <div>
                        <span>x{item.cantidad}</span>
                        <strong>${Number(item.total).toFixed(2)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </Modal.Body>
      </Modal>
    </>
  );
}
