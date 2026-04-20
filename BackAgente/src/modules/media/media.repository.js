import { pool } from '../../config/db.js';

let productImageColumnsPromise = null;

async function columnExists(tableName, columnName) {
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

async function indexExists(tableName, indexName) {
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

export async function ensureProductImageColumns() {
  if (productImageColumnsPromise) {
    return productImageColumnsPromise;
  }

  productImageColumnsPromise = (async () => {
    const hasImageUrl = await columnExists('ops_producto', 'imagen_url');
    if (!hasImageUrl) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD COLUMN imagen_url VARCHAR(500) NULL AFTER imagen
      `);
    }

    const hasImagePublicId = await columnExists('ops_producto', 'imagen_public_id');
    if (!hasImagePublicId) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD COLUMN imagen_public_id VARCHAR(255) NULL AFTER imagen_url
      `);
    }

    const hasImageSource = await columnExists('ops_producto', 'imagen_source');
    if (!hasImageSource) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD COLUMN imagen_source VARCHAR(20) NOT NULL DEFAULT 'local' AFTER imagen_public_id
      `);
    }

    const hasImageSourceIndex = await indexExists('ops_producto', 'idx_producto_imagen_source');
    if (!hasImageSourceIndex) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD INDEX idx_producto_imagen_source (imagen_source)
      `);
    }
  })();

  try {
    await productImageColumnsPromise;
  } catch (error) {
    productImageColumnsPromise = null;
    throw error;
  }
}

export async function listProductsForCloudinaryMigration({ limit = 50, offset = 0 } = {}) {
  await ensureProductImageColumns();

  const safeLimit = Math.max(1, Math.min(300, Math.floor(Number(limit) || 50)));
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));

  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.nombre,
        p.imagen,
        p.tiene_imagen,
        p.imagen_url,
        p.imagen_public_id
      FROM ops_producto p
      WHERE p.estado = 'activo'
        AND COALESCE(p.tiene_imagen, 0) = 1
        AND p.imagen IS NOT NULL
        AND p.imagen <> ''
        AND (p.imagen_url IS NULL OR p.imagen_url = '')
      ORDER BY p.id ASC
      LIMIT ?
      OFFSET ?
    `,
    [safeLimit, safeOffset]
  );

  return rows;
}

export async function updateProductCloudinaryImage({
  productId,
  imageUrl,
  imagePublicId
}) {
  await ensureProductImageColumns();

  await pool.query(
    `
      UPDATE ops_producto
      SET
        imagen_url = ?,
        imagen_public_id = ?,
        imagen_source = 'cloudinary',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [imageUrl, imagePublicId, productId]
  );
}

export async function listProductsForImageBenchmark({ limit = 50, offset = 0 } = {}) {
  await ensureProductImageColumns();

  const safeLimit = Math.max(1, Math.min(300, Math.floor(Number(limit) || 50)));
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));

  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.nombre,
        p.precio_venta,
        p.stock_actual,
        p.categoria,
        p.imagen,
        p.imagen_url
      FROM ops_producto p
      WHERE p.estado = 'activo'
        AND p.imagen_url IS NOT NULL
        AND p.imagen_url <> ''
        AND COALESCE(p.tiene_imagen, 0) = 1
        AND p.imagen IS NOT NULL
        AND p.imagen <> ''
      ORDER BY p.id DESC
      LIMIT ?
      OFFSET ?
    `,
    [safeLimit, safeOffset]
  );

  return rows;
}
