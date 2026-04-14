import { pool } from '../../config/db.js';

let supplierTablesPromise = null;

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

export async function ensureSupplierTables() {
  if (supplierTablesPromise) {
    return supplierTablesPromise;
  }

  supplierTablesPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_proveedores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(140) NOT NULL,
        telefono VARCHAR(60) NULL,
        email VARCHAR(190) NULL,
        dias_pedido_csv VARCHAR(80) NULL,
        dias_entrega_csv VARCHAR(80) NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'activo',
        notas VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_proveedor_nombre (nombre),
        INDEX idx_proveedor_estado (estado)
      )
    `);

    const hasSupplierId = await columnExists('ops_producto', 'supplier_id');
    if (!hasSupplierId) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD COLUMN supplier_id INT NULL AFTER categoria
      `);
    }

    const hasSupplierIndex = await indexExists('ops_producto', 'idx_producto_supplier_id');
    if (!hasSupplierIndex) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD INDEX idx_producto_supplier_id (supplier_id)
      `);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_supplier_orders (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        supplier_id INT NOT NULL,
        order_date DATE NOT NULL,
        delivery_date DATE NOT NULL,
        expected_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        notes VARCHAR(255) NULL,
        operator_id INT NULL,
        operator_name VARCHAR(140) NULL,
        operator_role VARCHAR(20) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_supplier_orders_delivery_status (delivery_date, status),
        INDEX idx_supplier_orders_supplier_delivery (supplier_id, delivery_date),
        CONSTRAINT fk_supplier_orders_supplier
          FOREIGN KEY (supplier_id) REFERENCES ops_proveedores(id)
          ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_supplier_order_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        order_id BIGINT NOT NULL,
        product_id INT NULL,
        product_name VARCHAR(190) NOT NULL,
        quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
        unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        line_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        notes VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_supplier_order_items_order (order_id),
        INDEX idx_supplier_order_items_product (product_id),
        CONSTRAINT fk_supplier_order_items_order
          FOREIGN KEY (order_id) REFERENCES ops_supplier_orders(id)
          ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_supplier_order_drafts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        supplier_id INT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        source VARCHAR(30) NOT NULL DEFAULT 'stock',
        notes VARCHAR(255) NULL,
        operator_id INT NULL,
        operator_name VARCHAR(140) NULL,
        operator_role VARCHAR(20) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_supplier_drafts_supplier_status (supplier_id, status),
        INDEX idx_supplier_drafts_updated (updated_at),
        CONSTRAINT fk_supplier_drafts_supplier
          FOREIGN KEY (supplier_id) REFERENCES ops_proveedores(id)
          ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_supplier_order_draft_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        draft_id BIGINT NOT NULL,
        product_id INT NULL,
        product_name VARCHAR(190) NOT NULL,
        quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
        unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        line_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        source VARCHAR(30) NOT NULL DEFAULT 'stock_alert',
        notes VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_supplier_draft_items_draft (draft_id),
        INDEX idx_supplier_draft_items_product (product_id),
        UNIQUE KEY uniq_supplier_draft_product (draft_id, product_id),
        CONSTRAINT fk_supplier_draft_items_draft
          FOREIGN KEY (draft_id) REFERENCES ops_supplier_order_drafts(id)
          ON DELETE CASCADE
      )
    `);
  })();

  try {
    await supplierTablesPromise;
  } catch (error) {
    supplierTablesPromise = null;
    throw error;
  }
}

export async function listSuppliers() {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        nombre,
        telefono,
        email,
        dias_pedido_csv,
        dias_entrega_csv,
        estado,
        notas,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_proveedores
      ORDER BY nombre ASC
    `
  );

  return rows;
}

export async function createSupplier(payload) {
  await ensureSupplierTables();
  const [result] = await pool.query(
    `
      INSERT INTO ops_proveedores (
        nombre,
        telefono,
        email,
        dias_pedido_csv,
        dias_entrega_csv,
        estado,
        notas
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.nombre,
      payload.telefono || null,
      payload.email || null,
      payload.dias_pedido_csv || null,
      payload.dias_entrega_csv || null,
      payload.estado || 'activo',
      payload.notas || null
    ]
  );

  const [rows] = await pool.query(
    `
      SELECT
        id,
        nombre,
        telefono,
        email,
        dias_pedido_csv,
        dias_entrega_csv,
        estado,
        notas,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_proveedores
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return rows[0] || null;
}

export async function assignSupplierToProduct({ productId, supplierId }) {
  await ensureSupplierTables();

  await pool.query(
    `
      UPDATE ops_producto
      SET supplier_id = ?
      WHERE id = ?
    `,
    [supplierId, productId]
  );

  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.nombre,
        p.categoria,
        p.barcode,
        p.barcode_normalized,
        p.stock_actual,
        p.supplier_id,
        s.nombre AS supplier_name
      FROM ops_producto p
      LEFT JOIN ops_proveedores s ON s.id = p.supplier_id
      WHERE p.id = ?
      LIMIT 1
    `,
    [productId]
  );

  return rows[0] || null;
}

export async function findSupplierById(id) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        nombre,
        telefono,
        email,
        dias_pedido_csv,
        dias_entrega_csv,
        estado,
        notas,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_proveedores
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

export async function findProductById(productId) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT id, nombre, supplier_id
      FROM ops_producto
      WHERE id = ?
      LIMIT 1
    `,
    [productId]
  );

  return rows[0] || null;
}

export async function listProductsBySupplier(supplierId) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.nombre,
        p.categoria,
        p.precio_venta,
        p.stock_actual,
        p.barcode,
        p.barcode_normalized,
        p.supplier_id
      FROM ops_producto p
      WHERE p.supplier_id = ?
      ORDER BY p.nombre ASC
    `,
    [supplierId]
  );

  return rows;
}

export async function createSupplierOrder(payload) {
  await ensureSupplierTables();
  return withTransaction(async (connection) => {
    const [result] = await connection.query(
      `
        INSERT INTO ops_supplier_orders (
          supplier_id,
          order_date,
          delivery_date,
          expected_amount,
          status,
          notes,
          operator_id,
          operator_name,
          operator_role
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.supplier_id,
        payload.order_date,
        payload.delivery_date,
        payload.expected_amount,
        payload.status || 'pendiente',
        payload.notes || null,
        payload.operator_id || null,
        payload.operator_name || null,
        payload.operator_role || null
      ]
    );

    const orderId = Number(result.insertId);
    const items = Array.isArray(payload.items) ? payload.items : [];

    for (const item of items) {
      await connection.query(
        `
          INSERT INTO ops_supplier_order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_cost,
            line_total,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          item.product_id || null,
          item.product_name,
          item.quantity,
          item.unit_cost,
          item.line_total,
          item.notes || null
        ]
      );
    }

    const [rows] = await connection.query(
      `
        SELECT
          so.id,
          so.supplier_id,
          s.nombre AS supplier_name,
          DATE_FORMAT(so.order_date, '%Y-%m-%d') AS order_date,
          DATE_FORMAT(so.delivery_date, '%Y-%m-%d') AS delivery_date,
          so.expected_amount,
          so.status,
          so.notes,
          so.operator_id,
          so.operator_name,
          so.operator_role,
          DATE_FORMAT(so.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(so.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_orders so
        INNER JOIN ops_proveedores s ON s.id = so.supplier_id
        WHERE so.id = ?
        LIMIT 1
      `,
      [orderId]
    );

    return rows[0] || null;
  });
}

export async function upsertPendingSupplierOrderWithItems({
  supplierId,
  orderDate,
  deliveryDate,
  notes = null,
  operator = null,
  items = []
}) {
  await ensureSupplierTables();

  return withTransaction(async (connection) => {
    const expectedAmount = Number(
      (Array.isArray(items) ? items : []).reduce((acc, item) => acc + Number(item.line_total || 0), 0).toFixed(2)
    );

    const [existingRows] = await connection.query(
      `
        SELECT id
        FROM ops_supplier_orders
        WHERE supplier_id = ?
          AND delivery_date = ?
          AND status = 'pendiente'
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [supplierId, deliveryDate]
    );

    const existing = existingRows[0] || null;
    let orderId = null;

    if (existing) {
      orderId = Number(existing.id);
      await connection.query(
        `
          UPDATE ops_supplier_orders
          SET order_date = ?,
              expected_amount = ?,
              notes = ?,
              operator_id = ?,
              operator_name = ?,
              operator_role = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          orderDate,
          expectedAmount,
          notes || null,
          operator?.id || null,
          operator?.name || null,
          operator?.role || null,
          orderId
        ]
      );

      await connection.query(
        `
          DELETE FROM ops_supplier_order_items
          WHERE order_id = ?
        `,
        [orderId]
      );
    } else {
      const [createdResult] = await connection.query(
        `
          INSERT INTO ops_supplier_orders (
            supplier_id,
            order_date,
            delivery_date,
            expected_amount,
            status,
            notes,
            operator_id,
            operator_name,
            operator_role
          )
          VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?, ?)
        `,
        [
          supplierId,
          orderDate,
          deliveryDate,
          expectedAmount,
          notes || null,
          operator?.id || null,
          operator?.name || null,
          operator?.role || null
        ]
      );
      orderId = Number(createdResult.insertId);
    }

    for (const item of Array.isArray(items) ? items : []) {
      await connection.query(
        `
          INSERT INTO ops_supplier_order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_cost,
            line_total,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          item.product_id || null,
          item.product_name,
          item.quantity,
          item.unit_cost,
          item.line_total,
          item.notes || null
        ]
      );
    }

    const [orderRows] = await connection.query(
      `
        SELECT
          so.id,
          so.supplier_id,
          s.nombre AS supplier_name,
          DATE_FORMAT(so.order_date, '%Y-%m-%d') AS order_date,
          DATE_FORMAT(so.delivery_date, '%Y-%m-%d') AS delivery_date,
          so.expected_amount,
          so.status,
          so.notes,
          so.operator_id,
          so.operator_name,
          so.operator_role,
          DATE_FORMAT(so.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(so.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_orders so
        INNER JOIN ops_proveedores s ON s.id = so.supplier_id
        WHERE so.id = ?
        LIMIT 1
      `,
      [orderId]
    );

    const [itemRows] = await connection.query(
      `
        SELECT
          id,
          order_id,
          product_id,
          product_name,
          quantity,
          unit_cost,
          line_total,
          notes,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_order_items
        WHERE order_id = ?
        ORDER BY id ASC
      `,
      [orderId]
    );

    return {
      order: orderRows[0] || null,
      items: itemRows
    };
  });
}

export async function listSupplierOrdersByDateRange({
  fromDate,
  toDate,
  status = 'pendiente',
  dateField = 'delivery_date'
}) {
  await ensureSupplierTables();
  const safeDateField = dateField === 'order_date' ? 'order_date' : 'delivery_date';
  const [rows] = await pool.query(
    `
      SELECT
        so.id,
        so.supplier_id,
        s.nombre AS supplier_name,
        DATE_FORMAT(so.order_date, '%Y-%m-%d') AS order_date,
        DATE_FORMAT(so.delivery_date, '%Y-%m-%d') AS delivery_date,
        so.expected_amount,
        so.status,
        so.notes,
        so.operator_id,
        so.operator_name,
        so.operator_role,
        DATE_FORMAT(so.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(so.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_orders so
      INNER JOIN ops_proveedores s ON s.id = so.supplier_id
      WHERE so.${safeDateField} >= ?
        AND so.${safeDateField} <= ?
        AND so.status = ?
      ORDER BY so.delivery_date ASC, s.nombre ASC, so.id ASC
    `,
    [fromDate, toDate, status]
  );

  return rows;
}

export async function listSupplierOrders({ limit = 50 } = {}) {
  await ensureSupplierTables();
  const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 50)));
  const [rows] = await pool.query(
    `
      SELECT
        so.id,
        so.supplier_id,
        s.nombre AS supplier_name,
        DATE_FORMAT(so.order_date, '%Y-%m-%d') AS order_date,
        DATE_FORMAT(so.delivery_date, '%Y-%m-%d') AS delivery_date,
        so.expected_amount,
        so.status,
        so.notes,
        so.operator_id,
        so.operator_name,
        so.operator_role,
        DATE_FORMAT(so.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(so.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_orders so
      INNER JOIN ops_proveedores s ON s.id = so.supplier_id
      ORDER BY so.delivery_date DESC, so.id DESC
      LIMIT ?
    `,
    [safeLimit]
  );

  return rows;
}

export async function findSupplierOrderById(orderId) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        so.id,
        so.supplier_id,
        s.nombre AS supplier_name,
        DATE_FORMAT(so.order_date, '%Y-%m-%d') AS order_date,
        DATE_FORMAT(so.delivery_date, '%Y-%m-%d') AS delivery_date,
        so.expected_amount,
        so.status,
        so.notes,
        so.operator_id,
        so.operator_name,
        so.operator_role,
        DATE_FORMAT(so.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(so.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_orders so
      INNER JOIN ops_proveedores s ON s.id = so.supplier_id
      WHERE so.id = ?
      LIMIT 1
    `,
    [orderId]
  );

  return rows[0] || null;
}

export async function receiveSupplierOrderAndApplyStock({
  orderId,
  receivedItems = [],
  receivedBy = null
}) {
  await ensureSupplierTables();

  return withTransaction(async (connection) => {
    const [orderRows] = await connection.query(
      `
        SELECT
          so.id,
          so.supplier_id,
          s.nombre AS supplier_name,
          DATE_FORMAT(so.order_date, '%Y-%m-%d') AS order_date,
          DATE_FORMAT(so.delivery_date, '%Y-%m-%d') AS delivery_date,
          so.expected_amount,
          so.status,
          so.notes,
          so.operator_id,
          so.operator_name,
          so.operator_role,
          DATE_FORMAT(so.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(so.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_orders so
        INNER JOIN ops_proveedores s ON s.id = so.supplier_id
        WHERE so.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [orderId]
    );
    const order = orderRows[0] || null;
    if (!order) {
      return null;
    }

    if (String(order.status || '').trim().toLowerCase() !== 'pendiente') {
      return {
        order,
        items: [],
        already_received: true
      };
    }

    const [itemRows] = await connection.query(
      `
        SELECT
          id,
          order_id,
          product_id,
          product_name,
          quantity,
          unit_cost,
          line_total,
          notes,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_order_items
        WHERE order_id = ?
        ORDER BY id ASC
      `,
      [orderId]
    );

    const orderedByItemId = new Map(
      itemRows.map((item) => [Number(item.id), Number(item.quantity || 0)])
    );
    const receivedByItemId = new Map();

    if (Array.isArray(receivedItems) && receivedItems.length > 0) {
      for (const entry of receivedItems) {
        const itemId = Number(entry?.item_id);
        const quantityReceived = Number(entry?.quantity_received);

        if (!Number.isFinite(itemId) || itemId <= 0 || !orderedByItemId.has(itemId)) {
          const error = new Error('Item de recepcion invalido');
          error.status = 400;
          throw error;
        }
        if (!Number.isFinite(quantityReceived) || quantityReceived < 0) {
          const error = new Error('Cantidad recibida invalida');
          error.status = 400;
          throw error;
        }

        const orderedQuantity = Number(orderedByItemId.get(itemId) || 0);
        if (quantityReceived > orderedQuantity) {
          const error = new Error('La cantidad recibida no puede superar la pedida');
          error.status = 400;
          throw error;
        }

        receivedByItemId.set(itemId, Number(quantityReceived.toFixed(3)));
      }

      for (const [itemId] of orderedByItemId.entries()) {
        if (!receivedByItemId.has(itemId)) {
          receivedByItemId.set(itemId, 0);
        }
      }
    } else {
      for (const [itemId, orderedQuantity] of orderedByItemId.entries()) {
        receivedByItemId.set(itemId, Number(Number(orderedQuantity || 0).toFixed(3)));
      }
    }

    const stockUpdates = [];
    const qtyByProductId = new Map();
    for (const row of itemRows) {
      const productId = Number(row?.product_id || 0);
      const itemId = Number(row?.id || 0);
      const quantityToAdd = Number(receivedByItemId.get(itemId) || 0);
      if (!productId || !Number.isFinite(quantityToAdd) || quantityToAdd <= 0) {
        continue;
      }

      const current = Number(qtyByProductId.get(productId) || 0);
      qtyByProductId.set(productId, Number((current + quantityToAdd).toFixed(3)));
    }

    for (const [productId, quantityToAdd] of qtyByProductId.entries()) {
      if (!Number.isFinite(quantityToAdd) || quantityToAdd <= 0) {
        continue;
      }

      await connection.query(
        `
          UPDATE ops_producto
          SET stock_actual = stock_actual + ?
          WHERE id = ?
        `,
        [quantityToAdd, productId]
      );

      stockUpdates.push({
        product_id: productId,
        quantity_added: Number(quantityToAdd.toFixed(3))
      });
    }

    await connection.query(
      `
        UPDATE ops_supplier_orders
        SET status = 'recibido',
            notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        order.notes || (receivedBy?.name ? `Recepcion confirmado por ${receivedBy.name}` : null),
        orderId
      ]
    );

    const [updatedOrderRows] = await connection.query(
      `
        SELECT
          so.id,
          so.supplier_id,
          s.nombre AS supplier_name,
          DATE_FORMAT(so.order_date, '%Y-%m-%d') AS order_date,
          DATE_FORMAT(so.delivery_date, '%Y-%m-%d') AS delivery_date,
          so.expected_amount,
          so.status,
          so.notes,
          so.operator_id,
          so.operator_name,
          so.operator_role,
          DATE_FORMAT(so.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(so.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_orders so
        INNER JOIN ops_proveedores s ON s.id = so.supplier_id
        WHERE so.id = ?
        LIMIT 1
      `,
      [orderId]
    );

    return {
      order: updatedOrderRows[0] || order,
      items: itemRows,
      stock_updates: stockUpdates
    };
  });
}

export async function listSupplierOrderItemsByOrderIds(orderIds = []) {
  await ensureSupplierTables();
  const safeIds = Array.isArray(orderIds)
    ? orderIds.map((id) => Number.parseInt(id, 10)).filter((id) => Number.isFinite(id) && id > 0)
    : [];

  if (!safeIds.length) {
    return [];
  }

  const placeholders = safeIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `
      SELECT
        soi.id,
        soi.order_id,
        soi.product_id,
        soi.product_name,
        soi.quantity,
        soi.unit_cost,
        soi.line_total,
        soi.notes,
        DATE_FORMAT(soi.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(soi.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_items soi
      WHERE soi.order_id IN (${placeholders})
      ORDER BY soi.order_id ASC, soi.id ASC
    `,
    safeIds
  );

  return rows;
}

export async function findOpenSupplierDraftBySupplierId(supplierId) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        d.id,
        d.supplier_id,
        s.nombre AS supplier_name,
        d.status,
        d.source,
        d.notes,
        d.operator_id,
        d.operator_name,
        d.operator_role,
        DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(d.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_drafts d
      INNER JOIN ops_proveedores s ON s.id = d.supplier_id
      WHERE d.supplier_id = ?
        AND d.status = 'open'
      ORDER BY d.updated_at DESC, d.id DESC
      LIMIT 1
    `,
    [supplierId]
  );

  return rows[0] || null;
}

export async function createSupplierOrderDraft(payload) {
  await ensureSupplierTables();
  const [result] = await pool.query(
    `
      INSERT INTO ops_supplier_order_drafts (
        supplier_id,
        status,
        source,
        notes,
        operator_id,
        operator_name,
        operator_role
      )
      VALUES (?, 'open', ?, ?, ?, ?, ?)
    `,
    [
      payload.supplier_id,
      payload.source || 'stock',
      payload.notes || null,
      payload.operator_id || null,
      payload.operator_name || null,
      payload.operator_role || null
    ]
  );

  const [rows] = await pool.query(
    `
      SELECT
        d.id,
        d.supplier_id,
        s.nombre AS supplier_name,
        d.status,
        d.source,
        d.notes,
        d.operator_id,
        d.operator_name,
        d.operator_role,
        DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(d.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_drafts d
      INNER JOIN ops_proveedores s ON s.id = d.supplier_id
      WHERE d.id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return rows[0] || null;
}

export async function upsertSupplierOrderDraftItem({
  draftId,
  productId = null,
  productName,
  quantity,
  unitCost = 0,
  lineTotal = 0,
  source = 'stock_alert',
  notes = null
}) {
  await ensureSupplierTables();

  return withTransaction(async (connection) => {
    let existing = null;

    if (productId) {
      const [existingRows] = await connection.query(
        `
          SELECT id, quantity, unit_cost
          FROM ops_supplier_order_draft_items
          WHERE draft_id = ?
            AND product_id = ?
          LIMIT 1
        `,
        [draftId, productId]
      );
      existing = existingRows[0] || null;
    }

    if (existing) {
      const nextQuantity = Number(existing.quantity || 0) + Number(quantity || 0);
      const nextUnitCost = Number(unitCost || existing.unit_cost || 0);
      const nextLineTotal = Number((nextQuantity * nextUnitCost).toFixed(2));

      await connection.query(
        `
          UPDATE ops_supplier_order_draft_items
          SET quantity = ?,
              unit_cost = ?,
              line_total = ?,
              product_name = ?,
              source = ?,
              notes = ?
          WHERE id = ?
        `,
        [nextQuantity, nextUnitCost, nextLineTotal, productName, source, notes, existing.id]
      );
    } else {
      await connection.query(
        `
          INSERT INTO ops_supplier_order_draft_items (
            draft_id,
            product_id,
            product_name,
            quantity,
            unit_cost,
            line_total,
            source,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [draftId, productId || null, productName, quantity, unitCost, lineTotal, source, notes]
      );
    }

    const [rows] = await connection.query(
      `
        SELECT
          id,
          draft_id,
          product_id,
          product_name,
          quantity,
          unit_cost,
          line_total,
          source,
          notes,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_order_draft_items
        WHERE draft_id = ?
        ORDER BY id ASC
      `,
      [draftId]
    );

    return rows;
  });
}

export async function listSupplierOrderDraftItemsByDraftId(draftId) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        draft_id,
        product_id,
        product_name,
        quantity,
        unit_cost,
        line_total,
        source,
        notes,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_draft_items
      WHERE draft_id = ?
      ORDER BY id ASC
    `,
    [draftId]
  );

  return rows;
}

export async function listOpenSupplierOrderDrafts() {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        d.id,
        d.supplier_id,
        s.nombre AS supplier_name,
        d.status,
        d.source,
        d.notes,
        d.operator_id,
        d.operator_name,
        d.operator_role,
        DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(d.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_drafts d
      INNER JOIN ops_proveedores s ON s.id = d.supplier_id
      WHERE d.status = 'open'
      ORDER BY d.updated_at DESC, d.id DESC
    `
  );

  return rows;
}

export async function findSupplierOrderDraftById(draftId) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        d.id,
        d.supplier_id,
        s.nombre AS supplier_name,
        d.status,
        d.source,
        d.notes,
        d.operator_id,
        d.operator_name,
        d.operator_role,
        DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(d.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_drafts d
      INNER JOIN ops_proveedores s ON s.id = d.supplier_id
      WHERE d.id = ?
      LIMIT 1
    `,
    [draftId]
  );

  return rows[0] || null;
}

export async function confirmSupplierOrderDraft({
  draftId,
  orderDate,
  deliveryDate,
  notes = null,
  operator = null
}) {
  await ensureSupplierTables();

  return withTransaction(async (connection) => {
    const [draftRows] = await connection.query(
      `
        SELECT
          d.id,
          d.supplier_id,
          d.status,
          d.notes,
          s.nombre AS supplier_name
        FROM ops_supplier_order_drafts d
        INNER JOIN ops_proveedores s ON s.id = d.supplier_id
        WHERE d.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [draftId]
    );
    const draft = draftRows[0] || null;
    if (!draft) {
      return null;
    }

    if (draft.status !== 'open') {
      return {
        draft,
        order: null,
        items: [],
        already_confirmed: true
      };
    }

    const [itemRows] = await connection.query(
      `
        SELECT
          id,
          product_id,
          product_name,
          quantity,
          unit_cost,
          line_total,
          notes
        FROM ops_supplier_order_draft_items
        WHERE draft_id = ?
        ORDER BY id ASC
      `,
      [draftId]
    );

    if (!itemRows.length) {
      return {
        draft,
        order: null,
        items: [],
        empty_draft: true
      };
    }

    const expectedAmount = Number(
      itemRows.reduce((acc, item) => acc + Number(item.line_total || 0), 0).toFixed(2)
    );

    const [existingOrderRows] = await connection.query(
      `
        SELECT id
        FROM ops_supplier_orders
        WHERE supplier_id = ?
          AND delivery_date = ?
          AND status = 'pendiente'
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [draft.supplier_id, deliveryDate]
    );

    const existingOrder = existingOrderRows[0] || null;
    let orderId = null;

    if (existingOrder) {
      orderId = Number(existingOrder.id);

      await connection.query(
        `
          UPDATE ops_supplier_orders
          SET order_date = ?,
              expected_amount = ?,
              notes = ?,
              operator_id = ?,
              operator_name = ?,
              operator_role = ?
          WHERE id = ?
        `,
        [
          orderDate,
          expectedAmount,
          notes || draft.notes || null,
          operator?.id || null,
          operator?.name || null,
          operator?.role || null,
          orderId
        ]
      );

      await connection.query(
        `
          DELETE FROM ops_supplier_order_items
          WHERE order_id = ?
        `,
        [orderId]
      );
    } else {
      const [orderResult] = await connection.query(
        `
          INSERT INTO ops_supplier_orders (
            supplier_id,
            order_date,
            delivery_date,
            expected_amount,
            status,
            notes,
            operator_id,
            operator_name,
            operator_role
          )
          VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?, ?)
        `,
        [
          draft.supplier_id,
          orderDate,
          deliveryDate,
          expectedAmount,
          notes || draft.notes || null,
          operator?.id || null,
          operator?.name || null,
          operator?.role || null
        ]
      );
      orderId = Number(orderResult.insertId);
    }

    for (const item of itemRows) {
      await connection.query(
        `
          INSERT INTO ops_supplier_order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_cost,
            line_total,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          item.product_id || null,
          item.product_name,
          item.quantity,
          item.unit_cost,
          item.line_total,
          item.notes || null
        ]
      );
    }

    await connection.query(
      `
        UPDATE ops_supplier_order_drafts
        SET status = 'confirmed',
            notes = ?,
            operator_id = ?,
            operator_name = ?,
            operator_role = ?
        WHERE id = ?
      `,
      [
        notes || draft.notes || null,
        operator?.id || null,
        operator?.name || null,
        operator?.role || null,
        draftId
      ]
    );

    const [orderRows] = await connection.query(
      `
        SELECT
          so.id,
          so.supplier_id,
          s.nombre AS supplier_name,
          DATE_FORMAT(so.order_date, '%Y-%m-%d') AS order_date,
          DATE_FORMAT(so.delivery_date, '%Y-%m-%d') AS delivery_date,
          so.expected_amount,
          so.status,
          so.notes,
          so.operator_id,
          so.operator_name,
          so.operator_role,
          DATE_FORMAT(so.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(so.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_orders so
        INNER JOIN ops_proveedores s ON s.id = so.supplier_id
        WHERE so.id = ?
        LIMIT 1
      `,
      [orderId]
    );

    return {
      draft: {
        ...draft,
        status: 'confirmed'
      },
      order: orderRows[0] || null,
      items: itemRows
    };
  });
}

export async function findSupplierDraftItemById(draftId, itemId) {
  await ensureSupplierTables();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        draft_id,
        product_id,
        product_name,
        quantity,
        unit_cost,
        line_total,
        source,
        notes,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
      FROM ops_supplier_order_draft_items
      WHERE draft_id = ?
        AND id = ?
      LIMIT 1
    `,
    [draftId, itemId]
  );

  return rows[0] || null;
}

export async function updateSupplierDraftItemQuantity({
  draftId,
  itemId,
  quantity
}) {
  await ensureSupplierTables();

  return withTransaction(async (connection) => {
    const [rows] = await connection.query(
      `
        SELECT id, quantity, unit_cost
        FROM ops_supplier_order_draft_items
        WHERE draft_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [draftId, itemId]
    );
    const item = rows[0] || null;
    if (!item) {
      return null;
    }

    const nextQuantity = Number(quantity);
    const nextLineTotal = Number((nextQuantity * Number(item.unit_cost || 0)).toFixed(2));

    await connection.query(
      `
        UPDATE ops_supplier_order_draft_items
        SET quantity = ?,
            line_total = ?
        WHERE id = ?
      `,
      [nextQuantity, nextLineTotal, itemId]
    );

    await connection.query(
      `
        UPDATE ops_supplier_order_drafts
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [draftId]
    );

    const [updatedRows] = await connection.query(
      `
        SELECT
          id,
          draft_id,
          product_id,
          product_name,
          quantity,
          unit_cost,
          line_total,
          source,
          notes,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
        FROM ops_supplier_order_draft_items
        WHERE id = ?
        LIMIT 1
      `,
      [itemId]
    );

    return updatedRows[0] || null;
  });
}

export async function deleteSupplierDraftItem({ draftId, itemId }) {
  await ensureSupplierTables();

  return withTransaction(async (connection) => {
    const [existingRows] = await connection.query(
      `
        SELECT id
        FROM ops_supplier_order_draft_items
        WHERE draft_id = ?
          AND id = ?
        LIMIT 1
      `,
      [draftId, itemId]
    );
    const existing = existingRows[0] || null;
    if (!existing) {
      return false;
    }

    await connection.query(
      `
        DELETE FROM ops_supplier_order_draft_items
        WHERE id = ?
      `,
      [itemId]
    );

    await connection.query(
      `
        UPDATE ops_supplier_order_drafts
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [draftId]
    );

    return true;
  });
}
