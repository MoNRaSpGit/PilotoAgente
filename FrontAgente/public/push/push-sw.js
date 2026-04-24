/* global self, URL */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = String(payload?.title || 'Nuevo pedido');
  const body = String(payload?.body || 'Tenes una nueva notificacion');
  const icon = String(payload?.icon || '/icons/icon-192.png');
  const badge = String(payload?.badge || '/icons/icon-192.png');
  const tag = String(payload?.tag || 'frontagente-notification');
  const data = payload?.data || {};
  const renotify = Boolean(payload?.renotify);
  const silent = Boolean(payload?.silent);
  const vibrate = Array.isArray(payload?.vibrate) ? payload.vibrate : undefined;
  const requireInteraction = Boolean(payload?.requireInteraction);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data,
      renotify,
      silent,
      vibrate,
      requireInteraction
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = String(event.notification?.data?.url || '/web-pedidos');
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url && client.url.includes('/web-pedidos')) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
