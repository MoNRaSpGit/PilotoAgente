async function columnExists(pool, tableName, columnName) {
  const [rows] = await pool.query(
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
  key: '20260422_002_web_orders_schema',
  description: 'Crear esquema de pedidos web e historial de productos por usuario',
  async up({ pool }) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_web_pedidos (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        web_usuario_id BIGINT NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        cliente_visible TINYINT(1) NOT NULL DEFAULT 1,
        admin_visible TINYINT(1) NOT NULL DEFAULT 1,
        notas VARCHAR(255) NULL,
        payment_method VARCHAR(20) NOT NULL DEFAULT 'efectivo',
        delivery_mode VARCHAR(20) NOT NULL DEFAULT 'pickup',
        total_estimado DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_web_pedidos_estado_fecha (estado, created_at),
        INDEX idx_web_pedidos_usuario_fecha (web_usuario_id, created_at),
        CONSTRAINT fk_web_pedido_usuario
          FOREIGN KEY (web_usuario_id) REFERENCES ops_web_usuarios(id)
          ON DELETE CASCADE
      )
    `);

    const hasClienteVisibleColumn = await columnExists(pool, 'ops_web_pedidos', 'cliente_visible');
    if (!hasClienteVisibleColumn) {
      await pool.query(`
        ALTER TABLE ops_web_pedidos
        ADD COLUMN cliente_visible TINYINT(1) NOT NULL DEFAULT 1 AFTER estado
      `);
    }

    const hasAdminVisibleColumn = await columnExists(pool, 'ops_web_pedidos', 'admin_visible');
    if (!hasAdminVisibleColumn) {
      await pool.query(`
        ALTER TABLE ops_web_pedidos
        ADD COLUMN admin_visible TINYINT(1) NOT NULL DEFAULT 1 AFTER cliente_visible
      `);
    }

    const hasPaymentMethodColumn = await columnExists(pool, 'ops_web_pedidos', 'payment_method');
    if (!hasPaymentMethodColumn) {
      await pool.query(`
        ALTER TABLE ops_web_pedidos
        ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'efectivo' AFTER notas
      `);
    }

    const hasDeliveryModeColumn = await columnExists(pool, 'ops_web_pedidos', 'delivery_mode');
    if (!hasDeliveryModeColumn) {
      await pool.query(`
        ALTER TABLE ops_web_pedidos
        ADD COLUMN delivery_mode VARCHAR(20) NOT NULL DEFAULT 'pickup' AFTER payment_method
      `);
    }

    const hasEstadoIdIndex = await indexExists(pool, 'ops_web_pedidos', 'idx_web_pedidos_estado_id');
    if (!hasEstadoIdIndex) {
      await pool.query(`
        ALTER TABLE ops_web_pedidos
        ADD INDEX idx_web_pedidos_estado_id (estado, id)
      `);
    }

    const hasUsuarioIdIndex = await indexExists(pool, 'ops_web_pedidos', 'idx_web_pedidos_usuario_id');
    if (!hasUsuarioIdIndex) {
      await pool.query(`
        ALTER TABLE ops_web_pedidos
        ADD INDEX idx_web_pedidos_usuario_id (web_usuario_id, id)
      `);
    }

    const hasUsuarioVisibleIdIndex = await indexExists(pool, 'ops_web_pedidos', 'idx_web_pedidos_usuario_visible_id');
    if (!hasUsuarioVisibleIdIndex) {
      await pool.query(`
        ALTER TABLE ops_web_pedidos
        ADD INDEX idx_web_pedidos_usuario_visible_id (web_usuario_id, cliente_visible, id)
      `);
    }

    const hasAdminVisibleEstadoIdIndex = await indexExists(pool, 'ops_web_pedidos', 'idx_web_pedidos_admin_visible_estado_id');
    if (!hasAdminVisibleEstadoIdIndex) {
      await pool.query(`
        ALTER TABLE ops_web_pedidos
        ADD INDEX idx_web_pedidos_admin_visible_estado_id (admin_visible, estado, id)
      `);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_web_pedido_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        pedido_id BIGINT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(190) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        line_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_web_pedido_items_pedido (pedido_id),
        INDEX idx_web_pedido_items_product (product_id),
        CONSTRAINT fk_web_pedido_item_pedido
          FOREIGN KEY (pedido_id) REFERENCES ops_web_pedidos(id)
          ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_web_usuario_producto_historial (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        web_usuario_id BIGINT NOT NULL,
        product_id BIGINT NOT NULL,
        times_ordered INT NOT NULL DEFAULT 0,
        quantity_total INT NOT NULL DEFAULT 0,
        last_unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        last_order_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_web_usuario_producto_historial (web_usuario_id, product_id),
        INDEX idx_web_historial_user_rank (web_usuario_id, times_ordered, quantity_total, last_order_at),
        INDEX idx_web_historial_product (product_id),
        CONSTRAINT fk_web_historial_usuario
          FOREIGN KEY (web_usuario_id) REFERENCES ops_web_usuarios(id)
          ON DELETE CASCADE
      )
    `);
  }
};
