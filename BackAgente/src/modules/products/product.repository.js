import { pool } from '../../config/db.js';

const PRODUCT_COLUMNS = `
  p.id,
  p.nombre,
  p.precio_venta,
  p.stock_actual,
  p.categoria,
  p.supplier_id,
  s.nombre AS supplier_name,
  p.estado,
  p.barcode,
  p.barcode_normalized,
  p.tiene_imagen,
  p.imagen
`;

export async function findProductByBarcode(barcode) {
  const [rows] = await pool.query(
    `
      SELECT ${PRODUCT_COLUMNS}
      FROM ops_producto p
      LEFT JOIN ops_proveedores s ON s.id = p.supplier_id
      WHERE p.barcode_normalized = ? OR p.barcode = ?
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
      FROM ops_producto p
      LEFT JOIN ops_proveedores s ON s.id = p.supplier_id
      WHERE p.id = ?
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

export async function updateProductById({ productId, nombre, precioVenta }) {
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

  return findProductById(productId);
}
