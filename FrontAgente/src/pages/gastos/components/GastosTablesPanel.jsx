import { Badge, Button, Table } from 'react-bootstrap';
import { frequencyLabel, money } from '../gastosPage.utils';

function ExpenseTable({ title, description, rows, handleEdit, handleToggleActive }) {
  return (
    <div className="gastos-group">
      <div className="panel-heading gastos-group-heading">
        <div>
          <h3>{title}</h3>
          <p className="empty-copy">{description}</p>
        </div>
        <Badge bg="light" text="dark">
          {rows.length}
        </Badge>
      </div>

      <Table responsive hover className="gastos-table align-middle">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Monto</th>
            <th>Frecuencia</th>
            <th>Equiv. diario</th>
            <th>Equiv. mensual</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="gastos-item-name">{item.name}</div>
                {item.notes ? <small>{item.notes}</small> : null}
              </td>
              <td>{money(item.amount)}</td>
              <td>{frequencyLabel(item.frequency)}</td>
              <td>{money(item.daily_equivalent)}</td>
              <td>{money(item.monthly_equivalent)}</td>
              <td>
                <Badge bg={item.active ? 'success' : 'secondary'}>{item.active ? 'Activo' : 'Inactivo'}</Badge>
              </td>
              <td>
                <div className="gastos-row-actions">
                  <Button variant="outline-dark" size="sm" onClick={() => handleEdit(item)}>
                    Editar
                  </Button>
                  <Button
                    variant={item.active ? 'outline-danger' : 'outline-success'}
                    size="sm"
                    onClick={() => handleToggleActive(item)}
                  >
                    {item.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function GastosTablesPanel({ loading, businessItems, homeItems, handleEdit, handleToggleActive }) {
  return (
    <div className="card-panel gastos-table-panel">
      <div className="panel-heading">
        <div>
          <h3>Gastos registrados</h3>
          <p className="empty-copy">Primero negocio, despues hogar.</p>
        </div>
      </div>

      {loading ? (
        <p className="empty-copy">Cargando gastos...</p>
      ) : (
        <>
          <ExpenseTable
            title="Negocio"
            description="Costos del negocio y operacion."
            rows={businessItems}
            handleEdit={handleEdit}
            handleToggleActive={handleToggleActive}
          />
          <ExpenseTable
            title="Hogar"
            description="Costos personales y del hogar."
            rows={homeItems}
            handleEdit={handleEdit}
            handleToggleActive={handleToggleActive}
          />
        </>
      )}
    </div>
  );
}
