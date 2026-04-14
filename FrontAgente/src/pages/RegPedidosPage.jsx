import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { confirmSupplierPickup, fetchSuppliersAgenda, fetchSupplierOrders, receiveSupplierOrder } from '../services/api';
import { formatDateShort, formatMoney, getLocalISODate } from './suppliers/suppliersPage.utils';

function normalizeOrderStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function RegPedidosPage() {
  const suppliersDebug =
    import.meta.env.DEV || String(import.meta.env.VITE_SUPPLIERS_DEBUG || '').trim().toLowerCase() === 'true';
  const suppliersTestMode = String(import.meta.env.VITE_SUPPLIERS_TEST_MODE || '').trim().toLowerCase() === 'true';
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(getLocalISODate());
  const [agenda, setAgenda] = useState({ today: { delivery_items: [] } });
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [receivedQty, setReceivedQty] = useState({});
  const [itemNotes, setItemNotes] = useState({});
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [ordersFeed, setOrdersFeed] = useState([]);
  const [pickupOrders, setPickupOrders] = useState([]);
  const [confirmingPickupOrderId, setConfirmingPickupOrderId] = useState(null);

  const loadAgenda = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSuppliersAgenda({ date });
      const deliveryItems = Array.isArray(data?.today?.delivery_items)
        ? data.today.delivery_items
        : (Array.isArray(data?.today?.items) ? data.today.items : []);
      if (suppliersDebug) {
        console.info('[Reg.Pedidos][Operario] Esta es la lista de pedidos para recibir (desde admin):', {
          date,
          total: deliveryItems.length,
          items: deliveryItems
        });
      }
      setAgenda(data || { today: { delivery_items: [] } });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  const loadPickupOrders = useCallback(async () => {
    try {
      const orders = await fetchSupplierOrders({ limit: 120 });
      const allOrders = Array.isArray(orders) ? orders : [];
      setOrdersFeed(allOrders);

      const pendingOrders = allOrders.filter((order) => normalizeOrderStatus(order?.status) === 'pendiente');
      const pendingByOrderDate = pendingOrders.reduce((acc, order) => {
        const key = String(order?.order_date || 'sin-fecha');
        acc[key] = Number(acc[key] || 0) + 1;
        return acc;
      }, {});
      const pendingByDeliveryDate = pendingOrders.reduce((acc, order) => {
        const key = String(order?.delivery_date || 'sin-fecha');
        acc[key] = Number(acc[key] || 0) + 1;
        return acc;
      }, {});

      const items = allOrders.filter((order) => {
        const status = normalizeOrderStatus(order?.status);
        const orderDate = String(order?.order_date || '');
        const pickupConfirmedAt = String(order?.pickup_confirmed_at || '').trim();
        const matchesDate = suppliersTestMode ? orderDate <= date : orderDate === date;
        return status === 'pendiente' && matchesDate && !pickupConfirmedAt;
      });
      if (suppliersDebug) {
        console.info('[Reg.Pedidos][Operario] Esta es la lista de pedido desde admin (para enviar hoy):', {
          date,
          totalRawOrders: allOrders.length,
          totalPendingOrders: pendingOrders.length,
          pendingByOrderDate,
          pendingByDeliveryDate,
          total: items.length,
          items
        });
      }
      setPickupOrders(items);
    } catch (error) {
      toast.error(error.message);
    }
  }, [date]);

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);

  useEffect(() => {
    loadPickupOrders();
  }, [loadPickupOrders]);

  const todayOrders = useMemo(() => {
    const items = Array.isArray(agenda?.today?.delivery_items)
      ? agenda.today.delivery_items
      : (Array.isArray(agenda?.today?.items) ? agenda.today.items : []);
    const fromAgenda = items.filter((order) => {
      const status = normalizeOrderStatus(order?.status);
      const deliveryDate = String(order?.delivery_date || '');
      const matchesDate = suppliersTestMode ? deliveryDate <= date : deliveryDate === date;
      return status === 'pendiente' && matchesDate;
    });

    if (fromAgenda.length > 0) {
      return fromAgenda;
    }

    return (Array.isArray(ordersFeed) ? ordersFeed : []).filter((order) => {
      const status = normalizeOrderStatus(order?.status);
      const deliveryDate = String(order?.delivery_date || '');
      const matchesDate = suppliersTestMode ? deliveryDate <= date : deliveryDate === date;
      return status === 'pendiente' && matchesDate;
    });
  }, [agenda, ordersFeed, date, suppliersTestMode]);

  const selectedOrder = useMemo(
    () => todayOrders.find((order) => Number(order?.id) === Number(selectedOrderId)) || null,
    [todayOrders, selectedOrderId]
  );

  const selectedItems = useMemo(() => {
    return (Array.isArray(selectedOrder?.items) ? selectedOrder.items : []).map((item) => {
      const key = String(item?.id || '');
      const ordered = Number(item?.quantity || 0);
      const received = Number(receivedQty[key] ?? ordered);
      return {
        ...item,
        ordered_quantity: ordered,
        received_quantity: Math.max(0, Math.min(ordered, received)),
        note: String(itemNotes[key] || '').trim()
      };
    });
  }, [selectedOrder, receivedQty, itemNotes]);

  const handleSelectOrder = (order) => {
    const id = Number(order?.id || 0);
    if (!id) {
      return;
    }
    setSelectedOrderId(id);
    setInvoiceAmount(order?.invoice_amount ?? '');
    setReceivedQty({});
    setItemNotes({});
  };

  const handleConfirmReceive = async () => {
    if (!selectedOrder) {
      toast.error('Selecciona un pedido');
      return;
    }

    try {
      setConfirming(true);
      await receiveSupplierOrder(selectedOrder.id, {
        context_date: date,
        invoice_amount: invoiceAmount === '' ? null : Number(invoiceAmount),
        items: selectedItems.map((item) => ({
          item_id: Number(item?.id || 0),
          quantity_received: Number(item?.received_quantity || 0),
          note: item?.note || null
        }))
      });
      toast.success('Recepcion registrada');
      setSelectedOrderId(null);
      setReceivedQty({});
      setItemNotes({});
      setInvoiceAmount('');
      await loadAgenda();
      await loadPickupOrders();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleConfirmPickup = async (orderId) => {
    const parsedOrderId = Number(orderId);
    if (!parsedOrderId) {
      return;
    }

    try {
      setConfirmingPickupOrderId(parsedOrderId);
      await confirmSupplierPickup(parsedOrderId);
      toast.success('Pedido enviado confirmado');
      await loadPickupOrders();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setConfirmingPickupOrderId(null);
    }
  };

  return (
    <section className="page-section suppliers-page">
      <article className="card-panel suppliers-panel suppliers-panel-full">
        <h2>Reg.Pedidos</h2>
        <p className="suppliers-panel-subtitle">Recepcion operativa de pedidos por proveedor.</p>
        <small>Fecha de trabajo: {formatDateShort(date)}</small>
      </article>

      <div className="suppliers-grid">
        <article className="card-panel suppliers-panel">
          <h3>Pedidos para enviar hoy</h3>
          {pickupOrders.length === 0 ? (
            <p className="empty-copy">Sin pedidos pendientes de envio para hoy.</p>
          ) : (
            <div className="suppliers-order-items-list">
              {pickupOrders.map((order) => (
                <div key={`pickup-order-${order.id}`} className="suppliers-order-item-row">
                  <strong>{order?.supplier_name}</strong>
                  <small>
                    Fecha pedido: {order?.order_date} | Monto: {formatMoney(order?.expected_amount || 0)}
                  </small>
                  <Button
                    variant="dark"
                    onClick={() => handleConfirmPickup(order?.id)}
                    disabled={Number(confirmingPickupOrderId) === Number(order?.id || 0)}
                  >
                    {Number(confirmingPickupOrderId) === Number(order?.id || 0)
                      ? 'Confirmando...'
                      : 'Confirmar pedido enviado'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card-panel suppliers-panel">
          <h3>Proveedores que llegan hoy</h3>
          {loading ? (
            <p className="empty-copy">Cargando...</p>
          ) : todayOrders.length === 0 ? (
            <p className="empty-copy">No hay pedidos pendientes para hoy.</p>
          ) : (
            <div className="suppliers-day-type-list">
              {todayOrders.map((order) => (
                <button
                  key={`reg-order-${order.id}`}
                  type="button"
                  className={`suppliers-day-chip suppliers-day-chip-button ${
                    Number(selectedOrderId) === Number(order.id) ? 'is-selected' : ''
                  }`}
                  onClick={() => handleSelectOrder(order)}
                >
                  {order?.supplier_name} ({formatMoney(order?.expected_amount || 0)})
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="card-panel suppliers-panel">
          <h3>Detalle de recepcion</h3>
          {!selectedOrder ? (
            <p className="empty-copy">Selecciona un proveedor para registrar la recepcion.</p>
          ) : (
            <div className="suppliers-order-items-list">
              <label htmlFor="reg-invoice-amount">Monto boleta</label>
              <input
                id="reg-invoice-amount"
                type="number"
                min="0"
                step="0.01"
                value={invoiceAmount}
                onChange={(event) => setInvoiceAmount(event.target.value)}
              />
              {selectedItems.map((item) => (
                <div key={`reg-item-${item.id}`} className="suppliers-order-item-row">
                  <strong>{item?.product_name}</strong>
                  <small>
                    Esperado: {Number(item?.ordered_quantity || 0)} | Unit: {formatMoney(item?.unit_cost || 0)} | Total:{' '}
                    {formatMoney(item?.line_total || 0)}
                  </small>
                  <div className="suppliers-receive-actions">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => {
                        const key = String(item.id);
                        const current = Number(receivedQty[key] ?? item.ordered_quantity);
                        setReceivedQty((prev) => ({ ...prev, [key]: Math.max(0, current - 1) }));
                      }}
                    >
                      -
                    </Button>
                    <span>Recibido: {Number(item?.received_quantity || 0)}</span>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => {
                        const key = String(item.id);
                        const current = Number(receivedQty[key] ?? item.ordered_quantity);
                        setReceivedQty((prev) => ({
                          ...prev,
                          [key]: Math.min(Number(item?.ordered_quantity || 0), current + 1)
                        }));
                      }}
                    >
                      +
                    </Button>
                  </div>
                  <input
                    type="text"
                    placeholder="Detalle inconsistencia (ej: faltante / roto)"
                    value={itemNotes[String(item.id)] || ''}
                    onChange={(event) => {
                      const key = String(item.id);
                      setItemNotes((prev) => ({ ...prev, [key]: event.target.value }));
                    }}
                  />
                </div>
              ))}
              <Button variant="dark" onClick={handleConfirmReceive} disabled={confirming}>
                {confirming ? 'Confirmando...' : 'Confirmar recepcion'}
              </Button>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

export default RegPedidosPage;
