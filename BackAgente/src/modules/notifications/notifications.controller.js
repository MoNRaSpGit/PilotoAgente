import {
  getPushPublicConfig,
  registerPushSubscription,
  unregisterPushSubscription
} from './notifications.service.js';

function handleServiceError(res, error, fallbackMessage) {
  const status = error?.status || 500;
  return res.status(status).json({
    message: error?.message || fallbackMessage
  });
}

export function getPushPublicConfigController(_req, res) {
  return res.json(getPushPublicConfig());
}

export async function registerPushSubscriptionController(req, res) {
  try {
    const data = await registerPushSubscription(req.user, req.body || {}, {
      userAgent: req.headers['user-agent'] || ''
    });
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo registrar la suscripcion push');
  }
}

export async function unregisterPushSubscriptionController(req, res) {
  try {
    const data = await unregisterPushSubscription(req.body || {});
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo remover la suscripcion push');
  }
}
