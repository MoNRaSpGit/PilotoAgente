import { pool } from '../../config/db.js';
import { ensureCashboxTables } from '../caja/caja.repository.js';

export async function listTopSoldProducts({ limit = 5 } = {}) {
  await ensureCashboxTables();

  const hasLimit = Number.isFinite(Number(limit)) && Number(limit) > 0;
  const safeLimit = hasLimit ? Math.floor(Number(limit)) : null;
  const [dateRows] = await pool.query(
    `
      SELECT
        DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS selected_date,
        DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d') AS next_date
    `
  );
  const selectedDate = dateRows[0]?.selected_date || new Date().toISOString().slice(0, 10);
  const endDateExclusive = dateRows[0]?.next_date || selectedDate;

  const sql = `
      SELECT
        ranked.product_name,
        ranked.barcode,
        ranked.total_quantity,
        ranked.total_sales,
        ranked.movements_count,
        COALESCE(pn.imagen, pb.imagen) AS product_image,
        COALESCE(pn.tiene_imagen, pb.tiene_imagen, 0) AS has_image
      FROM (
        SELECT
          COALESCE(NULLIF(TRIM(i.product_name), ''), 'Producto') AS product_name,
          COALESCE(NULLIF(TRIM(i.barcode), ''), null) AS barcode,
          SUM(i.quantity) AS total_quantity,
          SUM(i.total) AS total_sales,
          COUNT(DISTINCT i.movement_id) AS movements_count
        FROM ops_caja_movimiento_items i
        INNER JOIN ops_caja_movimientos m ON m.id = i.movement_id
        WHERE m.type = 'sale'
          AND m.created_at >= CURDATE()
          AND m.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
          AND NULLIF(TRIM(i.barcode), '') IS NOT NULL
          AND LOWER(TRIM(i.barcode)) NOT LIKE 'manual%'
        GROUP BY product_name, barcode
        ORDER BY total_quantity DESC, total_sales DESC, product_name ASC
        ${hasLimit ? 'LIMIT ?' : ''}
      ) ranked
      LEFT JOIN ops_producto pn
        ON ranked.barcode IS NOT NULL
       AND pn.barcode_normalized = ranked.barcode
      LEFT JOIN ops_producto pb
        ON ranked.barcode IS NOT NULL
       AND pb.barcode = ranked.barcode
      ORDER BY ranked.total_quantity DESC, ranked.total_sales DESC, ranked.product_name ASC
    `;
  const [rows] = await pool.query(sql, hasLimit ? [safeLimit] : []);

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
