import { pool } from '../../config/db.js';
import { ensureWebUsersTable } from '../webAuth/webAuth.repository.js';

let webUsersSupportTablesPromise = null;

async function withTransaction(work) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function ensureWebUsersSupportTables() {
  if (webUsersSupportTablesPromise) {
    return webUsersSupportTablesPromise;
  }

  webUsersSupportTablesPromise = (async () => {
    await ensureWebUsersTable();
  })();

  try {
    await webUsersSupportTablesPromise;
  } catch (error) {
    webUsersSupportTablesPromise = null;
    throw error;
  }
}

export async function ensureWebUserProfile(webUserId, connection = null) {
  await ensureWebUsersSupportTables();

  const executor = connection || pool;

  await executor.query(
    `
      INSERT INTO ops_web_usuario_perfil (web_usuario_id)
      VALUES (?)
      ON DUPLICATE KEY UPDATE web_usuario_id = web_usuario_id
    `,
    [webUserId]
  );
}

export async function logWebUserEvent({ webUserId, eventType, metadata = null }, connection = null) {
  await ensureWebUsersSupportTables();

  const executor = connection || pool;

  await executor.query(
    `
      INSERT INTO ops_web_usuario_eventos (web_usuario_id, event_type, metadata_json)
      VALUES (?, ?, ?)
    `,
    [webUserId, eventType, metadata ? JSON.stringify(metadata) : null]
  );
}

export async function trackWebUserLogin(webUserId) {
  await ensureWebUsersSupportTables();

  return withTransaction(async (connection) => {
    await ensureWebUserProfile(webUserId, connection);

    await connection.query(
      `
        UPDATE ops_web_usuario_perfil
        SET
          login_count = login_count + 1,
          last_login_at = NOW()
        WHERE web_usuario_id = ?
      `,
      [webUserId]
    );

    await connection.query(
      `
        UPDATE ops_web_usuarios
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [webUserId]
    );

    await logWebUserEvent({
      webUserId,
      eventType: 'login'
    }, connection);
  });
}

export async function registerWebOrderMetrics({
  webUserId,
  orderId,
  orderTotal,
  awardedPoints = 0
}) {
  await ensureWebUsersSupportTables();

  const safeTotal = Number(Number(orderTotal || 0).toFixed(2));
  const safePoints = Number.isFinite(awardedPoints) ? Math.max(0, Math.floor(awardedPoints)) : 0;

  return withTransaction(async (connection) => {
    await ensureWebUserProfile(webUserId, connection);

    await connection.query(
      `
        UPDATE ops_web_usuario_perfil
        SET
          total_compras = total_compras + 1,
          monto_total_compras = monto_total_compras + ?,
          ultima_compra_at = NOW(),
          puntos_actuales = puntos_actuales + ?,
          puntos_acumulados = puntos_acumulados + ?
        WHERE web_usuario_id = ?
      `,
      [safeTotal, safePoints, safePoints, webUserId]
    );

    if (safePoints > 0) {
      await connection.query(
        `
          INSERT INTO ops_web_puntos_movimientos (
            web_usuario_id,
            pedido_id,
            tipo,
            puntos,
            saldo_posterior,
            motivo
          )
          SELECT
            web_usuario_id,
            ?,
            'acreditacion',
            ?,
            puntos_actuales,
            ?
          FROM ops_web_usuario_perfil
          WHERE web_usuario_id = ?
          LIMIT 1
        `,
        [orderId, safePoints, 'Compra web', webUserId]
      );
    }

    await logWebUserEvent({
      webUserId,
      eventType: 'create_order',
      metadata: {
        orderId,
        total: safeTotal,
        awardedPoints: safePoints
      }
    }, connection);
  });
}

export async function awardWebPointsOnOrderDelivered({
  webUserId,
  orderId,
  orderTotal
}) {
  await ensureWebUsersSupportTables();

  const parsedUserId = Number(webUserId);
  const parsedOrderId = Number(orderId);
  const safeOrderTotal = Number(Number(orderTotal || 0).toFixed(2));
  const basePoints = Math.max(0, Math.floor(safeOrderTotal / 100) * 2);

  if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
    return {
      applied: false,
      reason: 'invalid_user',
      awardedPoints: 0
    };
  }

  if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
    return {
      applied: false,
      reason: 'invalid_order',
      awardedPoints: 0
    };
  }

  return withTransaction(async (connection) => {
    await ensureWebUserProfile(parsedUserId, connection);

    const [existingRows] = await connection.query(
      `
        SELECT id, puntos, saldo_posterior
        FROM ops_web_puntos_movimientos
        WHERE web_usuario_id = ?
          AND pedido_id = ?
          AND tipo = 'acreditacion_entrega'
        LIMIT 1
      `,
      [parsedUserId, parsedOrderId]
    );

    const existing = existingRows[0] || null;
    if (existing) {
      return {
        applied: false,
        reason: 'already_applied',
        awardedPoints: Number(existing.puntos || 0),
        currentPoints: Number(existing.saldo_posterior || 0)
      };
    }

    const [[profileRow]] = await connection.query(
      `
        SELECT puntos_actuales
        FROM ops_web_usuario_perfil
        WHERE web_usuario_id = ?
        LIMIT 1
      `,
      [parsedUserId]
    );

    const currentPoints = Math.max(0, Number(profileRow?.puntos_actuales || 0));
    const availableUntilCap = Math.max(0, 500 - currentPoints);
    const awardedPoints = Math.min(basePoints, availableUntilCap);
    const nextPoints = currentPoints + awardedPoints;

    await connection.query(
      `
        UPDATE ops_web_usuario_perfil
        SET
          puntos_actuales = ?,
          puntos_acumulados = puntos_acumulados + ?
        WHERE web_usuario_id = ?
      `,
      [nextPoints, awardedPoints, parsedUserId]
    );

    const movementReason = awardedPoints > 0
      ? 'Pedido entregado'
      : (basePoints > 0 ? 'Tope de 500 alcanzado' : 'Pedido entregado sin puntos');

    await connection.query(
      `
        INSERT INTO ops_web_puntos_movimientos (
          web_usuario_id,
          pedido_id,
          tipo,
          puntos,
          saldo_posterior,
          motivo
        )
        VALUES (?, ?, 'acreditacion_entrega', ?, ?, ?)
      `,
      [parsedUserId, parsedOrderId, awardedPoints, nextPoints, movementReason]
    );

    await logWebUserEvent({
      webUserId: parsedUserId,
      eventType: 'points_awarded_on_delivery',
      metadata: {
        orderId: parsedOrderId,
        orderTotal: safeOrderTotal,
        awardedPoints,
        basePoints,
        pointsAfter: nextPoints
      }
    }, connection);

    return {
      applied: true,
      reason: 'ok',
      awardedPoints,
      currentPoints: nextPoints
    };
  });
}

export async function getWebUserProfileSnapshot(webUserId) {
  await ensureWebUsersSupportTables();

  const [rows] = await pool.query(
    `
      SELECT
        wu.id AS web_usuario_id,
        wup.telefono,
        wup.direccion_base,
        COALESCE(wup.puntos_actuales, 0) AS puntos_actuales,
        COALESCE(wup.puntos_acumulados, 0) AS puntos_acumulados,
        COALESCE(wup.nivel_fidelidad, 'base') AS nivel_fidelidad,
        COALESCE(wup.total_compras, 0) AS total_compras,
        COALESCE(wup.monto_total_compras, 0) AS monto_total_compras,
        DATE_FORMAT(ultima_compra_at, '%Y-%m-%d %H:%i:%s') AS ultima_compra_at,
        COALESCE(wup.login_count, 0) AS login_count,
        DATE_FORMAT(last_login_at, '%Y-%m-%d %H:%i:%s') AS last_login_at
      FROM ops_web_usuarios wu
      LEFT JOIN ops_web_usuario_perfil wup ON wup.web_usuario_id = wu.id
      WHERE wu.id = ?
      LIMIT 1
    `,
    [webUserId]
  );

  return rows[0] || null;
}

export async function getWebAdminUsersSummary() {
  await ensureWebUsersSupportTables();

  const [[totalsRow]] = await pool.query(
    `
      SELECT
        COUNT(*) AS total_usuarios,
        SUM(CASE WHEN wup.total_compras > 0 THEN 1 ELSE 0 END) AS usuarios_con_compra,
        SUM(CASE WHEN wup.last_login_at >= (NOW() - INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS usuarios_activos_7d,
        COALESCE(SUM(wup.total_compras), 0) AS compras_totales,
        COALESCE(SUM(wup.monto_total_compras), 0) AS monto_total_compras
      FROM ops_web_usuarios wu
      LEFT JOIN ops_web_usuario_perfil wup ON wup.web_usuario_id = wu.id
    `
  );

  const [topLogins] = await pool.query(
    `
      SELECT
        wu.id,
        wu.nombre,
        wu.email,
        wup.login_count,
        DATE_FORMAT(wup.last_login_at, '%Y-%m-%d %H:%i:%s') AS last_login_at
      FROM ops_web_usuarios wu
      LEFT JOIN ops_web_usuario_perfil wup ON wup.web_usuario_id = wu.id
      ORDER BY wup.login_count DESC, wu.id DESC
      LIMIT 5
    `
  );

  const [topCompras] = await pool.query(
    `
      SELECT
        wu.id,
        wu.nombre,
        wu.email,
        wup.total_compras,
        wup.monto_total_compras
      FROM ops_web_usuarios wu
      LEFT JOIN ops_web_usuario_perfil wup ON wup.web_usuario_id = wu.id
      ORDER BY wup.monto_total_compras DESC, wu.id DESC
      LIMIT 5
    `
  );

  return {
    totals: totalsRow,
    top_logins: topLogins,
    top_compras: topCompras
  };
}

export async function listWebUsersForAdmin({ limit = 50 } = {}) {
  await ensureWebUsersSupportTables();

  const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 50)));

  const [rows] = await pool.query(
    `
      SELECT
        wu.id,
        wu.nombre,
        wu.email,
        wu.estado,
        DATE_FORMAT(wu.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(wu.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
        wup.puntos_actuales,
        wup.puntos_acumulados,
        wup.total_compras,
        wup.monto_total_compras,
        wup.login_count,
        DATE_FORMAT(wup.last_login_at, '%Y-%m-%d %H:%i:%s') AS last_login_at
      FROM ops_web_usuarios wu
      LEFT JOIN ops_web_usuario_perfil wup ON wup.web_usuario_id = wu.id
      ORDER BY wu.id DESC
      LIMIT ?
    `,
    [safeLimit]
  );

  return rows;
}

export async function getWebUserAdminDetail(webUserId) {
  await ensureWebUsersSupportTables();

  const [userRows] = await pool.query(
    `
      SELECT
        wu.id,
        wu.nombre,
        wu.email,
        wu.estado,
        DATE_FORMAT(wu.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(wu.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
        wup.telefono,
        wup.direccion_base,
        wup.notas_admin,
        wup.puntos_actuales,
        wup.puntos_acumulados,
        wup.nivel_fidelidad,
        wup.total_compras,
        wup.monto_total_compras,
        DATE_FORMAT(wup.ultima_compra_at, '%Y-%m-%d %H:%i:%s') AS ultima_compra_at,
        wup.login_count,
        DATE_FORMAT(wup.last_login_at, '%Y-%m-%d %H:%i:%s') AS last_login_at
      FROM ops_web_usuarios wu
      LEFT JOIN ops_web_usuario_perfil wup ON wup.web_usuario_id = wu.id
      WHERE wu.id = ?
      LIMIT 1
    `,
    [webUserId]
  );

  const user = userRows[0] || null;

  if (!user) {
    return null;
  }

  const [eventRows] = await pool.query(
    `
      SELECT
        id,
        event_type,
        metadata_json,
        DATE_FORMAT(event_at, '%Y-%m-%d %H:%i:%s') AS event_at
      FROM ops_web_usuario_eventos
      WHERE web_usuario_id = ?
      ORDER BY id DESC
      LIMIT 30
    `,
    [webUserId]
  );

  const [orderRows] = await pool.query(
    `
      SELECT
        id,
        estado,
        notas,
        total_estimado,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_web_pedidos
      WHERE web_usuario_id = ?
      ORDER BY id DESC
      LIMIT 20
    `,
    [webUserId]
  );

  const [pointsRows] = await pool.query(
    `
      SELECT
        id,
        pedido_id,
        tipo,
        puntos,
        saldo_posterior,
        motivo,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM ops_web_puntos_movimientos
      WHERE web_usuario_id = ?
      ORDER BY id DESC
      LIMIT 20
    `,
    [webUserId]
  );

  return {
    user,
    recent_events: eventRows,
    recent_orders: orderRows,
    recent_points: pointsRows
  };
}
