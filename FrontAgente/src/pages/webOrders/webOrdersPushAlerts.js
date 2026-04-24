import {
  fetchPushPublicConfig,
  registerPushSubscription,
  unregisterPushSubscription
} from '../../services/api';

const WEB_ORDERS_PUSH_PREF_KEY = 'frontagente:web-orders-push-enabled';
const WEB_ORDERS_PUSH_MARK_READ_EVENT = 'web_orders_mark_read';

function getAppBaseUrl() {
  const baseUrl = String(import.meta.env.BASE_URL || '/').trim();
  if (!baseUrl) {
    return '/';
  }
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function getPushWorkerScriptUrl() {
  return `${getAppBaseUrl()}push/push-sw.js`;
}

function getPushWorkerScope() {
  return `${getAppBaseUrl()}push/`;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function loadWebOrdersPushEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(WEB_ORDERS_PUSH_PREF_KEY) === '1';
}

export function saveWebOrdersPushEnabled(enabled) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(WEB_ORDERS_PUSH_PREF_KEY, enabled ? '1' : '0');
}

export function isPushRuntimeSupported() {
  if (typeof window === 'undefined') {
    return false;
  }
  return (
    'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
  );
}

async function postMessageToPushWorker(payload = {}) {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const worker = registration.active || registration.waiting || registration.installing;
  if (!worker) {
    return;
  }

  worker.postMessage(payload);
}

export async function markWebOrdersPushAsRead() {
  if (typeof window === 'undefined') {
    return;
  }

  if (typeof navigator.clearAppBadge === 'function') {
    await navigator.clearAppBadge().catch(() => {});
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  await postMessageToPushWorker({
    type: WEB_ORDERS_PUSH_MARK_READ_EVENT
  }).catch(() => {});
}

async function ensurePushWorkerRegistration() {
  const scriptUrl = getPushWorkerScriptUrl();
  const scope = getPushWorkerScope();
  await navigator.serviceWorker.register(scriptUrl, { scope });
  const readyRegistration = await navigator.serviceWorker.ready;
  return readyRegistration;
}

function normalizePushSubscribeError(error) {
  const message = String(error?.message || '').trim();
  const lower = message.toLowerCase();

  if (lower.includes('permission') || lower.includes('denied')) {
    return 'Permiso de notificaciones denegado por el navegador/dispositivo';
  }
  if (lower.includes('service worker') || lower.includes('registration failed')) {
    return 'No se pudo activar el Service Worker de push. Reintenta en unos segundos.';
  }
  if (lower.includes('applicationserverkey') || lower.includes('invalid character')) {
    return 'La clave VAPID publica no es valida en backend';
  }

  return message || 'No se pudo suscribir notificaciones push';
}

export async function enableWebOrdersPushNotifications() {
  if (!isPushRuntimeSupported()) {
    throw new Error('Push no soportado en este dispositivo/navegador');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permiso de notificaciones no concedido');
  }

  const config = await fetchPushPublicConfig();
  if (!config.enabled || !config.publicKey) {
    throw new Error('Push no disponible en backend (VAPID sin configurar)');
  }

  const registration = await ensurePushWorkerRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey)
      });
    } catch (error) {
      throw new Error(normalizePushSubscribeError(error));
    }
  }

  await registerPushSubscription(subscription.toJSON());
  saveWebOrdersPushEnabled(true);
}

export async function disableWebOrdersPushNotifications() {
  if (!isPushRuntimeSupported()) {
    saveWebOrdersPushEnabled(false);
    return;
  }

  const registration = await ensurePushWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = String(subscription.endpoint || '').trim();
    if (endpoint) {
      await unregisterPushSubscription({ endpoint });
    }
    await subscription.unsubscribe().catch(() => {});
  }

  saveWebOrdersPushEnabled(false);
}
