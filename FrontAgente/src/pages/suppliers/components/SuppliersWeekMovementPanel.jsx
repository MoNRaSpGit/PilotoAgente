import { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { formatDateShort, formatMoney } from '../suppliersPage.utils';

export function SuppliersWeekMovementPanel({
  weekMovementSchedule,
  selectedDaySupplierDetail,
  selectedDaySupplierAlerts,
  selectedDaySupplierReceivingItems,
  loadingDaySupplierProducts,
  confirmingWeekSupplierId,
  receivingOrderId,
  handleChangeSelectedDaySupplierAlertQuantity = () => {},
  handleChangeReceivedItemQuantity = () => {},
  handleConfirmSelectedDaySupplierOrder = () => {},
  handleReceiveSelectedDaySupplierOrder = () => {},
  handleCancelSelectedDaySupplierFlow = () => {},
  handleSelectDaySupplier = () => {}
}) {
  const selectedSupplierId = Number(selectedDaySupplierDetail?.supplier?.id || 0);
  const selectedDate = String(selectedDaySupplierDetail?.date || '');
  const selectedMovement = String(selectedDaySupplierDetail?.movementType || '');
  const isDeliveryFlow = selectedMovement === 'delivery';
  const [receiveConfirmOpen, setReceiveConfirmOpen] = useState(false);

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
              {selectedDaySupplierDetail.todayOrder
                ? formatMoney(selectedDaySupplierDetail.todayOrder.expected_amount)
                : 'Sin pedido cargado para ese dia'}
            </strong>
          </div>
          {selectedDaySupplierDetail?.isDeliveryOverdue ? (
            <p className="suppliers-overdue-alert">
              Esta entrega quedo pendiente y ya paso la fecha. Confirmala cuanto antes para actualizar stock.
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
                                disabled={quantity <= 0}
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
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    className="suppliers-confirm-build-btn"
                    onClick={handleConfirmSelectedDaySupplierOrder}
                    disabled={
                      Number(confirmingWeekSupplierId) === Number(selectedDaySupplierDetail.supplier?.id || 0)
                      || !Number(selectedDaySupplierAlerts?.pending_items || 0)
                    }
                  >
                    {Number(confirmingWeekSupplierId) === Number(selectedDaySupplierDetail.supplier?.id || 0)
                      ? 'Confirmando...'
                      : 'Confirmar pedido para este dia'}
                  </button>
                </>
              )}
            </div>

            <div className="suppliers-detail-col">
              <strong>Pedido confirmado para este dia</strong>
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
                      Number(receivingOrderId) === Number(selectedDaySupplierDetail.todayOrder?.id || 0)
                      || String(selectedDaySupplierDetail.todayOrder?.status || '').toLowerCase() !== 'pendiente'
                    }
                  >
                    {String(selectedDaySupplierDetail.todayOrder?.status || '').toLowerCase() === 'recibido'
                      ? 'Stock ya actualizado'
                      : Number(receivingOrderId) === Number(selectedDaySupplierDetail.todayOrder?.id || 0)
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
