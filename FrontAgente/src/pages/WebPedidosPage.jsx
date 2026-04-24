import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import toast from 'react-hot-toast';
import {
  buildAdminWebOrdersStreamUrl,
  fetchIncomingWebOrders,
  hideIncomingWebOrder,
  updateIncomingWebOrderStatus
} from '../services/api';
import {
  createWebOrdersBeepPlayer,
  getNextWebOrdersSoundStyleId,
  getWebOrdersSoundStyleLabel,
  loadWebOrdersSoundEnabled,
  loadWebOrdersSoundStyleId,
  saveWebOrdersSoundEnabled,
  saveWebOrdersSoundStyleId,
  getWebOrdersSoundStyles
} from './webOrders/webOrdersAudioAlert';
import {
  disableWebOrdersPushNotifications,
  enableWebOrdersPushNotifications,
  isPushRuntimeSupported,
  loadWebOrdersPushEnabled
} from './webOrders/webOrdersPushAlerts';
import { applyAdminWebOrderEvent, normalizeWebOrderStatus } from './webOrders/webOrdersRealtime';

function statusLabel(status) {
  const normalized = normalizeWebOrderStatus(status);
  if (normalized === 'pendiente') {
    return 'Pendiente';
  }
  if (normalized === 'en_proceso') {
    return 'En proceso';
  }
  if (normalized === 'listo') {
    return 'Listo';
  }
  if (normalized === 'entregado') {
    return 'Entregado';
  }
  if (normalized === 'cobrado_en_scanner') {
    return 'Cobrado';
  }
  if (normalized === 'cancelado') {
    return 'Cancelado';
  }
  return normalized;
}

function nextStatus(status) {
  const normalized = normalizeWebOrderStatus(status);
  if (normalized === 'pendiente') {
    return 'en_proceso';
  }
  if (normalized === 'en_proceso') {
    return 'listo';
  }
  if (normalized === 'listo') {
    return 'entregado';
  }
  return null;
}

function formatOrderDate(dateText) {
  const raw = String(dateText || '').trim();
  if (!raw) {
    return 'Sin fecha';
  }

  const utcCandidate = raw.includes('T')
    ? raw
    : raw.replace(' ', 'T');

  const parsedDate = new Date(`${utcCandidate}Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat('es-UY', {
    timeZone: 'America/Montevideo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(parsedDate);
}

function paymentLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'pos') {
    return 'POS';
  }
  if (normalized === 'efectivo') {
    return 'Efectivo';
  }
  if (normalized === 'cuenta') {
    return 'Cuenta';
  }
  if (normalized === 'puntos') {
    return 'Puntos';
  }
  return normalized || '-';
}

function deliveryLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'delivery') {
    return 'Delivery';
  }
  if (normalized === 'pickup') {
    return 'Yo voy';
  }
  return normalized || '-';
}

export default function WebPedidosPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(() => loadWebOrdersSoundEnabled());
  const [soundStyleId, setSoundStyleId] = useState(() => loadWebOrdersSoundStyleId());
  const [pushEnabled, setPushEnabled] = useState(() => loadWebOrdersPushEnabled());
  const [savingPush, setSavingPush] = useState(false);
  const beepPlayerRef = useRef(null);
  const soundStyles = useMemo(() => getWebOrdersSoundStyles(), []);
  const pushSupported = useMemo(() => isPushRuntimeSupported(), []);

  const getBeepPlayer = useCallback(() => {
    if (!beepPlayerRef.current) {
      beepPlayerRef.current = createWebOrdersBeepPlayer();
    }
    return beepPlayerRef.current;
  }, []);

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const items = await fetchIncomingWebOrders({ limit: 120 });
      setOrders(items);
    } catch (error) {
      toast.error(error.message || 'No se pudieron cargar los pedidos web');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const streamUrl = buildAdminWebOrdersStreamUrl();
    if (!streamUrl) {
      return undefined;
    }

    const eventSource = new EventSource(streamUrl);
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        if (payload?.type === 'keepalive' || payload?.type === 'connected') {
          return;
        }
        if (payload?.order || payload?.order_id) {
          setOrders((current) => applyAdminWebOrderEvent(current, payload));
          return;
        }
      } catch (_error) {
        // If parse fails, refresh anyway as safe fallback.
      }
      loadOrders({ silent: true });
    };
    eventSource.onerror = () => {
      // Keep connection best-effort; backend keepalive handles most cases.
    };

    return () => {
      eventSource.close();
    };
  }, [loadOrders]);

  useEffect(() => {
    saveWebOrdersSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    saveWebOrdersSoundStyleId(soundStyleId);
  }, [soundStyleId]);

  useEffect(() => () => {
    if (beepPlayerRef.current) {
      beepPlayerRef.current.destroy();
      beepPlayerRef.current = null;
    }
  }, []);

  const activeOrders = useMemo(
    () => orders.filter((order) => ['pendiente', 'en_proceso', 'listo', 'entregado'].includes(normalizeWebOrderStatus(order?.estado))),
    [orders]
  );

  async function handleAdvanceStatus(order) {
    const targetStatus = nextStatus(order?.estado);
    if (!targetStatus) {
      return;
    }

    try {
      const orderId = Number(order?.id || 0);
      if (!orderId) {
        return;
      }

      setSavingOrderId(orderId);
      const updated = await updateIncomingWebOrderStatus(orderId, targetStatus);
      const normalizedUpdated = normalizeWebOrderStatus(updated?.estado || targetStatus);
      toast.success(`Pedido ${orderId} -> ${statusLabel(normalizedUpdated)}`);
      setOrders((current) => current.map((item) => (
        Number(item.id) === orderId
          ? { ...item, ...updated, estado: normalizedUpdated }
          : item
      )));
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar estado');
    } finally {
      setSavingOrderId(null);
    }
  }

  async function handleHideOrder(order) {
    const orderId = Number(order?.id || 0);
    if (!orderId) {
      return;
    }

    const status = normalizeWebOrderStatus(order?.estado);
    if (status !== 'entregado') {
      toast.error('Solo podes eliminar pedidos entregados');
      return;
    }

    try {
      setSavingOrderId(orderId);
      await hideIncomingWebOrder(orderId);
      setOrders((current) => current.filter((item) => Number(item.id) !== orderId));
      toast.success(`Pedido ${orderId} eliminado`);
    } catch (error) {
      toast.error(error.message || 'No se pudo eliminar el pedido');
    } finally {
      setSavingOrderId(null);
    }
  }

  return (
    <section className="page-section web-orders-page">
      <article className="card-panel web-orders-header">
        <h2>Web</h2>
        <p className="empty-copy">Pedidos recibidos desde la web para seguimiento operativo.</p>
        <div className="web-orders-header-actions">
          <small>{refreshing ? 'Actualizando...' : `${activeOrders.length} pedidos activos`}</small>
          <Button
            variant={soundEnabled ? 'dark' : 'outline-dark'}
            size="sm"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) {
                getBeepPlayer().playStyle(soundStyleId);
                toast.success('Sonido de pedidos activado');
              } else {
                toast('Sonido de pedidos desactivado');
              }
            }}
          >
            Sonido: {soundEnabled ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outline-dark"
            size="sm"
            onClick={() => {
              const nextStyleId = getNextWebOrdersSoundStyleId(soundStyleId);
              setSoundStyleId(nextStyleId);
              getBeepPlayer().playStyle(nextStyleId);
              toast(`Beep: ${getWebOrdersSoundStyleLabel(nextStyleId)}`);
            }}
          >
            Beep: {soundStyles.findIndex((style) => style.id === soundStyleId) + 1}/{soundStyles.length}
          </Button>
          <Button variant="outline-dark" size="sm" onClick={() => loadOrders({ silent: true })}>
            Refrescar
          </Button>
          <Button
            variant={pushEnabled ? 'dark' : 'outline-dark'}
            size="sm"
            disabled={!pushSupported || savingPush}
            onClick={async () => {
              if (!pushSupported) {
                toast.error('Push no soportado en este dispositivo');
                return;
              }

              setSavingPush(true);
              try {
                if (pushEnabled) {
                  await disableWebOrdersPushNotifications();
                  setPushEnabled(false);
                  toast('Push de pedidos desactivado');
                } else {
                  await enableWebOrdersPushNotifications();
                  setPushEnabled(true);
                  toast.success('Push de pedidos activado');
                }
              } catch (error) {
                toast.error(error.message || 'No se pudo cambiar push');
              } finally {
                setSavingPush(false);
              }
            }}
          >
            Push SO: {pushEnabled ? 'ON' : 'OFF'}
          </Button>
        </div>
      </article>

      <article className="card-panel web-orders-panel">
        {loading ? <p className="empty-copy">Cargando pedidos web...</p> : null}

        {!loading && activeOrders.length === 0 ? (
          <p className="empty-copy">No hay pedidos web pendientes por ahora.</p>
        ) : null}

        {!loading && activeOrders.length > 0 ? (
          <ul className="web-orders-list">
            {activeOrders.map((order) => {
              const normalizedStatus = normalizeWebOrderStatus(order?.estado);
              const next = nextStatus(normalizedStatus);
              return (
                <li key={`web-order-${order.id}`} className="web-orders-item">
                  <div className="web-orders-item-head">
                    <strong>{order?.web_usuario_nombre || 'Cliente web'}</strong>
                    <span className={`web-orders-status web-orders-status--${normalizedStatus}`}>
                      {statusLabel(normalizedStatus)}
                    </span>
                  </div>

                  <small>{formatOrderDate(order?.created_at)}</small>
                  <p>Total: ${Number(order?.total_estimado || 0).toFixed(2)}</p>
                  <p>Pago: {paymentLabel(order?.payment_method)}</p>
                  <p>Entrega: {deliveryLabel(order?.delivery_mode)}</p>

                  <ul className="web-orders-items">
                    {(Array.isArray(order?.items) ? order.items : []).map((item) => (
                      <li key={`web-order-${order.id}-item-${item.id}`}>
                        <span>{Number(item.quantity || 0)} x</span>
                        <strong>{item.product_name}</strong>
                      </li>
                    ))}
                  </ul>

                  <div className="web-orders-item-actions">
                    <Button
                      variant="dark"
                      size="sm"
                      disabled={!next || Number(savingOrderId) === Number(order?.id || 0)}
                      onClick={() => handleAdvanceStatus(order)}
                    >
                      {!next ? 'Sin cambios' : (
                        Number(savingOrderId) === Number(order?.id || 0)
                          ? 'Guardando...'
                          : `Pasar a ${statusLabel(next)}`
                      )}
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      disabled={normalizedStatus !== 'entregado' || Number(savingOrderId) === Number(order?.id || 0)}
                      onClick={() => handleHideOrder(order)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </article>
    </section>
  );
}
