import { pool } from '../../config/db.js';

function toPublicLocalImageUrl(imageValue) {
  if (!imageValue) {
    return null;
  }

  if (Buffer.isBuffer(imageValue)) {
    return `data:image/jpeg;base64,${imageValue.toString('base64')}`;
  }

  const textValue = String(imageValue).trim();
  if (!textValue) {
    return null;
  }

  if (/^https?:\/\//i.test(textValue) || /^data:image\//i.test(textValue)) {
    return textValue;
  }

  const normalized = textValue.replace(/\s/g, '');
  const looksLikeBase64 = normalized.length > 120 && /^[A-Za-z0-9+/=]+$/.test(normalized);

  if (looksLikeBase64) {
    return `data:image/jpeg;base64,${normalized}`;
  }

  return null;
}

export async function listPublicProducts({ limit = 50, offset = 0, status = 'activo' } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 50)));
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));
  const safeStatus = String(status || 'activo').trim().toLowerCase();
  const whereStatus = safeStatus === 'inactivo'
    ? "LOWER(TRIM(COALESCE(p.estado, ''))) = 'inactivo'"
    : "LOWER(TRIM(COALESCE(p.estado, ''))) = 'activo'";

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
        p.imagen
      FROM ops_producto p
      LEFT JOIN ops_proveedores s ON s.id = p.supplier_id
      LEFT JOIN ops_categoria c ON c.id = p.categoria_id
      WHERE ${whereStatus}
      ORDER BY
        (p.imagen IS NOT NULL AND p.imagen <> '') DESC,
        p.id DESC
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
    estado: row.estado || 'activo',
    supplier_id: row.supplier_id || null,
    supplier_name: row.supplier_name || null,
    image_local_url: toPublicLocalImageUrl(row.imagen),
    has_local_image: Boolean(row.imagen)
  }));
}

export async function listPublicInactiveProducts({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 50)));
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
        p.imagen
      FROM ops_producto p
      LEFT JOIN ops_proveedores s ON s.id = p.supplier_id
      LEFT JOIN ops_categoria c ON c.id = p.categoria_id
      WHERE LOWER(TRIM(COALESCE(p.estado, ''))) = 'inactivo'
      ORDER BY
        (p.imagen IS NOT NULL AND p.imagen <> '') DESC,
        p.id DESC
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
    image_local_url: toPublicLocalImageUrl(row.imagen),
    has_local_image: Boolean(row.imagen)
  }));
}
