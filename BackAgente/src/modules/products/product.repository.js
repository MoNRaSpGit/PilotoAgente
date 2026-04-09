import { pool } from '../../config/db.js';

const PRODUCT_COLUMNS = `
  id,
  nombre,
  precio_venta,
  stock_actual,
  categoria,
  estado,
  barcode,
  barcode_normalized,
  tiene_imagen,
  imagen
`;

export async function listProducts(limit = 20) {
  const [rows] = await pool.query(
    `
      SELECT id, nombre, precio_venta, stock_actual, categoria, estado
      FROM ops_producto
      ORDER BY id DESC
      LIMIT ?
    `,
    [limit]
  );

  return rows;
}

export async function findProductByBarcode(barcode) {
  const [rows] = await pool.query(
    `
      SELECT ${PRODUCT_COLUMNS}
      FROM ops_producto
      WHERE barcode_normalized = ? OR barcode = ?
      LIMIT 1
    `,
    [barcode, barcode]
  );

  return rows[0] || null;
}

export async function findProductById(id) {
  const [rows] = await pool.query(
    `
      SELECT ${PRODUCT_COLUMNS}
      FROM ops_producto
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

export async function insertManualProductFromScan({ barcode, precioVenta }) {
  const [result] = await pool.query(
    `
      INSERT INTO ops_producto (
        nombre,
        precio_venta,
        stock_actual,
        categoria,
        estado,
        barcode,
        barcode_normalized,
        tiene_imagen,
        imagen
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      'Producto Manual',
      precioVenta,
      0,
      'Manual',
      'activo',
      barcode,
      barcode,
      0,
      null
    ]
  );

  return result.insertId;
}
