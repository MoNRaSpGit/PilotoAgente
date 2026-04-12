import { Button } from 'react-bootstrap';
import { formatDisplayDate, getRowClass, getStatusLabel } from '../clientsPage.utils';

export function ClientsTablePanel({
  loading,
  error,
  clients,
  openHistoryModal,
  openDeliveryModal,
  handlePayment
}) {
  return (
    <div className="card-panel">
      <div className="panel-heading">
        <div>
          <h3>Lista de clientes</h3>
          <p>La tabla marca automaticamente el estado segun la fecha de vencimiento.</p>
        </div>
      </div>

      {loading ? (
        <p className="empty-copy">Cargando clientes...</p>
      ) : error ? (
        <p className="error-copy">{error}</p>
      ) : clients.length === 0 ? (
        <p className="empty-copy">Todavia no hay clientes cargados.</p>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle clients-table">
            <thead>
              <tr>
                <th className="client-id-column">ID</th>
                <th>Cliente</th>
                <th>Deuda</th>
                <th>Vence</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr className={getRowClass(client.status)} key={client.id}>
                  <td className="client-id-column">{client.id}</td>
                  <td>
                    <strong className="client-name-strong">{client.nombre}</strong>
                  </td>
                  <td>${Number(client.saldo).toFixed(2)}</td>
                  <td className="client-due-column">{formatDisplayDate(client.fecha_vencimiento)}</td>
                  <td>
                    <span className={`client-status-pill client-status-${client.status}`}>{getStatusLabel(client)}</span>
                  </td>
                  <td className="text-end">
                    <div className="d-inline-flex gap-2 flex-wrap justify-content-end">
                      <Button size="sm" variant="outline-dark" onClick={() => openHistoryModal(client)}>
                        Ver
                      </Button>
                      <Button size="sm" variant="outline-dark" onClick={() => openDeliveryModal(client)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="dark" onClick={() => handlePayment(client)}>
                        Pago hoy
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
