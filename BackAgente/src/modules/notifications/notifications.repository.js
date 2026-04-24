import crypto from 'node:crypto';
import { pool } from '../../config/db.js';

function hashEndpoint(endpoint = '') {
  return crypto.createHash('sha256').update(String(endpoint)).digest('hex');
}

export async function upsertPushSubscription({
  endpoint,
  p256dh,
  auth,
  userId,
  userRole,
  sourceApp = 'frontagente',
  userAgent = ''
}) {
  const endpointHash = hashEndpoint(endpoint);
  await pool.query(
    `
      INSERT INTO ops_push_subscriptions (
        endpoint_hash,
        endpoint,
        p256dh,
        auth,
        user_id,
        user_role,
        source_app,
        user_agent,
        active,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
      ON DUPLICATE KEY UPDATE
        endpoint = VALUES(endpoint),
        p256dh = VALUES(p256dh),
        auth = VALUES(auth),
        user_id = VALUES(user_id),
        user_role = VALUES(user_role),
        source_app = VALUES(source_app),
        user_agent = VALUES(user_agent),
        active = 1,
        last_seen_at = NOW(),
        updated_at = CURRENT_TIMESTAMP
    `,
    [endpointHash, endpoint, p256dh, auth, userId, userRole, sourceApp, userAgent || null]
  );
}

export async function deactivatePushSubscriptionByEndpoint(endpoint = '') {
  const endpointHash = hashEndpoint(endpoint);
  const [result] = await pool.query(
    `
      UPDATE ops_push_subscriptions
      SET active = 0
      WHERE endpoint_hash = ?
    `,
    [endpointHash]
  );
  return Number(result?.affectedRows || 0);
}

export async function listActiveOpsPushSubscriptions() {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        endpoint,
        p256dh,
        auth
      FROM ops_push_subscriptions
      WHERE active = 1
        AND user_role IN ('admin', 'operario')
    `
  );

  return rows;
}
