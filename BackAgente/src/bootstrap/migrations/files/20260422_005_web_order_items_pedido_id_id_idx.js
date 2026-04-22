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

  return Boolean(rows?.[0]?.count);
}

export const migration = {
  key: '20260422_005_web_order_items_pedido_id_id_idx',
  description: 'Agregar indice compuesto para pedido_items por pedido_id e id',
  async up({ pool }) {
    const hasPedidoIdIdIndex = await indexExists(pool, 'ops_web_pedido_items', 'idx_web_pedido_items_pedido_id_id');
    if (!hasPedidoIdIdIndex) {
      await pool.query(`
        ALTER TABLE ops_web_pedido_items
        ADD INDEX idx_web_pedido_items_pedido_id_id (pedido_id, id)
      `);
    }
  }
};

