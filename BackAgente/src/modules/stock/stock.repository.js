import { pool } from '../../config/db.js';

const STOCK_CONTROL_COLUMNS = `
  sc.id,
  sc.product_id,
  sc.active,
  sc.is_test_data,
  sc.supplier_name,
  sc.order_days_csv,
  sc.delivery_days_csv,
  sc.critical_threshold,
  sc.warning_threshold,
  sc.target_leftover,
  sc.notes,
  DATE_FORMAT(sc.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
  DATE_FORMAT(sc.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
  p.nombre AS product_name,
  p.categoria AS product_category,
  p.barcode AS product_barcode,
  p.barcode_normalized AS product_barcode_normalized,
  p.supplier_id AS product_supplier_id,
  sp.nombre AS product_supplier_name,
  COALESCE(p.stock_actual, 0) AS stock_actual
`;

let stockTablesPromise = null;

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

async function withTransaction(work) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function ensureStockTables() {
  if (stockTablesPromise) {
    return stockTablesPromise;
  }

  stockTablesPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_stock_control (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        is_test_data TINYINT(1) NOT NULL DEFAULT 0,
        supplier_name VARCHAR(140) NULL,
        order_days_csv VARCHAR(80) NULL,
        delivery_days_csv VARCHAR(80) NULL,
        critical_threshold INT NOT NULL DEFAULT 1,
        warning_threshold INT NOT NULL DEFAULT 4,
        target_leftover INT NOT NULL DEFAULT 2,
        notes VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_stock_control_product (product_id),
        INDEX idx_stock_control_active (active)
      )
    `);

    const hasIsTestData = await columnExists('ops_stock_control', 'is_test_data');
    if (!hasIsTestData) {
      await pool.query(`
        ALTER TABLE ops_stock_control
        ADD COLUMN is_test_data TINYINT(1) NOT NULL DEFAULT 0
        AFTER active
      `);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_stock_movimientos (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        stock_control_id INT NULL,
        type VARCHAR(20) NOT NULL,
        quantity_delta INT NOT NULL,
        quantity_before INT NOT NULL,
        quantity_after INT NOT NULL,
        reference_type VARCHAR(40) NULL,
        reference_id BIGINT NULL,
        notes VARCHAR(255) NULL,
        operator_id INT NULL,
        operator_name VARCHAR(140) NULL,
        operator_role VARCHAR(20) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_stock_mov_product_date (product_id, created_at),
        INDEX idx_stock_mov_type_date (type, created_at),
        INDEX idx_stock_mov_reference (reference_type, reference_id)
      )
    `);
  })();

  try {
    await stockTablesPromise;
  } catch (error) {
    stockTablesPromise = null;
    throw error;
  }
}

export async function findProductForStockById(productId) {
  await ensureStockTables();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        nombre,
        categoria,
        barcode,
        barcode_normalized,
        supplier_id,
        COALESCE(stock_actual, 0) AS stock_actual
      FROM ops_producto
      WHERE id = ?
      LIMIT 1
    `,
    [productId]
  );

  return rows[0] || null;
}

export async function searchProductsForStock({ query = '', limit = 15 } = {}) {
  await ensureStockTables();
  const safeLimit = Math.max(1, Math.min(40, Math.floor(normalizeNumber(limit, 15))));
  const normalizedQuery = String(query || '').trim();
  const hasQuery = normalizedQuery.length > 0;
  const wildcard = `%${normalizedQuery}%`;

  const sql = hasQuery
    ? `
      SELECT
        p.id,
        p.nombre,
        p.categoria,
        p.barcode,
        p.barcode_normalized,
        p.supplier_id,
        s.nombre AS supplier_name,
        COALESCE(p.stock_actual, 0) AS stock_actual
      FROM ops_producto p
      INNER JOIN ops_proveedores s ON s.id = p.supplier_id
      WHERE (p.nombre LIKE ? OR p.categoria LIKE ? OR p.barcode LIKE ? OR p.barcode_normalized LIKE ?)
      ORDER BY p.nombre ASC
      LIMIT ?
    `
    : `
      SELECT
        p.id,
        p.nombre,
        p.categoria,
        p.barcode,
        p.barcode_normalized,
        p.supplier_id,
        s.nombre AS supplier_name,
        COALESCE(p.stock_actual, 0) AS stock_actual
      FROM ops_producto p
      INNER JOIN ops_proveedores s ON s.id = p.supplier_id
      ORDER BY p.nombre ASC
      LIMIT ?
    `;

  const params = hasQuery
    ? [wildcard, wildcard, wildcard, wildcard, safeLimit]
    : [safeLimit];
  const [rows] = await pool.query(sql, params);

  return rows;
}

export async function listStockControls({ activeOnly = false, testOnly = false } = {}) {
  await ensureStockTables();
  const whereClauses = [];
  if (activeOnly) {
    whereClauses.push('sc.active = 1');
  }
  if (testOnly) {
    whereClauses.push('sc.is_test_data = 1');
  }
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `
      SELECT ${STOCK_CONTROL_COLUMNS}
      FROM ops_stock_control sc
      INNER JOIN ops_producto p ON p.id = sc.product_id
      LEFT JOIN ops_proveedores sp ON sp.id = p.supplier_id
      ${whereSql}
      ORDER BY p.nombre ASC
    `
  );

  return rows;
}

export async function findStockControlById(id) {
  await ensureStockTables();
  const [rows] = await pool.query(
    `
      SELECT ${STOCK_CONTROL_COLUMNS}
      FROM ops_stock_control sc
      INNER JOIN ops_producto p ON p.id = sc.product_id
      LEFT JOIN ops_proveedores sp ON sp.id = p.supplier_id
      WHERE sc.id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

export async function upsertStockControl(payload) {
  await ensureStockTables();

  return withTransaction(async (connection) => {
    await connection.query(
      `
        INSERT INTO ops_stock_control (
          product_id,
          active,
          is_test_data,
          supplier_name,
          order_days_csv,
          delivery_days_csv,
          critical_threshold,
          warning_threshold,
          target_leftover,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          active = VALUES(active),
          is_test_data = VALUES(is_test_data),
          supplier_name = VALUES(supplier_name),
          order_days_csv = VALUES(order_days_csv),
          delivery_days_csv = VALUES(delivery_days_csv),
          critical_threshold = VALUES(critical_threshold),
          warning_threshold = VALUES(warning_threshold),
          target_leftover = VALUES(target_leftover),
          notes = VALUES(notes)
      `,
      [
        payload.product_id,
        payload.active ? 1 : 0,
        payload.is_test_data ? 1 : 0,
        payload.supplier_name || null,
        payload.order_days_csv || null,
        payload.delivery_days_csv || null,
        payload.critical_threshold,
        payload.warning_threshold,
        payload.target_leftover,
        payload.notes || null
      ]
    );

    const [rows] = await connection.query(
      `
        SELECT ${STOCK_CONTROL_COLUMNS}
        FROM ops_stock_control sc
        INNER JOIN ops_producto p ON p.id = sc.product_id
        LEFT JOIN ops_proveedores sp ON sp.id = p.supplier_id
        WHERE sc.product_id = ?
        LIMIT 1
      `,
      [payload.product_id]
    );

    return rows[0] || null;
  });
}

export async function updateProductStockByDelta({
  productId,
  quantityDelta,
  type,
  referenceType = null,
  referenceId = null,
  notes = null,
  operator = null
}) {
  await ensureStockTables();

  return withTransaction(async (connection) => {
    const [productRows] = await connection.query(
      `
        SELECT
          id,
          COALESCE(stock_actual, 0) AS stock_actual
        FROM ops_producto
        WHERE id = ?
        FOR UPDATE
        LIMIT 1
      `,
      [productId]
    );

    const product = productRows[0];
    if (!product) {
      return null;
    }

    const quantityBefore = normalizeNumber(product.stock_actual, 0);
    const rawAfter = quantityBefore + normalizeNumber(quantityDelta, 0);
    const quantityAfter = Math.max(0, Math.round(rawAfter));
    const appliedDelta = quantityAfter - quantityBefore;

    if (appliedDelta === 0) {
      return {
        product_id: product.id,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        quantity_delta: 0
      };
    }

    await connection.query(
      `
        UPDATE ops_producto
        SET stock_actual = ?
        WHERE id = ?
      `,
      [quantityAfter, product.id]
    );

    const [controlRows] = await connection.query(
      `
        SELECT id
        FROM ops_stock_control
        WHERE product_id = ?
        LIMIT 1
      `,
      [product.id]
    );

    await connection.query(
      `
        INSERT INTO ops_stock_movimientos (
          product_id,
          stock_control_id,
          type,
          quantity_delta,
          quantity_before,
          quantity_after,
          reference_type,
          reference_id,
          notes,
          operator_id,
          operator_name,
          operator_role
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        product.id,
        controlRows[0]?.id || null,
        type,
        appliedDelta,
        quantityBefore,
        quantityAfter,
        referenceType || null,
        referenceId || null,
        notes || null,
        operator?.id || null,
        operator?.name || null,
        operator?.role || null
      ]
    );

    return {
      product_id: product.id,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      quantity_delta: appliedDelta
    };
  });
}

export async function applySaleDiscountByBarcode({
  barcodeToQuantityMap,
  referenceId = null,
  operator = null
}) {
  await ensureStockTables();

  const entries = [...barcodeToQuantityMap.entries()].filter(([, quantity]) => quantity > 0);
  if (!entries.length) {
    return [];
  }

  const barcodeValues = entries.map(([barcode]) => barcode);
  const placeholders = barcodeValues.map(() => '?').join(', ');

  return withTransaction(async (connection) => {
    const [productRows] = await connection.query(
      `
        SELECT
          id,
          barcode,
          barcode_normalized,
          supplier_id,
          COALESCE(stock_actual, 0) AS stock_actual
        FROM ops_producto
        WHERE supplier_id IS NOT NULL
          AND (
            barcode_normalized IN (${placeholders})
            OR barcode IN (${placeholders})
          )
        FOR UPDATE
      `,
      [...barcodeValues, ...barcodeValues]
    );

    if (!productRows.length) {
      return [];
    }

    const productsByBarcode = new Map();
    const productIds = [];
    productRows.forEach((product) => {
      const barcode = String(product.barcode || '').trim();
      const normalized = String(product.barcode_normalized || '').trim();
      productIds.push(Number(product.id));
      if (barcode) {
        productsByBarcode.set(barcode, product);
      }
      if (normalized) {
        productsByBarcode.set(normalized, product);
      }
    });

    const controlIdsByProductId = new Map();
    if (productIds.length > 0) {
      const controlPlaceholders = productIds.map(() => '?').join(', ');
      const [controlRows] = await connection.query(
        `
          SELECT id, product_id
          FROM ops_stock_control
          WHERE product_id IN (${controlPlaceholders})
        `,
        productIds
      );

      controlRows.forEach((row) => {
        controlIdsByProductId.set(Number(row.product_id), Number(row.id));
      });
    }

    const applied = [];

    for (const [barcode, quantity] of entries) {
      const product = productsByBarcode.get(barcode);
      if (!product) {
        continue;
      }

      const quantityBefore = normalizeNumber(product.stock_actual, 0);
      const quantityAfter = Math.max(0, quantityBefore - Math.round(quantity));
      const appliedDelta = quantityAfter - quantityBefore;

      if (appliedDelta === 0) {
        continue;
      }

      await connection.query(
        `
          UPDATE ops_producto
          SET stock_actual = ?
          WHERE id = ?
        `,
        [quantityAfter, product.id]
      );

      await connection.query(
        `
          INSERT INTO ops_stock_movimientos (
            product_id,
            stock_control_id,
            type,
            quantity_delta,
            quantity_before,
            quantity_after,
            reference_type,
            reference_id,
            notes,
            operator_id,
            operator_name,
            operator_role
          )
          VALUES (?, ?, 'sale', ?, ?, ?, 'cashbox_movement', ?, ?, ?, ?, ?)
        `,
        [
          product.id,
          controlIdsByProductId.get(Number(product.id)) || null,
          appliedDelta,
          quantityBefore,
          quantityAfter,
          referenceId || null,
          'Descuento automatico por venta',
          operator?.id || null,
          operator?.name || null,
          operator?.role || null
        ]
      );

      product.stock_actual = quantityAfter;
      applied.push({
        product_id: product.id,
        barcode,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        quantity_delta: appliedDelta
      });
    }

    return applied;
  });
}

const DEMO_STOCK_PATTERN = [1, 4, 8];

export async function seedSupplierStockDemoData({ limit = 12 } = {}) {
  await ensureStockTables();

  return withTransaction(async (connection) => {
    const safeLimit = Math.max(1, Math.min(60, Math.floor(Number(limit) || 12)));
    const [products] = await connection.query(
      `
        SELECT
          p.id,
          p.nombre,
          s.nombre AS supplier_name
        FROM ops_producto p
        INNER JOIN ops_proveedores s ON s.id = p.supplier_id
        ORDER BY p.id ASC
        LIMIT ?
      `,
      [safeLimit]
    );

    const applied = [];

    for (let index = 0; index < products.length; index += 1) {
      const product = products[index];
      const stockActual = DEMO_STOCK_PATTERN[index % DEMO_STOCK_PATTERN.length];
      const critical = Math.max(1, Math.min(stockActual, 2));
      const warning = Math.max(critical + 1, stockActual + 1);

      await connection.query(
        `
          UPDATE ops_producto
          SET stock_actual = ?
          WHERE id = ?
        `,
        [stockActual, product.id]
      );

      await connection.query(
        `
          INSERT INTO ops_stock_control (
            product_id,
            active,
            is_test_data,
            supplier_name,
            order_days_csv,
            delivery_days_csv,
            critical_threshold,
            warning_threshold,
            target_leftover,
            notes
          )
          VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            active = VALUES(active),
            is_test_data = VALUES(is_test_data),
            supplier_name = VALUES(supplier_name),
            order_days_csv = VALUES(order_days_csv),
            delivery_days_csv = VALUES(delivery_days_csv),
            critical_threshold = VALUES(critical_threshold),
            warning_threshold = VALUES(warning_threshold),
            target_leftover = VALUES(target_leftover),
            notes = VALUES(notes)
        `,
        [
          product.id,
          1,
          product.supplier_name || null,
          'monday,thursday',
          'tuesday,friday',
          critical,
          warning,
          2,
          'Seed demo para alertas de stock por proveedor'
        ]
      );

      applied.push({
        product_id: Number(product.id),
        product_name: product.nombre,
        supplier_name: product.supplier_name || null,
        stock_actual: stockActual
      });
    }

    return applied;
  });
}

export async function listSoldQuantityByProductSince({ productIds = [], sinceDate }) {
  await ensureStockTables();

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return [];
  }

  const placeholders = productIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `
      SELECT
        product_id,
        ABS(SUM(quantity_delta)) AS sold_quantity
      FROM ops_stock_movimientos
      WHERE type = 'sale'
        AND created_at >= ?
        AND product_id IN (${placeholders})
      GROUP BY product_id
    `,
    [sinceDate, ...productIds]
  );

  return rows;
}
