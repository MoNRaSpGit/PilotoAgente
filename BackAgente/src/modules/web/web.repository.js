import { pool } from '../../config/db.js';

function compactCategoryKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function toCategoryDisplayName(rawName = '', compactKey = '') {
  if (compactKey === 'bebidasconalcohol') {
    return 'Bebidas - Con alcohol';
  }
  if (compactKey === 'bebidassinalcohol') {
    return 'Bebidas - Sin alcohol';
  }

  return String(rawName || '')
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

export async function listPublicProducts({ limit = 500, offset = 0, status = 'activo', category = '' } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 500)));
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));
  const safeStatus = String(status || 'activo').trim().toLowerCase() === 'inactivo' ? 'inactivo' : 'activo';
  const rawCategory = String(category || '').trim();
  const normalizedCategory = rawCategory.toLowerCase().replace(/\s+/g, ' ').trim();
  const compactCategory = compactCategoryKey(normalizedCategory);
  const hasCategoryFilter = Boolean(compactCategory);
  const params = [safeStatus];

  let categoryFilterSql = '';
  if (hasCategoryFilter) {
    const [categoryRows] = await pool.query(
      `
        SELECT id
        FROM ops_categoria
        WHERE nombre_compact = ?
           OR nombre_normalized = ?
      `,
      [compactCategory, compactCategory]
    );

    const categoryIds = categoryRows
      .map((row) => Number(row?.id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (categoryIds.length > 0) {
      const placeholders = categoryIds.map(() => '?').join(', ');
      categoryFilterSql = `
        AND (
          p.categoria_id IN (${placeholders})
          OR (
            p.categoria_id IS NULL
            AND p.categoria_compact = ?
          )
        )
      `;
      params.push(...categoryIds, compactCategory);
    } else {
      categoryFilterSql = `
        AND (
          p.categoria_id IS NULL
          AND p.categoria_compact = ?
        )
      `;
      params.push(compactCategory);
    }
  }

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
          WHEN COALESCE(p.tiene_imagen, 0) = 1 THEN 1
          ELSE 0
        END AS has_local_image
      FROM ops_producto p
      LEFT JOIN ops_proveedores s ON s.id = p.supplier_id
      LEFT JOIN ops_categoria c ON c.id = p.categoria_id
      WHERE p.estado = ?
        ${categoryFilterSql}
      ORDER BY p.id DESC
      LIMIT ?
      OFFSET ?
    `,
    [...params, safeLimit, safeOffset]
  );

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    precio_venta: Number(row.precio_venta || 0),
    stock_actual: Number(row.stock_actual || 0),
    categoria: toCategoryDisplayName(row.categoria || '', compactCategoryKey(row.categoria || '')),
    barcode: row.barcode || '',
    barcode_normalized: row.barcode_normalized || '',
    estado: String(row.estado || safeStatus).trim().toLowerCase(),
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
          WHEN COALESCE(p.tiene_imagen, 0) = 1 THEN 1
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
    categoria: toCategoryDisplayName(row.categoria || '', compactCategoryKey(row.categoria || '')),
    barcode: row.barcode || '',
    barcode_normalized: row.barcode_normalized || '',
    estado: String(row.estado || 'inactivo').trim().toLowerCase(),
    supplier_id: row.supplier_id || null,
    supplier_name: row.supplier_name || null,
    has_local_image: Boolean(Number(row.has_local_image || 0))
  }));
}

export async function countPublicInactiveProducts() {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM ops_producto p
      WHERE p.estado = 'inactivo'
    `
  );

  return Number(rows?.[0]?.total || 0);
}

export async function listPublicCategories({ status = 'activo' } = {}) {
  const safeStatus = String(status || 'activo').trim().toLowerCase() === 'inactivo' ? 'inactivo' : 'activo';

  const [rows] = await pool.query(
    `
      SELECT
        category_key,
        MIN(category_name) AS category_name,
        SUM(product_count) AS product_count
      FROM (
        SELECT
          COALESCE(c.nombre_compact, c.nombre_normalized) AS category_key,
          TRIM(COALESCE(c.nombre, p.categoria)) AS category_name,
          COUNT(*) AS product_count
        FROM ops_producto p
        INNER JOIN ops_categoria c ON c.id = p.categoria_id
        WHERE p.estado = ?
          AND c.estado = 'activo'
          AND COALESCE(TRIM(COALESCE(c.nombre, p.categoria)), '') <> ''
        GROUP BY category_key, category_name

        UNION ALL

        SELECT
          p.categoria_compact AS category_key,
          TRIM(COALESCE(p.categoria, '')) AS category_name,
          COUNT(*) AS product_count
        FROM ops_producto p
        WHERE p.estado = ?
          AND p.categoria_id IS NULL
          AND COALESCE(TRIM(COALESCE(p.categoria, '')), '') <> ''
        GROUP BY category_key, category_name
      ) category_source
      WHERE category_key <> ''
      GROUP BY category_key
      ORDER BY product_count DESC, category_name ASC
    `,
    [safeStatus, safeStatus]
  );

  return rows
    .map((row) => {
      const key = compactCategoryKey(row?.category_key || '');
      const display = toCategoryDisplayName(row?.category_name || '', key);
      return display;
    })
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

export async function findWebAdminProductById(productId) {
  const parsedProductId = Number(productId);
  if (!Number.isFinite(parsedProductId) || parsedProductId <= 0) {
    return null;
  }

  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.nombre,
        p.precio_venta,
        COALESCE(c.nombre, p.categoria) AS categoria,
        p.estado,
        p.tiene_imagen,
        CASE
          WHEN COALESCE(p.tiene_imagen, 0) = 1 THEN 1
          ELSE 0
        END AS has_local_image
      FROM ops_producto p
      LEFT JOIN ops_categoria c ON c.id = p.categoria_id
      WHERE p.id = ?
      LIMIT 1
    `,
    [parsedProductId]
  );

  return rows[0] || null;
}

export async function updateWebAdminProductById({
  productId,
  nombre,
  precioVenta,
  categoria,
  estado,
  imagenValue,
  hasImagenValue = false,
  tieneImagen
}) {
  const updates = [];
  const params = [];

  if (typeof nombre === 'string') {
    updates.push('nombre = ?');
    params.push(nombre);
  }

  if (typeof precioVenta === 'number') {
    updates.push('precio_venta = ?');
    params.push(precioVenta);
  }

  if (typeof estado === 'string') {
    updates.push('estado = ?');
    params.push(estado);
  }

  if (typeof categoria === 'string') {
    updates.push('categoria = ?');
    updates.push('categoria_compact = ?');
    updates.push('categoria_id = NULL');
    params.push(categoria);
    params.push(compactCategoryKey(categoria));
  }

  if (typeof tieneImagen === 'number') {
    updates.push('tiene_imagen = ?');
    params.push(tieneImagen);
  }

  if (hasImagenValue) {
    updates.push('imagen = ?');
    params.push(imagenValue);
  }

  if (updates.length === 0) {
    return null;
  }

  params.push(productId);

  const [result] = await pool.query(
    `
      UPDATE ops_producto
      SET ${updates.join(', ')}
      WHERE id = ?
    `,
    params
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findWebAdminProductById(productId);
}
