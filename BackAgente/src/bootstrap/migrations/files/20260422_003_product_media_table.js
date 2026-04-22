export const migration = {
  key: '20260422_003_product_media_table',
  description: 'Crear tabla media de productos para thumbs y metadatos de cache',
  async up({ pool }) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_producto_media (
        product_id BIGINT NOT NULL PRIMARY KEY,
        thumb_small LONGBLOB NULL,
        mime_type VARCHAR(60) NULL,
        etag VARCHAR(80) NULL,
        source_hash VARCHAR(80) NULL,
        source_size INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_producto_media_updated_at (updated_at)
      )
    `);
  }
};
