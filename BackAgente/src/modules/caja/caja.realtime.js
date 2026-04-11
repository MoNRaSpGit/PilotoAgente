import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

const listeners = new Set();
let heartbeatId = null;

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function getStreamToken(req) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }

  if (typeof req.query?.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }

  return null;
}

export function authenticateCashboxStream(req) {
  const token = getStreamToken(req);

  if (!token) {
    const error = new Error('Token requerido');
    error.status = 401;
    throw error;
  }

  try {
    const user = jwt.verify(token, env.jwtAccessSecret);
    const normalizedRole = normalizeRole(user.role);

    if (!['admin', 'operario'].includes(normalizedRole)) {
      const error = new Error('No autorizado');
      error.status = 403;
      throw error;
    }

    return {
      ...user,
      role: normalizedRole
    };
  } catch (error) {
    if (error.status) {
      throw error;
    }

    const authError = new Error('Token invalido');
    authError.status = 401;
    throw authError;
  }
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);

  if (data !== undefined) {
    res.write(`data: ${JSON.stringify(data)}\n`);
  }

  res.write('\n');
}

function ensureHeartbeat() {
  if (heartbeatId) {
    return;
  }

  heartbeatId = setInterval(() => {
    for (const res of listeners) {
      try {
        res.write(`event: ping\ndata: {}\n\n`);
      } catch {
        listeners.delete(res);
      }
    }

    if (listeners.size === 0 && heartbeatId) {
      clearInterval(heartbeatId);
      heartbeatId = null;
    }
  }, 25000);
}

export function attachCashboxStream(req, res, user) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  listeners.add(res);
  ensureHeartbeat();

  writeSse(res, 'connected', {
    ok: true,
    user: {
      id: user?.id || null,
      name: user?.name || null,
      role: user?.role || null
    }
  });

  const closeConnection = () => {
    listeners.delete(res);

    if (listeners.size === 0 && heartbeatId) {
      clearInterval(heartbeatId);
      heartbeatId = null;
    }
  };

  req.on('close', closeConnection);
  req.on('aborted', closeConnection);
}

export function broadcastCashboxUpdate(payload = {}) {
  if (listeners.size === 0) {
    return;
  }

  for (const res of [...listeners]) {
    try {
      writeSse(res, 'cashbox:update', payload);
    } catch {
      listeners.delete(res);
    }
  }
}
