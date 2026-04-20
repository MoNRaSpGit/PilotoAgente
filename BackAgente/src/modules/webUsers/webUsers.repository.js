import { pool } from '../../config/db.js';

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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_web_usuario_perfil (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        web_usuario_id BIGINT NOT NULL,
        telefono VARCHAR(40) NULL,
        direccion_base VARCHAR(255) NULL,
        notas_admin VARCHAR(255) NULL,
        puntos_actuales INT NOT NULL DEFAULT 0,
        puntos_acumulados INT NOT NULL DEFAULT 0,
        nivel_fidelidad VARCHAR(20) NOT NULL DEFAULT 'base',
        total_compras INT NOT NULL DEFAULT 0,
        monto_total_compras DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        ultima_compra_at DATETIME NULL,
        login_count INT NOT NULL DEFAULT 0,
        last_login_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_web_usuario_perfil_usuario (web_usuario_id),
        INDEX idx_web_usuario_perfil_puntos (puntos_actuales),
        INDEX idx_web_usuario_perfil_login (last_login_at),
        CONSTRAINT fk_web_usuario_perfil_usuario
          FOREIGN KEY (web_usuario_id) REFERENCES ops_web_usuarios(id)
          ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_web_usuario_eventos (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        web_usuario_id BIGINT NOT NULL,
        event_type VARCHAR(40) NOT NULL,
        metadata_json LONGTEXT NULL,
        event_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_web_usuario_eventos_user_date (web_usuario_id, event_at),
        INDEX idx_web_usuario_eventos_type_date (event_type, event_at),
        CONSTRAINT fk_web_usuario_eventos_usuario
          FOREIGN KEY (web_usuario_id) REFERENCES ops_web_usuarios(id)
          ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_web_puntos_movimientos (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        web_usuario_id BIGINT NOT NULL,
        pedido_id BIGINT NULL,
        tipo VARCHAR(20) NOT NULL,
        puntos INT NOT NULL,
        saldo_posterior INT NOT NULL,
        motivo VARCHAR(120) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_web_puntos_user_date (web_usuario_id, created_at),
        INDEX idx_web_puntos_pedido (pedido_id),
        CONSTRAINT fk_web_puntos_usuario
          FOREIGN KEY (web_usuario_id) REFERENCES ops_web_usuarios(id)
          ON DELETE CASCADE
      )
    `);
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

    const [rows] = await connection.query(
      `
        SELECT puntos_actuales
        FROM ops_web_usuario_perfil
        WHERE web_usuario_id = ?
        LIMIT 1
      `,
      [webUserId]
    );

    const saldoPosterior = Number(rows[0]?.puntos_actuales || 0);

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
          VALUES (?, ?, 'acreditacion', ?, ?, ?)
        `,
        [webUserId, orderId, safePoints, saldoPosterior, 'Compra web']
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

export async function getWebUserProfileSnapshot(webUserId) {
  await ensureWebUsersSupportTables();

  await ensureWebUserProfile(webUserId);

  const [rows] = await pool.query(
    `
      SELECT
        web_usuario_id,
        telefono,
        direccion_base,
        puntos_actuales,
        puntos_acumulados,
        nivel_fidelidad,
        total_compras,
        monto_total_compras,
        DATE_FORMAT(ultima_compra_at, '%Y-%m-%d %H:%i:%s') AS ultima_compra_at,
        login_count,
        DATE_FORMAT(last_login_at, '%Y-%m-%d %H:%i:%s') AS last_login_at
      FROM ops_web_usuario_perfil
      WHERE web_usuario_id = ?
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