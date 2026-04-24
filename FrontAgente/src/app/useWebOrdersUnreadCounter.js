import { useEffect, useRef, useState } from 'react';
import { buildAdminWebOrdersStreamUrl } from '../services/api';

function getOrderCreatedEventId(payload) {
  if (!payload || String(payload.type || '') !== 'order_created') {
    return 0;
  }

  const orderId = Number(payload?.order_id || payload?.order?.id || 0);
  return Number.isFinite(orderId) && orderId > 0 ? orderId : 0;
}

export function useWebOrdersUnreadCounter({ enabled = false, currentPath = '' } = {}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const seenEventOrderIdsRef = useRef(new Set());

  useEffect(() => {
    if (String(currentPath || '').toLowerCase() === '/web-pedidos') {
      setUnreadCount(0);
    }
  }, [currentPath]);

  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0);
      seenEventOrderIdsRef.current.clear();
      return undefined;
    }

    const streamUrl = buildAdminWebOrdersStreamUrl();
    if (!streamUrl) {
      return undefined;
    }

    const eventSource = new EventSource(streamUrl);
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        const eventOrderId = getOrderCreatedEventId(payload);

        if (!eventOrderId) {
          return;
        }
        if (seenEventOrderIdsRef.current.has(eventOrderId)) {
          return;
        }

        seenEventOrderIdsRef.current.add(eventOrderId);

        if (String(currentPath || '').toLowerCase() === '/web-pedidos') {
          return;
        }

        setUnreadCount((current) => current + 1);
      } catch {
        // keep stream best-effort
      }
    };

    return () => {
      eventSource.close();
    };
  }, [enabled, currentPath]);

  return unreadCount;
}
