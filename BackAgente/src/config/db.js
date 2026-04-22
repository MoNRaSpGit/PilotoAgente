import mysql from 'mysql2/promise';
import { env } from './env.js';
import { addDbTiming } from '../observability/telemetry.js';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 20
});

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function wrapTimedQuery(target, methodName) {
  const original = target[methodName];
  if (typeof original !== 'function') {
    return;
  }

  target[methodName] = async function wrappedTimedQuery(...args) {
    const sql = args?.[0];
    const startedAt = nowMs();
    try {
      return await original.apply(this, args);
    } finally {
      const durationMs = nowMs() - startedAt;
      addDbTiming({ durationMs, sql });
    }
  };
}

function decorateConnection(connection) {
  if (!connection || connection.__obsWrapped) {
    return connection;
  }

  wrapTimedQuery(connection, 'query');
  wrapTimedQuery(connection, 'execute');
  Object.defineProperty(connection, '__obsWrapped', {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false
  });
  return connection;
}

wrapTimedQuery(pool, 'query');
wrapTimedQuery(pool, 'execute');

const originalGetConnection = pool.getConnection.bind(pool);
pool.getConnection = async function wrappedGetConnection(...args) {
  const connection = await originalGetConnection(...args);
  return decorateConnection(connection);
};

pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

export async function checkDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    return true;
  } catch {
    return false;
  }
}
