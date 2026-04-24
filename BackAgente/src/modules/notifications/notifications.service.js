import webpush from 'web-push';
import { env } from '../../config/env.js';
import {
  deactivatePushSubscriptionByEndpoint,
  listActiveOpsPushSubscriptions,
  upsertPushSubscription
} from './notifications.repository.js';

let vapidConfigured = false;

function createServiceError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeRole(value = '') {
  return String(value || '').trim().toLowerCase();
}

function buildPushConfig() {
  const subject = String(env.vapidSubject || '').trim();
  const publicKey = String(env.vapidPublicKey || '').trim();
  const privateKey = String(env.vapidPrivateKey || '').trim();
  const enabled = Boolean(subject && publicKey && privateKey);

  return {
    enabled,
    subject,
    publicKey,
    privateKey
  };
}

function configureWebPush() {
  if (vapidConfigured) {
    return;
  }

  const config = buildPushConfig();
  if (!config.enabled) {
    return;
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  vapidConfigured = true;
}

function parsePushSubscriptionPayload(payload = {}) {
  const endpoint = String(payload?.endpoint || '').trim();
  const p256dh = String(payload?.keys?.p256dh || '').trim();
  const auth = String(payload?.keys?.auth || '').trim();

  if (!endpoint || !p256dh || !auth) {
    throw createServiceError('Suscripcion push invalida', 400);
  }

  return {
    endpoint,
    keys: { p256dh, auth }
  };
}

export function getPushPublicConfig() {
  const config = buildPushConfig();
  return {
    enabled: config.enabled,
    publicKey: config.publicKey
  };
}

export async function registerPushSubscription(user = {}, payload = {}, { userAgent = '' } = {}) {
  const role = normalizeRole(user?.role);
  if (!user?.id || !['admin', 'operario'].includes(role)) {
    throw createServiceError('No autorizado para suscripcion push', 403);
  }

  const subscription = parsePushSubscriptionPayload(payload);
  await upsertPushSubscription({
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    userId: Number(user.id),
    userRole: role,
    sourceApp: 'frontagente',
    userAgent
  });

  return {
    ok: true
  };
}

export async function unregisterPushSubscription(payload = {}) {
  const endpoint = String(payload?.endpoint || '').trim();
  if (!endpoint) {
    throw createServiceError('Endpoint requerido', 400);
  }

  await deactivatePushSubscriptionByEndpoint(endpoint);
  return { ok: true };
}

export async function notifyOpsWebOrderCreated(order = {}) {
  const config = buildPushConfig();
  if (!config.enabled) {
    return { sent: 0, failed: 0, skipped: true };
  }

  configureWebPush();

  const subscriptions = await listActiveOpsPushSubscriptions();
  if (!subscriptions.length) {
    return { sent: 0, failed: 0, skipped: false };
  }

  const customerName = String(order?.web_usuario_nombre || 'Cliente');
  const total = Number(order?.total_estimado || 0).toFixed(2);
  const orderId = Number(order?.id || 0);

  const payload = JSON.stringify({
    title: 'Nuevo pedido web',
    body: `${customerName} hizo un pedido ($${total})`,
    tag: orderId > 0 ? `web-order-${orderId}` : 'web-order',
    data: {
      url: '/web-pedidos',
      order_id: orderId
    },
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    renotify: true,
    silent: false,
    vibrate: [180, 80, 180]
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      const endpoint = String(subscription.endpoint || '').trim();
      if (!endpoint) {
        return;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint,
            keys: {
              p256dh: String(subscription.p256dh || '').trim(),
              auth: String(subscription.auth || '').trim()
            }
          },
          payload,
          { TTL: 120 }
        );
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await deactivatePushSubscriptionByEndpoint(endpoint);
        }
        throw error;
      }
    })
  );

  const sent = results.filter((result) => result.status === 'fulfilled').length;
  const failed = results.length - sent;

  return { sent, failed, skipped: false };
}
