import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export function webAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : null;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '')
    : queryToken;

  if (!token) {
    return res.status(401).json({ message: 'Token web requerido' });
  }

  try {
    const decoded = jwt.verify(token, env.webJwtAccessSecret);

    if (decoded?.type !== 'web_user') {
      return res.status(401).json({ message: 'Token web invalido' });
    }

    req.webUser = {
      id: decoded.sub,
      email: decoded.email,
      nombre: decoded.nombre,
      role: decoded.role || 'cliente'
    };

    return next();
  } catch {
    return res.status(401).json({ message: 'Token web invalido' });
  }
}
