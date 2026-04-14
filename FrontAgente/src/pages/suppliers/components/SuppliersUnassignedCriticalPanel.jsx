import { useMemo, useState } from 'react';

export function SuppliersUnassignedCriticalPanel({
  items,
  suppliers,
  loading,
  assigningProductId,
  selectedSupplierByProductId,
  onSelectSupplier = () => {},
  onAssignSupplier = () => {}
}) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const visibleItems = expanded ? safeItems.slice(0, visibleCount) : [];

  return (
    <article className="card-panel suppliers-panel suppliers-unassigned-panel">
      <div className="suppliers-unassigned-head">
        <div>
          <h3>Criticos sin proveedor</h3>
          <p className="suppliers-panel-subtitle">
            Productos con stock bajo que todavia no tienen proveedor asignado.
          </p>
        </div>
        <button
          type="button"
          className="suppliers-toggle-unassigned-btn"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Ocultar' : 'Ver mas'}
        </button>
      </div>

      {loading ? (
        <p className="empty-copy">Cargando productos...</p>
      ) : !safeItems.length ? (
        <p className="empty-copy">No hay productos criticos sin proveedor.</p>
      ) : !expanded ? (
        <p className="empty-copy">Hay {safeItems.length} producto(s). Toca "Ver mas" para gestionar.</p>
      ) : (
        <>
          <div className="suppliers-unassigned-list">
            {visibleItems.map((item) => {
            const productId = Number(item?.id || 0);
            const stockActual = Number(item?.stock_actual || 0);
            const selectedSupplierId = Number(selectedSupplierByProductId?.[String(productId)] || 0);
            const statusLabel = String(item?.status || '') === 'critical' ? 'Critico' : 'Bajo';
            const assignedNow = Number(assigningProductId) === productId;

            return (
              <div key={`unassigned-${productId}`} className="suppliers-unassigned-row">
                <div>
                  <strong>{item?.nombre || 'Producto'}</strong>
                  <small>
                    Quedan {stockActual} unidades ({statusLabel})
                  </small>
                </div>
                <div className="suppliers-unassigned-actions">
                  <select
                    value={selectedSupplierId || ''}
                    onChange={(event) =>
                      onSelectSupplier({
                        productId,
                        supplierId: Number(event.target.value || 0)
                      })}
                    disabled={assignedNow}
                  >
                    <option value="">Agregar proveedor...</option>
                    {(suppliers || []).map((supplier) => (
                      <option key={`supplier-opt-${supplier.id}`} value={supplier.id}>
                        {supplier?.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="suppliers-assign-btn"
                    onClick={() => onAssignSupplier(productId)}
                    disabled={assignedNow || !selectedSupplierId}
                  >
                    {assignedNow ? 'Asignando...' : 'Asignar'}
                  </button>
                </div>
              </div>
            );
            })}
          </div>

          <div className="suppliers-unassigned-footer-actions">
            {visibleCount < safeItems.length ? (
              <button
                type="button"
                className="suppliers-link-btn"
                onClick={() => setVisibleCount((current) => Math.min(current + 5, safeItems.length))}
              >
                Ver 5 mas
              </button>
            ) : null}
            {visibleCount < safeItems.length ? (
              <button
                type="button"
                className="suppliers-link-btn"
                onClick={() => setVisibleCount(safeItems.length)}
              >
                Ver todo
              </button>
            ) : null}
            {visibleCount > 5 ? (
              <button
                type="button"
                className="suppliers-link-btn"
                onClick={() => setVisibleCount(5)}
              >
                Ver menos
              </button>
            ) : null}
          </div>
        </>
      )}
    </article>
  );
}
