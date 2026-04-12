import { pool } from '../../config/db.js';
import { ensureCashboxTables } from '../caja/caja.repository.js';

const BUSINESS_TIMEZONE = 'America/Montevideo';
const BUSINESS_UTC_OFFSET = '-03:00';

function formatBusinessDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function addDays(dateString, days) {
  const baseDate = new Date(`${dateString}T00:00:00Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + days);
  return baseDate.toISOString().slice(0, 10);
}

function businessDateTimeToUtcString(dateString, timeString = '00:00:00') {
  const parsed = new Date(`${dateString}T${timeString}${BUSINESS_UTC_OFFSET}`);

  if (Number.isNaN(parsed.getTime())) {
    return `${dateString} ${timeString}`;
  }

  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}

export async function listTopSoldProducts({ limit = 5 } = {}) {
  await ensureCashboxTables();

  const hasLimit = Number.isFinite(Number(limit)) && Number(limit) > 0;
  const safeLimit = hasLimit ? Math.floor(Number(limit)) : null;
  const selectedDate = formatBusinessDate(new Date());
  const endDateExclusive = addDays(selectedDate, 1);
  const startUtc = businessDateTimeToUtcString(selectedDate, '00:00:00');
  const endUtc = businessDateTimeToUtcString(endDateExclusive, '00:00:00');

  const sql = `
      SELECT
        COALESCE(NULLIF(TRIM(pn.nombre), ''), NULLIF(TRIM(pb.nombre), ''), ranked.fallback_product_name) AS product_name,
        COALESCE(
          NULLIF(TRIM(pn.barcode), ''),
          NULLIF(TRIM(pn.barcode_normalized), ''),
          NULLIF(TRIM(pb.barcode), ''),
          ranked.barcode_value
        ) AS barcode,
        ranked.total_quantity,
        ranked.total_sales,
        ranked.movements_count,
        COALESCE(pn.imagen, pb.imagen) AS product_image,
        COALESCE(pn.tiene_imagen, pb.tiene_imagen, 0) AS has_image
      FROM (
        SELECT
          LOWER(TRIM(i.barcode)) AS barcode_key,
          MAX(COALESCE(NULLIF(TRIM(i.barcode), ''), NULL)) AS barcode_value,
          MAX(COALESCE(NULLIF(TRIM(i.product_name), ''), 'Producto')) AS fallback_product_name,
          SUM(i.quantity) AS total_quantity,
          SUM(i.total) AS total_sales,
          COUNT(DISTINCT i.movement_id) AS movements_count
        FROM ops_caja_movimiento_items i
        INNER JOIN ops_caja_movimientos m ON m.id = i.movement_id
        WHERE m.type = 'sale'
          AND m.created_at >= ?
          AND m.created_at < ?
          AND NULLIF(TRIM(i.barcode), '') IS NOT NULL
          AND LOWER(TRIM(i.barcode)) NOT LIKE 'manual%'
        GROUP BY barcode_key
        ORDER BY total_quantity DESC, total_sales DESC, barcode_key ASC
        ${hasLimit ? 'LIMIT ?' : ''}
      ) ranked
      LEFT JOIN ops_producto pn
        ON pn.barcode_normalized IS NOT NULL
       AND LOWER(TRIM(pn.barcode_normalized)) = ranked.barcode_key
      LEFT JOIN ops_producto pb
        ON pb.barcode IS NOT NULL
       AND LOWER(TRIM(pb.barcode)) = ranked.barcode_key
      ORDER BY ranked.total_quantity DESC, ranked.total_sales DESC, product_name ASC
    `;
  const params = hasLimit ? [startUtc, endUtc, safeLimit] : [startUtc, endUtc];
  const [rows] = await pool.query(sql, params);

  return {
    selected_date: selectedDate,
    range_start: selectedDate,
    range_end: endDateExclusive,
    limit: safeLimit,
    items: rows.map((row, index) => ({
      rank: index + 1,
      product_name: row.product_name || 'Producto',
      barcode: row.barcode || null,
      total_quantity: Number(row.total_quantity || 0),
      total_sales: Number(Number(row.total_sales || 0).toFixed(2)),
      movements_count: Number(row.movements_count || 0),
      product_image: row.product_image || null,
      has_image: Boolean(row.has_image)
    }))
  };
}
