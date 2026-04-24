/* global self, URL */

function resolveAssetUrl(assetValue = '', fallbackUrl = '') {
  const raw = String(assetValue || '').trim();
  if (!raw) {
    return fallbackUrl;
  }

  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) {
    return raw;
  }

  const normalizedRelative = raw.startsWith('/') ? raw.slice(1) : raw;
  return new URL(normalizedRelative, self.registration.scope).href;
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = String(payload?.title || 'Nuevo pedido');
  const body = String(payload?.body || 'Tenes una nueva notificacion');
  const defaultIcon = new URL('icons/icon-192.png', self.registration.scope).href;
  const icon = resolveAssetUrl(payload?.icon, defaultIcon);
  const badge = resolveAssetUrl(payload?.badge, defaultIcon);
  const tag = String(payload?.tag || 'frontagente-notification');
  const data = payload?.data || {};
  const renotify = Boolean(payload?.renotify);
  const silent = Boolean(payload?.silent);
  const vibrate = Array.isArray(payload?.vibrate) ? payload.vibrate : undefined;
  const requireInteraction = Boolean(payload?.requireInteraction);

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const hasVisibleClient = clients.some((client) => client.visibilityState === 'visible');

    if (hasVisibleClient) {
      return;
    }

    await self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data,
      renotify,
      silent,
      vibrate,
      requireInteraction
    });

    if (typeof self.registration?.setAppBadge === 'function') {
      await self.registration.setAppBadge(1).catch(() => {});
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = String(event.notification?.data?.url || '/web-pedidos');
  const targetUrl = new URL(targetPath, self.location.origin).href;

  const openOrFocusPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if (client.url && client.url.includes('/web-pedidos')) {
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  });

  event.waitUntil(
    openOrFocusPromise
  );
});
