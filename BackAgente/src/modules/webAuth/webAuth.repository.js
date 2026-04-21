import crypto from 'crypto';
import { pool } from '../../config/db.js';
import { env } from '../../config/env.js';
import { normalizeWebUserName } from './webAuth.identity.js';

let webUsersTablePromise = null;
let webSeedPromise = null;

function isRetryableConnectionError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  if (code === 'PROTOCOL_CONNECTION_LOST' || code === 'ECONNRESET' || code === 'EPIPE') {
    return true;
  }
  return (
    message.includes('connection is in closed state')
    || message.includes('cannot enqueue query after invoking quit')
    || message.includes('connection lost')
    || message.includes('read econnreset')
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryWithRetry(sql, params = [], attempt = 0) {
  try {
    return await pool.query(sql, params);
  } catch (error) {
    if (attempt < 1 && isRetryableConnectionError(error)) {
      await wait(120);
      return queryWithRetry(sql, params, attempt + 1);
    }
    throw error;
  }
}
function getSeedWebUsers() {
  const adminName = String(env.webDefaultAdminName || 'admin').trim();
  const adminPassword = String(env.webDefaultAdminPassword || 'Admin321!').trim();

  const users = [
    {
      nombre: 'demo.web',
      email: 'demo.web@web.local',
      password: 'Demo123!',
      role: 'cliente'
    },
    {
      nombre: adminName || 'admin',
      email: `${(adminName || 'admin').toLowerCase().replace(/\s+/g, '.')}@web.local`,
      password: adminPassword || 'Admin321!',
      role: 'admin'
    },
    {
      nombre: 'Wadmin',
      email: 'wadmin@web.local',
      password: 'Wadmin321!',
      role: 'admin'
    },
    {
      nombre: 'Rodolfo',
      email: 'rodolfo@web.local',
      password: 'Rodolfo321!',
      role: 'admin'
    }
  ];

  const uniqueByName = new Map();
  for (const user of users) {
    const normalizedName = normalizeWebUserName(user.nombre);
    if (!normalizedName) {
      continue;
    }
    uniqueByName.set(normalizedName, user);
  }

  return Array.from(uniqueByName.values());
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), String(salt), 64).toString('hex');
}

async function columnExists(tableName, columnName) {
  const [rows] = await queryWithRetry(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName]
  );

  return Boolean(rows[0]?.count);
}

async function indexExists(tableName, indexName) {
  const [rows] = await queryWithRetry(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [tableName, indexName]
  );

  return Boolean(rows[0]?.count);
}

export async function ensureWebUsersTable() {
  if (webUsersTablePromise) {
    return webUsersTablePromise;
  }

  webUsersTablePromise = queryWithRetry(`
    CREATE TABLE IF NOT EXISTS ops_web_usuarios (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(140) NOT NULL,
      nombre_normalized VARCHAR(140) NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      role VARCHAR(30) NOT NULL DEFAULT 'cliente',
      password_salt VARCHAR(128) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'activo',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_web_usuarios_estado (estado),
      UNIQUE KEY uniq_web_usuarios_nombre_normalized (nombre_normalized)
    )
  `);

  try {
    await webUsersTablePromise;

    const hasNormalizedName = await columnExists('ops_web_usuarios', 'nombre_normalized');
    if (!hasNormalizedName) {
      await queryWithRetry(`
        ALTER TABLE ops_web_usuarios
        ADD COLUMN nombre_normalized VARCHAR(140) NULL AFTER nombre
      `);
    }

    const hasRoleColumn = await columnExists('ops_web_usuarios', 'role');
    if (!hasRoleColumn) {
      await queryWithRetry(`
        ALTER TABLE ops_web_usuarios
        ADD COLUMN role VARCHAR(30) NOT NULL DEFAULT 'cliente' AFTER email
      `);
    }

    await queryWithRetry(`
      UPDATE ops_web_usuarios
      SET nombre_normalized = LOWER(TRIM(nombre))
      WHERE nombre_normalized IS NULL OR nombre_normalized = ''
    `);

    const hasNormalizedIndex = await indexExists('ops_web_usuarios', 'uniq_web_usuarios_nombre_normalized');
    if (!hasNormalizedIndex) {
      await queryWithRetry(`
        ALTER TABLE ops_web_usuarios
        ADD UNIQUE KEY uniq_web_usuarios_nombre_normalized (nombre_normalized)
      `);
    }
  } catch (error) {
    webUsersTablePromise = null;
    throw error;
  }
}

export async function findWebUserByEmail(email) {
  await ensureWebUsersTable();

  const [rows] = await queryWithRetry(
    `
      SELECT id, nombre, email, role, password_salt, password_hash, estado
      FROM ops_web_usuarios
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );

  return rows[0] || null;
}

export async function findWebUserByName(nombre) {
  await ensureWebUsersTable();
  const normalizedName = normalizeWebUserName(nombre);

  const [rows] = await queryWithRetry(
    `
      SELECT id, nombre, email, role, password_salt, password_hash, estado
      FROM ops_web_usuarios
      WHERE nombre_normalized = ?
      LIMIT 1
    `,
    [normalizedName]
  );

  return rows[0] || null;
}

export async function findWebUserById(id) {
  await ensureWebUsersTable();

  const [rows] = await queryWithRetry(
    `
      SELECT id, nombre, email, role, estado
      FROM ops_web_usuarios
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

export async function createWebUser({ nombre, email, password, role = 'cliente' }) {
  await ensureWebUsersTable();

  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  const normalizedName = normalizeWebUserName(nombre);

  const [result] = await queryWithRetry(
    `
      INSERT INTO ops_web_usuarios (nombre, nombre_normalized, email, role, password_salt, password_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [nombre, normalizedName, email, role, salt, hash]
  );

  return findWebUserById(result.insertId);
}

export async function seedDemoWebUsers() {
  if (webSeedPromise) {
    return webSeedPromise;
  }

  webSeedPromise = (async () => {
  await ensureWebUsersTable();

  for (const user of getSeedWebUsers()) {
    const salt = generateSalt();
    const hash = hashPassword(user.password, salt);
    const normalizedName = normalizeWebUserName(user.nombre);

    await queryWithRetry(
      `
        INSERT INTO ops_web_usuarios (
          nombre,
          nombre_normalized,
          email,
          role,
          password_salt,
          password_hash,
          estado
        )
        VALUES (?, ?, ?, ?, ?, ?, 'activo')
        ON DUPLICATE KEY UPDATE
          nombre = VALUES(nombre),
          nombre_normalized = VALUES(nombre_normalized),
          email = VALUES(email),
          role = VALUES(role),
          password_salt = VALUES(password_salt),
          password_hash = VALUES(password_hash),
          estado = 'activo'
      `,
      [
        user.nombre,
        normalizedName,
        user.email,
        user.role || 'cliente',
        salt,
        hash
      ]
    );
  }
  })();

  try {
    await webSeedPromise;
  } catch (error) {
    webSeedPromise = null;
    throw error;
  }
}

export function verifyWebUserPassword(password, userRow) {
  const computedHash = hashPassword(password, userRow.password_salt);
  const computedBuffer = Buffer.from(computedHash, 'hex');
  const expectedBuffer = Buffer.from(userRow.password_hash || '', 'hex');

  if (computedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(computedBuffer, expectedBuffer);
}
