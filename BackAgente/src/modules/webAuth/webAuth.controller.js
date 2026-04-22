import { findWebUserById } from './webAuth.repository.js';
import { loginWebUser, registerWebUser } from './webAuth.service.js';
import { getWebAuthProfile } from '../webUsers/webUsers.service.js';
import { webLoginRateLimiter, webRegisterRateLimiter } from './webAuth.rateLimit.js';

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function logWebAuthFailure(req, stage, error) {
  const payload = {
    stage,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: getClientIp(req),
    status: error?.status || 500,
    message: error?.message || 'unknown_error'
  };
  console.warn('[web-auth] fallo', payload);
}

function isRetryableConnectionError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  if (code === 'PROTOCOL_CONNECTION_LOST' || code === 'ECONNRESET' || code === 'EPIPE') {
    return true;
  }
  return message.includes('read econnreset') || message.includes('connection lost');
}

function handleServiceError(res, error, fallbackMessage) {
  const status = error.status || (isRetryableConnectionError(error) ? 503 : 500);
  const message = (isRetryableConnectionError(error) && !error.status)
    ? 'Error temporal del servidor. Reintenta en unos segundos.'
    : (error.message || fallbackMessage);

  return res.status(status).json({
    message
  });
}

export async function registerWebUserController(req, res) {
  const rate = webRegisterRateLimiter.check(req);
  if (!rate.allowed) {
    return res.status(429).json({
      message: 'Demasiados intentos de registro. Intenta de nuevo en unos minutos.'
    });
  }

  try {
    const data = await registerWebUser(req.body);
    webRegisterRateLimiter.clear(rate.key);
    return res.status(201).json(data);
  } catch (error) {
    logWebAuthFailure(req, 'register', error);
    if ((error.status || 500) !== 409) {
      webRegisterRateLimiter.recordFailure(rate.key);
    }
    return handleServiceError(res, error, 'No se pudo registrar usuario web');
  }
}

export async function loginWebUserController(req, res) {
  const rate = webLoginRateLimiter.check(req);
  if (!rate.allowed) {
    return res.status(429).json({
      message: 'Demasiados intentos de login. Intenta de nuevo en unos minutos.'
    });
  }

  try {
    const data = await loginWebUser(req.body);
    webLoginRateLimiter.clear(rate.key);
    return res.json(data);
  } catch (error) {
    logWebAuthFailure(req, 'login', error);
    if ((error.status || 500) === 401) {
      webLoginRateLimiter.recordFailure(rate.key);
    }
    return handleServiceError(res, error, 'No se pudo iniciar sesion web');
  }
}

export async function meWebUserController(req, res) {
  try {
    const user = await findWebUserById(req.webUser?.id);

    if (!user || user.estado !== 'activo') {
      return res.status(401).json({ message: 'Usuario web no autorizado' });
    }

    const { profile } = await getWebAuthProfile(req.webUser?.id);
    return res.json({ user, profile });
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo obtener el usuario web');
  }
}
