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
  key: '20260422_004_web_products_query_indexes',
  description: 'Agregar indices para acelerar consultas web de productos por estado/categoria',
  async up({ pool }) {
    const hasStatusId = await indexExists(pool, 'ops_producto', 'idx_ops_producto_estado_id');
    if (!hasStatusId) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD INDEX idx_ops_producto_estado_id (estado, id)
      `);
    }

    const hasStatusCategoriaId = await indexExists(pool, 'ops_producto', 'idx_ops_producto_estado_categoria_id');
    if (!hasStatusCategoriaId) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD INDEX idx_ops_producto_estado_categoria_id (estado, categoria_id, id)
      `);
    }

    const hasStatusCategoriaCompactId = await indexExists(pool, 'ops_producto', 'idx_ops_producto_estado_categoria_compact_id');
    if (!hasStatusCategoriaCompactId) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD INDEX idx_ops_producto_estado_categoria_compact_id (estado, categoria_compact, id)
      `);
    }
  }
};

