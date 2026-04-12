import { Form, Table } from 'react-bootstrap';
import { formatMoney } from '../suppliersPage.utils';

export function SuppliersProductsPanel({
  suppliers,
  selectedSupplierId,
  setSelectedSupplierId,
  selectedSupplierMeta,
  selectedSupplierProducts,
  loadingSupplierProducts
}) {
  return (
    <article className="card-panel suppliers-panel suppliers-panel-full">
      <h3>Productos por proveedor (prueba)</h3>
      <Form.Group>
        <Form.Label>Proveedor</Form.Label>
        <Form.Select
          value={selectedSupplierId}
          onChange={(event) => setSelectedSupplierId(event.target.value)}
          disabled={loadingSupplierProducts || suppliers.length === 0}
        >
          <option value="">Seleccionar proveedor</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.nombre}
            </option>
          ))}
        </Form.Select>
      </Form.Group>

      {selectedSupplierMeta ? (
        <p className="suppliers-panel-subtitle">
          Proveedor: {selectedSupplierMeta.nombre} ({selectedSupplierProducts.length} productos)
        </p>
      ) : (
        <p className="suppliers-panel-subtitle">Selecciona un proveedor para ver productos.</p>
      )}

      {loadingSupplierProducts ? <p>Cargando productos...</p> : null}

      {!loadingSupplierProducts && selectedSupplierProducts.length === 0 ? (
        <p>No hay productos vinculados a este proveedor.</p>
      ) : null}

      {!loadingSupplierProducts && selectedSupplierProducts.length > 0 ? (
        <div className="suppliers-products-table-wrap">
          <Table striped bordered hover size="sm" responsive>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Categoria</th>
                <th>Barcode</th>
                <th>Stock</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {selectedSupplierProducts.map((product) => (
                <tr key={product.id}>
                  <td>{product.id}</td>
                  <td>{product.nombre}</td>
                  <td>{product.categoria || '-'}</td>
                  <td>{product.barcode || '-'}</td>
                  <td>{Number(product.stock_actual || 0)}</td>
                  <td>{formatMoney(product.precio_venta || 0)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : null}
    </article>
  );
}
