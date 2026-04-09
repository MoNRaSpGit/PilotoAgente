import { Router } from 'express';
import { pool } from '../config/db.js';

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

export default router;
