import { isValidWebUserName, sanitizeWebDisplayName } from './webAuth.identity.js';
import { validateWebPassword } from './webAuth.passwordPolicy.js';

function createContractError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function parseRegisterWebUserPayload(payload = {}) {
  const nombre = sanitizeWebDisplayName(payload?.nombre || '');
  const password = String(payload?.password || '');

  if (!nombre || !password) {
    throw createContractError('Nombre y password son requeridos', 400);
  }

  if (nombre.length < 3) {
    throw createContractError('El nombre debe tener al menos 3 caracteres', 400);
  }

  if (!isValidWebUserName(nombre)) {
    throw createContractError('El nombre tiene formato invalido', 400);
  }

  const passwordPolicy = validateWebPassword(password, nombre);
  if (!passwordPolicy.isValid) {
    throw createContractError(
      'La password debe tener 8+ caracteres, mayuscula, minuscula, numero y simbolo',
      400
    );
  }

  return {
    nombre,
    password
  };
}

export function parseLoginWebUserPayload(payload = {}) {
  const nombre = sanitizeWebDisplayName(payload?.nombre || '');
  const password = String(payload?.password || '');

  if (!nombre || !password) {
    throw createContractError('Credenciales invalidas', 401);
  }

  return {
    nombre,
    password
  };
}
