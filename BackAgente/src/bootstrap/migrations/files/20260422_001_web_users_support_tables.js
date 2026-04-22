async function indexExists(pool, tableName, indexName) {
  const [rows] = await pool.query(
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

export const migration = {
  key: '20260422_001_web_users_support_tables',
  description: 'Crear tablas de soporte para usuarios web (perfil, eventos y puntos)',
  async up({ pool }) {
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

    const hasOrderDeliveryPointsIndex = await indexExists(pool, 'ops_web_puntos_movimientos', 'idx_web_puntos_user_order_type');
    if (!hasOrderDeliveryPointsIndex) {
      await pool.query(`
        ALTER TABLE ops_web_puntos_movimientos
        ADD INDEX idx_web_puntos_user_order_type (web_usuario_id, pedido_id, tipo)
      `);
    }
  }
};
