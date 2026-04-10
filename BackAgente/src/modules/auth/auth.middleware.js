import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

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
    if (process.env.NODE_ENV !== 'production') {
      console.log('[auth:verified]', {
        path: req.path,
        role: req.user?.role || null,
        email: req.user?.email || null,
        method: req.method,
        url: req.originalUrl
      });
    }
    return next();
  } catch (_error) {
    return res.status(401).json({ message: 'Token invalido' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    const debugPath = req.originalUrl || req.path || '';
    const isScannerRoute =
      debugPath.includes('/products/scan/') ||
      debugPath.includes('/products/manual-from-scan') ||
      debugPath.includes('/caja/sales') ||
      debugPath.includes('/caja/live-state');
    const scannerOverride = isScannerRoute && userRole === 'operario';

    if (process.env.NODE_ENV !== 'production') {
      console.log('[auth:role-check]', {
        path: req.path,
        url: req.originalUrl,
        user_role: userRole || null,
        allowed_roles: allowedRoles,
        scanner_override: scannerOverride,
        email: req.user?.email || null
      });
    }

    if (scannerOverride) {
      return next();
    }

    if (!userRole || !allowedRoles.includes(userRole)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth:forbidden]', {
          path: req.path,
          user_role: userRole || null,
          allowed_roles: allowedRoles,
          email: req.user?.email || null
        });
      }
      return res.status(403).json({ message: 'No autorizado' });
    }

    return next();
  };
}
