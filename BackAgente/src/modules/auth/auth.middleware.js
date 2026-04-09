import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    req.user = jwt.verify(token, env.jwtAccessSecret);
    return next();
  } catch (_error) {
    return res.status(401).json({ message: 'Token invalido' });
  }
}
