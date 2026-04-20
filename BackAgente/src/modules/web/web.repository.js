import { pool } from '../../config/db.js';

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

export async function removeLegacyImageUrlColumns() {
  const hasImageSourceIndex = await indexExists('ops_producto', 'idx_producto_imagen_source');
  if (hasImageSourceIndex) {
    await pool.query(`
      ALTER TABLE ops_producto
      DROP INDEX idx_producto_imagen_source
    `);
  }

  const hasImageSource = await columnExists('ops_producto', 'imagen_source');
  if (hasImageSource) {
    await pool.query(`
      ALTER TABLE ops_producto
      DROP COLUMN imagen_source
    `);
  }

  const hasImagePublicId = await columnExists('ops_producto', 'imagen_public_id');
  if (hasImagePublicId) {
    await pool.query(`
      ALTER TABLE ops_producto
      DROP COLUMN imagen_public_id
    `);
  }

  const hasImageUrl = await columnExists('ops_producto', 'imagen_url');
  if (hasImageUrl) {
    await pool.query(`
      ALTER TABLE ops_producto
      DROP COLUMN imagen_url
    `);
  }
}

export async function listPublicProducts({ limit = 500, offset = 0, status = 'activo', category = '' } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 500)));
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));
  const safeStatus = String(status || 'activo').trim().toLowerCase() === 'inactivo' ? 'inactivo' : 'activo';
  const rawCategory = String(category || '').trim();
  const normalizedCategory = rawCategory.toLowerCase().replace(/\s+/g, ' ').trim();
  const hasCategoryFilter = Boolean(normalizedCategory);
  const categoryParams = hasCategoryFilter
    ? [normalizedCategory, normalizedCategory]
    : [null, null];

  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.nombre,
        p.precio_venta,
        COALESCE(p.stock_actual, 0) AS stock_actual,
        COALESCE(c.nombre, p.categoria) AS categoria,
        p.barcode,
        p.barcode_normalized,
        p.estado,
        p.supplier_id,
        s.nombre AS supplier_name,
        CASE
          WHEN p.imagen IS NOT NULL AND p.imagen <> '' THEN 1
          ELSE 0
        END AS has_local_image
      FROM ops_producto p
      LEFT JOIN ops_proveedores s ON s.id = p.supplier_id
      LEFT JOIN ops_categoria c ON c.id = p.categoria_id
      WHERE p.estado = ?
        AND (
          ? IS NULL
          OR c.nombre_normalized = ?
          OR (
            p.categoria_id IS NULL
            AND LOWER(TRIM(COALESCE(p.categoria, ''))) = ?
          )
        )
      ORDER BY p.id DESC
      LIMIT ?
      OFFSET ?
    `,
    [safeStatus, normalizedCategory || null, ...categoryParams, safeLimit, safeOffset]
  );

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    precio_venta: Number(row.precio_venta || 0),
    stock_actual: Number(row.stock_actual || 0),
    categoria: row.categoria || '',
    barcode: row.barcode || '',
    barcode_normalized: row.barcode_normalized || '',
    estado: row.estado || 'activo',
    supplier_id: row.supplier_id || null,
    supplier_name: row.supplier_name || null,
    has_local_image: Boolean(Number(row.has_local_image || 0))
  }));
}

export async function listPublicInactiveProducts({ limit = 500, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 500)));
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));

  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.nombre,
        p.precio_venta,
        COALESCE(p.stock_actual, 0) AS stock_actual,
        COALESCE(c.nombre, p.categoria) AS categoria,
        p.barcode,
        p.barcode_normalized,
        p.estado,
        p.supplier_id,
        s.nombre AS supplier_name,
        CASE
          WHEN p.imagen IS NOT NULL AND p.imagen <> '' THEN 1
          ELSE 0
        END AS has_local_image
      FROM ops_producto p
      LEFT JOIN ops_proveedores s ON s.id = p.supplier_id
      LEFT JOIN ops_categoria c ON c.id = p.categoria_id
      WHERE p.estado = 'inactivo'
      ORDER BY p.id DESC
      LIMIT ?
      OFFSET ?
    `,
    [safeLimit, safeOffset]
  );

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    precio_venta: Number(row.precio_venta || 0),
    stock_actual: Number(row.stock_actual || 0),
    categoria: row.categoria || '',
    barcode: row.barcode || '',
    barcode_normalized: row.barcode_normalized || '',
    estado: row.estado || 'inactivo',
    supplier_id: row.supplier_id || null,
    supplier_name: row.supplier_name || null,
    has_local_image: Boolean(Number(row.has_local_image || 0))
  }));
}

export async function listPublicCategories({ status = 'activo' } = {}) {
  const safeStatus = String(status || 'activo').trim().toLowerCase() === 'inactivo' ? 'inactivo' : 'activo';

  const [rows] = await pool.query(
    `
      SELECT DISTINCT
        TRIM(COALESCE(c.nombre, p.categoria)) AS category_name
      FROM ops_producto p
      LEFT JOIN ops_categoria c ON c.id = p.categoria_id
      WHERE p.estado = ?
        AND COALESCE(TRIM(COALESCE(c.nombre, p.categoria)), '') <> ''
      ORDER BY category_name ASC
    `,
    [safeStatus]
  );

  return rows
    .map((row) => String(row?.category_name || '').trim())
    .filter(Boolean);
}

export async function findPublicProductImageById(productId) {
  const parsedProductId = Number(productId);
  if (!Number.isFinite(parsedProductId) || parsedProductId <= 0) {
    return null;
  }

  const [rows] = await pool.query(
    `
      SELECT
        id,
        imagen,
        tiene_imagen
      FROM ops_producto
      WHERE id = ?
      LIMIT 1
    `,
    [parsedProductId]
  );

  return rows[0] || null;
}
