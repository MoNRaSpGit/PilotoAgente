import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : null;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '')
    : queryToken;

  if (!token) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  try {
    req.user = jwt.verify(token, env.jwtAccessSecret);
    return next();
  } catch {
    return res.status(401).json({ message: 'Token invalido' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = normalizeRole(req.user?.role);
    const normalizedAllowedRoles = allowedRoles.map((role) => normalizeRole(role));
    const debugPath = req.originalUrl || req.path || '';
    const isScannerRoute =
      debugPath.includes('/products/scan/') ||
      debugPath.includes('/products/manual-from-scan') ||
      debugPath.includes('/caja/sales') ||
      debugPath.includes('/caja/live-state') ||
      debugPath.includes('/caja/stream') ||
      debugPath.includes('/caja/objetivos');
    const scannerOverride = isScannerRoute && userRole === 'operario';

    if (scannerOverride) {
      return next();
    }

    if (!userRole || !normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    return next();
  };
}
