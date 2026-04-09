import { Router } from 'express';
import { pool } from '../config/db.js';
import { getCachedProduct, getProductCacheStats, normalizeBarcode, setCachedProduct } from '../utils/productCache.js';

const router = Router();

router.get('/products', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT id, nombre, precio_venta, stock_actual, categoria, estado
        FROM ops_producto
        ORDER BY id DESC
        LIMIT 20
      `
    );

    res.json({
      count: rows.length,
      items: rows
    });
  } catch (error) {
    res.status(500).json({
      message: 'No se pudieron obtener los productos',
      error: error.message
    });
  }
});

router.get('/products/scan/:barcode', async (req, res) => {
  const startedAt = performance.now();
  const normalizedBarcode = normalizeBarcode(req.params.barcode);

  if (!normalizedBarcode) {
    return res.status(400).json({
      message: 'Código de barras requerido'
    });
  }

  const cachedProduct = getCachedProduct(normalizedBarcode);

  if (cachedProduct) {
    return res.json({
      item: cachedProduct,
      meta: {
        source: 'server-cache',
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
        cache: getProductCacheStats()
      }
    });
  }

  try {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          nombre,
          precio_venta,
          stock_actual,
          categoria,
          estado,
          barcode,
          barcode_normalized,
          tiene_imagen
        FROM ops_producto
        WHERE barcode_normalized = ? OR barcode = ?
        LIMIT 1
      `,
      [normalizedBarcode, normalizedBarcode]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'Producto no encontrado',
        meta: {
          source: 'database',
          durationMs: Number((performance.now() - startedAt).toFixed(2))
        }
      });
    }

    const item = rows[0];
    setCachedProduct(normalizedBarcode, item);

    return res.json({
      item,
      meta: {
        source: 'database',
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
        cache: getProductCacheStats()
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: 'No se pudo escanear el producto',
      error: error.message
    });
  }
});

export default router;
