import { Button, Form } from 'react-bootstrap';

function resolveClientStatusLabel(status) {
  if (status === 'entrega') {
    return 'Casi al dia';
  }

  if (status === 'alerta') {
    return 'Por vencer';
  }

  if (status === 'vencido') {
    return 'Vencido';
  }

  return 'Al dia';
}

function ScannerClientBox({
  userRole,
  clientQuery,
  setClientQuery,
  setSelectedClient,
  clients,
  focusScanner,
  clearSelectedClient,
  selectedClient
}) {
  if (userRole !== 'admin') {
    return null;
  }

  return (
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
              {resolveClientStatusLabel(selectedClient.status)}
            </strong>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ScannerClientBox;
