export const migration = {
  key: '20260424_006_push_subscriptions_table',
  async up({ pool }) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_push_subscriptions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        endpoint_hash CHAR(64) NOT NULL UNIQUE,
        endpoint VARCHAR(1024) NOT NULL,
        p256dh VARCHAR(255) NOT NULL,
        auth VARCHAR(255) NOT NULL,
        user_id INT NOT NULL,
        user_role VARCHAR(20) NOT NULL,
        source_app VARCHAR(50) NOT NULL DEFAULT 'frontagente',
        user_agent VARCHAR(255) NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_push_subscriptions_user_active (user_id, active),
        INDEX idx_push_subscriptions_role_active (user_role, active)
      )
    `);
  }
};
