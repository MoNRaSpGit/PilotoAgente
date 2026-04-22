import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import {
  createWebUser,
  findWebUserByName,
  verifyWebUserPassword
} from './webAuth.repository.js';
import { ensureWebUserProfile, logWebUserEvent, trackWebUserLogin } from '../webUsers/webUsers.repository.js';
import { warmWebCatalogCache } from '../web/web.service.js';
import { parseLoginWebUserPayload, parseRegisterWebUserPayload } from './webAuth.contract.js';

function createServiceError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeWebUser(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    role: row.role || 'cliente',
    estado: row.estado
  };
}

function createWebToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role || 'cliente',
      type: 'web_user'
    },
    env.webJwtAccessSecret,
    { expiresIn: env.webAccessTokenTtl }
  );
}

export async function registerWebUser(payload = {}) {
  const { nombre, password } = parseRegisterWebUserPayload(payload);

  const existing = await findWebUserByName(nombre);
  if (existing) {
    throw createServiceError('Ya existe un usuario web con ese nombre', 409);
  }

  const syntheticEmail = `${nombre.toLowerCase().replace(/\s+/g, '.')}+${Date.now()}@web.local`;
  const createdUser = await createWebUser({ nombre, email: syntheticEmail, password, role: 'cliente' });
  await ensureWebUserProfile(createdUser.id);
  await logWebUserEvent({
    webUserId: createdUser.id,
    eventType: 'register'
  });

  const user = normalizeWebUser(createdUser);
  const token = createWebToken(user);

  return { token, user, profile: null };
}

export async function loginWebUser(payload = {}) {
  const { nombre, password } = parseLoginWebUserPayload(payload);

  const userRow = await findWebUserByName(nombre);

  if (!userRow || userRow.estado !== 'activo' || !verifyWebUserPassword(password, userRow)) {
    throw createServiceError('Credenciales invalidas', 401);
  }

  const user = normalizeWebUser(userRow);
  // Login tracking is non-blocking to keep auth response fast.
  trackWebUserLogin(user.id).catch(() => {});
  // Warm web catalog caches in background to improve first screen after login.
  warmWebCatalogCache().catch(() => {});
  const token = createWebToken(user);

  return { token, user, profile: null };
}
