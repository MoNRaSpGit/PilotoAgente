import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../config/env.js';
import { findUserByEmail } from './auth.repository.js';
import { verifyPassword } from './password.utils.js';

function buildAuthUser(userRow) {
  return {
    id: userRow.id,
    name: userRow.nombre,
    email: userRow.email,
    role: String(userRow.role || '').trim().toLowerCase()
  };
}

export async function loginWithCredentials(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');

  if (!normalizedEmail || !normalizedPassword) {
    const error = new Error('Credenciales invalidas');
    error.status = 401;
    throw error;
  }

  const userRow = await findUserByEmail(normalizedEmail);

  if (!userRow || userRow.estado !== 'activo') {
    const error = new Error('Credenciales invalidas');
    error.status = 401;
    throw error;
  }

  if (!verifyPassword(normalizedPassword, userRow.password_salt, userRow.password_hash)) {
    const error = new Error('Credenciales invalidas');
    error.status = 401;
    throw error;
  }

  const user = buildAuthUser(userRow);
  const token = jwt.sign(user, env.jwtAccessSecret, { expiresIn: env.accessTokenTtl });

  return { token, user };
}

export function createDemoPasswordHash(password, salt = 'agente-demo-salt') {
  return crypto.scryptSync(String(password), String(salt), 64).toString('hex');
}
