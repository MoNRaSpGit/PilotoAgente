import { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { formatDateShort, formatMoney } from '../suppliersPage.utils';

function buildOrderWhatsappMessage(detail) {
  const supplierName = detail?.supplier?.nombre || 'Proveedor';
  const date = detail?.date || '-';
  const items = Array.isArray(detail?.todayOrder?.items) ? detail.todayOrder.items : [];
  const lines = items.map((item) => (
    `- ${Number(item?.quantity || 0)} ${item?.product_name || 'Producto'}`
  ));
  return [
    `Pedido para ${supplierName}`,
    `Fecha: ${date}`,
    ...lines
  ].join('\n');
}

export function SuppliersWeekMovementPanel({
  weekMovementSchedule,
  selectedDaySupplierDetail,
  selectedDaySupplierAlerts,
  selectedDaySupplierReceivingItems,
  selectedDaySupplierInvoiceSummary,
  loadingDaySupplierProducts,
  confirmingWeekSupplierId,
  receivingOrderId,
  allowReceiveConfirmation = true,
  handleChangeSelectedDaySupplierAlertQuantity = () => {},
  handleChangeSelectedDaySupplierAlertUnitCost = () => {},
  handleChangeReceivedItemQuantity = () => {},
  handleChangeInvoiceAmount = () => {},
  handleConfirmSelectedDaySupplierOrder = () => {},
  handleReceiveSelectedDaySupplierOrder = () => {},
  handleCancelSelectedDaySupplierFlow = () => {},
  handleSelectDaySupplier = () => {}
}) {
  const selectedSupplierId = Number(selectedDaySupplierDetail?.supplier?.id || 0);
  const selectedDate = String(selectedDaySupplierDetail?.date || '');
  const selectedMovement = String(selectedDaySupplierDetail?.movementType || '');
  const isDeliveryFlow = selectedMovement === 'delivery';
  const selectedOrder = selectedDaySupplierDetail?.todayOrder || null;
  const selectedOrderStatus = String(selectedOrder?.status || '').toLowerCase();
  const isPickupConfirmedByOperario = Boolean(String(selectedOrder?.pickup_confirmed_at || '').trim());
  const isReceivedByOperario = selectedOrderStatus === 'recibido' || Boolean(String(selectedOrder?.received_at || '').trim());
  const suppliersTestMode = String(import.meta.env.VITE_SUPPLIERS_TEST_MODE || '').trim().toLowerCase() === 'true';
  const isLockedForAdminEdition = !suppliersTestMode && (isPickupConfirmedByOperario || isReceivedByOperario);
  const [receiveConfirmOpen, setReceiveConfirmOpen] = useState(false);
  const whatsappNumber = String(import.meta.env.VITE_SUPPLIERS_WPP_NUMBER || '').trim().replace(/\D+/g, '');

  return (
    <article className="card-panel suppliers-panel suppliers-panel-full">
      <h3>Semana operativa (proveedores)</h3>
      <div className="suppliers-week-movement-grid">
        {(weekMovementSchedule || []).map((day) => (
          <div key={`movement-${day.date}`} className={`suppliers-week-movement-card ${day.is_today ? 'is-today' : ''}`}>
            <div className="suppliers-day-head">
              <strong>{day.day_name}</strong>
              <span>{day.date}</span>
            </div>

            <div className="suppliers-week-movement-columns">
              <div>
                <strong>Entregan</strong>
                {day.delivery.length === 0 ? (
                  <p className="empty-copy">Sin llegadas</p>
                ) : (
                  <div className="suppliers-day-type-list">
                    {day.delivery.map((supplier) => (
                      <button
                        type="button"
                        key={`delivery-${day.date}-${supplier.id}`}
                        className={`suppliers-day-chip suppliers-day-chip-button ${
                          selectedSupplierId === Number(supplier.id) && selectedDate === day.date && selectedMovement === 'delivery'
                            ? 'is-selected'
                            : ''
                        } ${
                          supplier?.reception_state === 'done'
                            ? 'is-done'
                            : supplier?.reception_state === 'missed'
                              ? 'is-missed'
                              : ''
                        }`}
                        onClick={() => handleSelectDaySupplier(supplier, 'delivery', day.date)}
                      >
                        {supplier.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <strong>Levantan</strong>
                {day.pickup.length === 0 ? (
                  <p className="empty-copy">Sin retiros</p>
                ) : (
                  <div className="suppliers-day-type-list">
                    {day.pickup.map((supplier) => (
                      <button
                        type="button"
                        key={`pickup-${day.date}-${supplier.id}`}
                        className={`suppliers-day-chip suppliers-day-chip-button ${
                          selectedSupplierId === Number(supplier.id) && selectedDate === day.date && selectedMovement === 'pickup'
                            ? 'is-selected'
                            : ''
                        } ${
                          supplier?.order_state === 'done'
                            ? 'is-done'
                            : supplier?.order_state === 'missed'
                              ? 'is-missed'
                              : ''
                        }`}
                        onClick={() => handleSelectDaySupplier(supplier, 'pickup', day.date)}
                      >
                        {supplier.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedDaySupplierDetail ? (
        <div className="suppliers-order-detail">
          <div className="suppliers-order-detail-head">
            <h4>Detalle de proveedor</h4>
            <button
              type="button"
              className="suppliers-cancel-flow-btn"
              onClick={handleCancelSelectedDaySupplierFlow}
            >
              Cerrar pedidos
            </button>
          </div>
          <div className="suppliers-order-detail-grid">
            <span>Proveedor</span>
            <strong>{selectedDaySupplierDetail.supplier?.nombre}</strong>
            <span>Movimiento</span>
            <strong>{selectedDaySupplierDetail.movementType === 'delivery' ? 'Entrega' : 'Levanta pedido'}</strong>
            <span>Fecha</span>
            <strong>{formatDateShort(selectedDaySupplierDetail.date)}</strong>
            <span>Monto esperado</span>
            <strong>
              {selectedOrder
                ? formatMoney(selectedOrder.expected_amount)
                : 'Sin pedido cargado para ese dia'}
            </strong>
          </div>
          {selectedOrder ? (
            <div className="suppliers-day-type-list">
              <span className={`suppliers-day-chip ${isPickupConfirmedByOperario ? 'suppliers-flow-chip-ok' : 'suppliers-flow-chip-pending'}`}>
                Envio operario: {isPickupConfirmedByOperario ? 'confirmado' : 'pendiente'}
              </span>
              <span className={`suppliers-day-chip ${isReceivedByOperario ? 'suppliers-flow-chip-ok' : 'suppliers-flow-chip-pending'}`}>
                Recepcion operario: {isReceivedByOperario ? 'confirmada' : 'pendiente'}
              </span>
            </div>
          ) : null}
          {selectedDaySupplierDetail?.isDeliveryOverdue ? (
            <p className="suppliers-overdue-alert">
              Esta entrega quedo pendiente y ya paso la fecha. Confirmala cuanto antes para actualizar stock.
            </p>
          ) : null}
          {selectedDaySupplierDetail?.isFutureDelivery ? (
            <p className="empty-copy">
              Esta entrega es futura. Podras confirmar recepcion cuando llegue ese dia.
            </p>
          ) : null}
          <div className="suppliers-detail-columns">
            <div className="suppliers-detail-col">
              {isDeliveryFlow ? (
                <>
                  <strong>Estado del pedido para entrega</strong>
                  {selectedDaySupplierDetail?.todayOrder?.items?.length ? (
                    <p className="empty-copy">El pedido ya fue realizado y quedo listo para recepcion.</p>
                  ) : (
                    <p className="suppliers-overdue-alert">Pedido no realizado para esta entrega.</p>
                  )}
                </>
              ) : (
                <>
                  <strong>Criticos para armar pedido</strong>
                  {loadingDaySupplierProducts ? (
                    <p className="empty-copy">Cargando productos del proveedor...</p>
                  ) : !selectedDaySupplierAlerts?.alerts?.length ? (
                    <p className="empty-copy">Este proveedor no tiene alertas de stock activas.</p>
                  ) : (
                    <div className="suppliers-build-list">
                      {selectedDaySupplierAlerts.alerts.map((item) => {
                        const quantity = Number(item?.ui_quantity || 0);
                        const status = String(item?.status || '');
                        return (
                          <div key={`supplier-build-${item.id}`} className="suppliers-build-row">
                            <div>
                              <span className="suppliers-build-name">{item?.product?.name}</span>
                              <span className={`suppliers-alert-badge ${status === 'critical' ? 'is-critical' : 'is-warning'}`}>
                                {status === 'critical' ? 'Critico' : 'Bajo'}
                              </span>
                              <small>
                                Quedan: {Number(item?.product?.stock_actual || 0)} | Ult. compra: {Number(item?.last_purchased_quantity || 0)}
                              </small>
                            </div>
                            <div className="suppliers-build-actions">
                              <button
                                type="button"
                                className="suppliers-qty-btn"
                                onClick={() => {
                                  if (quantity <= 0) {
                                    return;
                                  }
                                  handleChangeSelectedDaySupplierAlertQuantity({
                                    alertItem: item,
                                    quantity: quantity - 1
                                  });
                                }}
                                disabled={quantity <= 0 || isLockedForAdminEdition}
                              >
                                -
                              </button>
                              <span>{quantity}</span>
                              <button
                                type="button"
                                className="suppliers-qty-btn"
                                onClick={() => {
                                  handleChangeSelectedDaySupplierAlertQuantity({
                                    alertItem: item,
                                    quantity: quantity + 1
                                  });
                                }}
                                disabled={isLockedForAdminEdition}
                              >
                                +
                              </button>
                            </div>
                            <div className="suppliers-unit-cost-block">
                              <label htmlFor={`supplier-cost-${item.id}`}>Costo unitario</label>
                              <input
                                id={`supplier-cost-${item.id}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={Number(item?.ui_unit_cost || 0)}
                                onChange={(event) => {
                                  handleChangeSelectedDaySupplierAlertUnitCost({
                                    alertItem: item,
                                    unitCost: event.target.value
                                  });
                                }}
                                disabled={isLockedForAdminEdition}
                              />
                              <small>
                                V.U: {formatMoney(item?.ui_unit_cost || 0)} | Valor O.: {formatMoney(item?.original_unit_cost || 0)}
                                {item?.has_order_unit_cost ? ' (pedido)' : ''}
                                {item?.has_last_known_unit_cost ? ' (ultima compra)' : ''}
                                {!item?.has_order_unit_cost && !item?.has_last_known_unit_cost ? ' (base)' : ''}
                              </small>
                              <small>Subtotal: {formatMoney(item?.ui_line_total || 0)}</small>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="suppliers-panel-subtitle">
                    Total estimado del pedido: {formatMoney(selectedDaySupplierAlerts?.pending_total_amount || 0)}
                  </p>
                  <button
                    type="button"
                    className="suppliers-confirm-build-btn"
                    onClick={handleConfirmSelectedDaySupplierOrder}
                    disabled={
                      isLockedForAdminEdition
                      ||
                      Number(confirmingWeekSupplierId) === Number(selectedDaySupplierDetail.supplier?.id || 0)
                      || !Number(selectedDaySupplierAlerts?.pending_items || 0)
                    }
                  >
                    {isLockedForAdminEdition
                      ? 'Pedido gestionado por operario'
                      : Number(confirmingWeekSupplierId) === Number(selectedDaySupplierDetail.supplier?.id || 0)
                      ? 'Confirmando...'
                      : (suppliersTestMode ? 'Guardar pedido (modo prueba)' : 'Guardar pedido para operario')}
                  </button>
                  {isLockedForAdminEdition ? (
                    <small className="empty-copy">
                      Este pedido ya fue tomado por operario. Admin queda en modo seguimiento.
                    </small>
                  ) : null}
                  {suppliersTestMode ? (
                    <small className="empty-copy">
                      Modo prueba activo: puedes rearmar pedidos fuera de flujo para testing.
                    </small>
                  ) : null}
                  {selectedDaySupplierDetail?.todayOrder?.items?.length ? (
                    <button
                      type="button"
                      className="suppliers-cancel-flow-btn"
                      onClick={() => {
                        const text = buildOrderWhatsappMessage(selectedDaySupplierDetail);
                        const encoded = encodeURIComponent(text);
                        const href = whatsappNumber
                          ? `https://wa.me/${whatsappNumber}?text=${encoded}`
                          : `https://wa.me/?text=${encoded}`;
                        window.open(href, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      Enviar lista por WhatsApp
                    </button>
                  ) : null}
                </>
              )}
            </div>

            <div className="suppliers-detail-col">
              <strong>Seguimiento del pedido (operario)</strong>
              {selectedDaySupplierInvoiceSummary ? (
                <div className="suppliers-invoice-summary">
                  <label htmlFor="supplier-invoice-amount">Monto real de boleta</label>
                  <input
                    id="supplier-invoice-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={selectedDaySupplierInvoiceSummary?.invoice_amount ?? ''}
                    onChange={(event) => {
                      handleChangeInvoiceAmount({
                        orderId: selectedDaySupplierInvoiceSummary?.order_id,
                        amount: event.target.value
                      });
                    }}
                    disabled={
                      String(selectedOrder?.status || '').toLowerCase() !== 'pendiente'
                      || !allowReceiveConfirmation
                    }
                  />
                  <small>
                    Esperado: {formatMoney(selectedDaySupplierInvoiceSummary?.expected_amount || 0)} | Diferencia:{' '}
                    {selectedDaySupplierInvoiceSummary?.diff_amount === null
                      ? 'sin cargar'
                      : formatMoney(selectedDaySupplierInvoiceSummary.diff_amount)}
                  </small>
                  {selectedDaySupplierInvoiceSummary?.has_mismatch ? (
                    <p className="suppliers-overdue-alert">
                      Atencion: la boleta no coincide con lo estimado del pedido.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {selectedOrder ? (
                <div className="suppliers-order-detail-grid">
                  <span>Pedido admin</span>
                  <strong>Creado</strong>
                  <span>Envio operario</span>
                  <strong>
                    {isPickupConfirmedByOperario
                      ? `Confirmado${selectedOrder?.pickup_confirmed_by_name ? ` por ${selectedOrder.pickup_confirmed_by_name}` : ''}`
                      : 'Pendiente'}
                  </strong>
                  <span>Recepcion operario</span>
                  <strong>{isReceivedByOperario ? 'Confirmada' : 'Pendiente'}</strong>
                </div>
              ) : null}
              {selectedDaySupplierReceivingItems?.length ? (
                <>
                  <div className="suppliers-order-items-list">
                    {selectedDaySupplierReceivingItems.map((item) => (
                      <div key={`order-item-${item.id || item.product_name}`} className="suppliers-order-item-row">
                        <span className="suppliers-build-name">{item.product_name}</span>
                        <small>
                          Pedidas: {Number(item.ordered_quantity || 0)} | Unit: {formatMoney(item.unit_cost)} | Total: {formatMoney(item.line_total)}
                        </small>
                        <div className="suppliers-build-actions suppliers-receive-actions">
                          <button
                            type="button"
                            className="suppliers-qty-btn"
                            onClick={() => {
                              if (Number(item?.received_quantity || 0) <= 0) {
                                return;
                              }
                              handleChangeReceivedItemQuantity({
                                orderId: selectedDaySupplierDetail.todayOrder?.id,
                                itemId: item?.id,
                                quantity: Number(item?.received_quantity || 0) - 1
                              });
                            }}
                            disabled={Number(item?.received_quantity || 0) <= 0}
                          >
                            -
                          </button>
                          <span>Recibir: {Number(item?.received_quantity || 0)}</span>
                          <button
                            type="button"
                            className="suppliers-qty-btn"
                            onClick={() => {
                              const maxQty = Number(item?.ordered_quantity || 0);
                              const nextQty = Number(item?.received_quantity || 0) + 1;
                              if (nextQty > maxQty) {
                                return;
                              }
                              handleChangeReceivedItemQuantity({
                                orderId: selectedDaySupplierDetail.todayOrder?.id,
                                itemId: item?.id,
                                quantity: nextQty
                              });
                            }}
                            disabled={Number(item?.received_quantity || 0) >= Number(item?.ordered_quantity || 0)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="suppliers-receive-btn"
                    onClick={() => setReceiveConfirmOpen(true)}
                    disabled={
                      !allowReceiveConfirmation
                      ||
                      selectedDaySupplierDetail?.isFutureDelivery
                      || !selectedOrder
                      || Number(receivingOrderId) === Number(selectedOrder?.id || 0)
                      || String(selectedOrder?.status || '').toLowerCase() !== 'pendiente'
                    }
                  >
                    {String(selectedOrder?.status || '').toLowerCase() === 'recibido'
                      ? 'Stock ya actualizado'
                      : !allowReceiveConfirmation
                        ? 'Recepcion confirmada por operario'
                      : Number(receivingOrderId) === Number(selectedOrder?.id || 0)
                        ? 'Actualizando stock...'
                        : 'Confirmar productos recibidos'}
                  </button>
                </>
              ) : (
                <p className="empty-copy">Todavia no hay productos confirmados para este dia.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <Modal show={receiveConfirmOpen} onHide={() => setReceiveConfirmOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar recepcion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            Se va a sumar al stock la cantidad que ajustaste en cada producto recibido.
          </p>
          <p className="mb-0">
            Queres confirmar esta accion?
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setReceiveConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="dark"
            onClick={async () => {
              await handleReceiveSelectedDaySupplierOrder();
              setReceiveConfirmOpen(false);
            }}
            disabled={Number(receivingOrderId) > 0}
          >
            Confirmar
          </Button>
        </Modal.Footer>
      </Modal>
    </article>
  );
}
