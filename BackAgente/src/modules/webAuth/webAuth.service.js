import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import {
  createWebUser,
  findWebUserByName,
  seedDemoWebUsers,
  verifyWebUserPassword
} from './webAuth.repository.js';
import { ensureWebUserProfile, logWebUserEvent, trackWebUserLogin } from '../webUsers/webUsers.repository.js';
import { validateWebPassword } from './webAuth.passwordPolicy.js';
import { isValidWebUserName, sanitizeWebDisplayName } from './webAuth.identity.js';

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
  await seedDemoWebUsers();

  const nombre = sanitizeWebDisplayName(payload?.nombre || '');
  const password = String(payload?.password || '');

  if (!nombre || !password) {
    throw createServiceError('Nombre y password son requeridos', 400);
  }

  if (nombre.length < 3) {
    throw createServiceError('El nombre debe tener al menos 3 caracteres', 400);
  }

  if (!isValidWebUserName(nombre)) {
    throw createServiceError('El nombre tiene formato invalido', 400);
  }

  const passwordPolicy = validateWebPassword(password, nombre);
  if (!passwordPolicy.isValid) {
    throw createServiceError(
      'La password debe tener 8+ caracteres, mayuscula, minuscula, numero y simbolo',
      400
    );
  }

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
  await seedDemoWebUsers();

  const nombre = sanitizeWebDisplayName(payload?.nombre || '');
  const password = String(payload?.password || '');

  if (!nombre || !password) {
    throw createServiceError('Credenciales invalidas', 401);
  }

  const userRow = await findWebUserByName(nombre);

  if (!userRow || userRow.estado !== 'activo' || !verifyWebUserPassword(password, userRow)) {
    throw createServiceError('Credenciales invalidas', 401);
  }

  const user = normalizeWebUser(userRow);
  // Login tracking is non-blocking to keep auth response fast.
  trackWebUserLogin(user.id).catch(() => {});
  const token = createWebToken(user);

  return { token, user, profile: null };
}
