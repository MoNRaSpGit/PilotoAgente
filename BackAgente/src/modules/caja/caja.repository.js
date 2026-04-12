import { pool } from '../../config/db.js';

const CASHBOX_COLUMNS = `
  id,
  opening_amount,
  sales_total,
  payments_total,
  DATE_FORMAT(opened_at, '%Y-%m-%d %H:%i:%s') AS opened_at,
  DATE_FORMAT(closed_at, '%Y-%m-%d %H:%i:%s') AS closed_at,
  opened_by_user_id,
  opened_by_name,
  opened_by_role,
  status
`;

const CASHBOX_MOVEMENT_COLUMNS = `
  id,
  caja_id,
  type,
  amount,
  description,
  source,
  operator_id,
  operator_name,
  operator_role,
  metadata,
  DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
`;

const CASHBOX_ITEM_COLUMNS = `
  id,
  movement_id,
  barcode,
  product_name,
  quantity,
  unit_price,
  total,
  DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
`;

const CASHBOX_SUMMARY_CACHE_TTL_MS = 5000;
const CASHBOX_OBJECTIVES_CACHE_TTL_MS = 15000;
const BUSINESS_TIMEZONE = 'America/Montevideo';
const BUSINESS_UTC_OFFSET = '-03:00';
let cashboxTablesPromise = null;
const cashboxSummaryCache = new Map();
const cashboxObjectivesCache = new Map();

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

function normalizeDateInput(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatBusinessDate(parsed);
}

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

function getBusinessTodayDate() {
  return formatBusinessDate(new Date());
}

function businessDateTimeToUtcString(dateString, timeString = '00:00:00') {
  const parsed = new Date(`${dateString}T${timeString}${BUSINESS_UTC_OFFSET}`);

  if (Number.isNaN(parsed.getTime())) {
    return `${dateString} ${timeString}`;
  }

  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}

function getUtcRangeForBusinessDates(startDate, endDateExclusive) {
  return {
    startUtc: businessDateTimeToUtcString(startDate, '00:00:00'),
    endUtc: businessDateTimeToUtcString(endDateExclusive, '00:00:00')
  };
}

function utcStringToBusinessDate(value) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const hasTimezone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(normalized);
  const parsed = new Date(hasTimezone ? normalized : `${normalized}Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatBusinessDate(parsed);
}

function addDays(dateString, days) {
  const baseDate = new Date(`${dateString}T00:00:00Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + days);
  return baseDate.toISOString().slice(0, 10);
}

function addMonths(dateString, months) {
  const baseDate = new Date(`${dateString}T00:00:00Z`);
  baseDate.setUTCMonth(baseDate.getUTCMonth() + months);
  return baseDate.toISOString().slice(0, 10);
}

function startOfWeek(dateString) {
  const baseDate = new Date(`${dateString}T00:00:00Z`);
  const dayIndex = baseDate.getUTCDay();
  const offset = (dayIndex + 6) % 7;
  baseDate.setUTCDate(baseDate.getUTCDate() - offset);
  return baseDate.toISOString().slice(0, 10);
}

function diffInDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.max(0, Math.round((end - start) / 86400000));
}

function clearCashboxSummaryCache() {
  cashboxSummaryCache.clear();
  cashboxObjectivesCache.clear();
}

function getCashboxSummaryCacheKey(date, compareTo) {
  return `${date || ''}::${compareTo || ''}`;
}

function getCachedCashboxSummary(date, compareTo) {
  const key = getCashboxSummaryCacheKey(date, compareTo);
  const entry = cashboxSummaryCache.get(key);

  if (!entry || entry.expiresAt <= Date.now()) {
    cashboxSummaryCache.delete(key);
    return null;
  }

  return entry.value;
}

function setCachedCashboxSummary(date, compareTo, value) {
  const key = getCashboxSummaryCacheKey(date, compareTo);
  cashboxSummaryCache.set(key, {
    value,
    expiresAt: Date.now() + CASHBOX_SUMMARY_CACHE_TTL_MS
  });
}

function getCashboxObjectivesCacheKey(date, compareTo) {
  return `${date || ''}::${compareTo || ''}`;
}

function getCachedCashboxObjectives(date, compareTo) {
  const key = getCashboxObjectivesCacheKey(date, compareTo);
  const entry = cashboxObjectivesCache.get(key);

  if (!entry || entry.expiresAt <= Date.now()) {
    cashboxObjectivesCache.delete(key);
    return null;
  }

  return entry.value;
}

function setCachedCashboxObjectives(date, compareTo, value) {
  const key = getCashboxObjectivesCacheKey(date, compareTo);
  cashboxObjectivesCache.set(key, {
    value,
    expiresAt: Date.now() + CASHBOX_OBJECTIVES_CACHE_TTL_MS
  });
}

export async function ensureCashboxTables() {
  if (cashboxTablesPromise) {
    return cashboxTablesPromise;
  }

  cashboxTablesPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_cajas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        opening_amount DECIMAL(12,2) NOT NULL,
        sales_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        payments_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME NULL,
        opened_by_user_id INT NULL,
        opened_by_name VARCHAR(140) NOT NULL,
        opened_by_role VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cajas_status_opened_at (status, opened_at),
        INDEX idx_cajas_opened_by (opened_by_user_id, opened_at)
      )
    `);

    const [openedAtIndex] = await pool.query(
      `
        SELECT COUNT(*) AS count
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'ops_cajas'
          AND INDEX_NAME = 'idx_cajas_opened_at'
      `
    );

    if (!openedAtIndex[0]?.count) {
      await pool.query(`
        ALTER TABLE ops_cajas
        ADD INDEX idx_cajas_opened_at (opened_at)
      `);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_caja_movimientos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caja_id INT NOT NULL,
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        description VARCHAR(255) NULL,
        source VARCHAR(40) NOT NULL DEFAULT 'manual',
        operator_id INT NULL,
        operator_name VARCHAR(140) NULL,
        operator_role VARCHAR(20) NULL,
        metadata LONGTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_caja_movimientos_caja_fecha (caja_id, created_at),
        INDEX idx_caja_movimientos_type_fecha (type, created_at),
        CONSTRAINT fk_caja_movimientos_caja
          FOREIGN KEY (caja_id) REFERENCES ops_cajas(id)
          ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_caja_movimiento_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        movement_id INT NOT NULL,
        barcode VARCHAR(120) NULL,
        product_name VARCHAR(190) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_caja_items_movement (movement_id),
        INDEX idx_caja_items_barcode (barcode),
        CONSTRAINT fk_caja_items_movement
          FOREIGN KEY (movement_id) REFERENCES ops_caja_movimientos(id)
          ON DELETE CASCADE
      )
    `);

    const [itemsBarcodeIndex] = await pool.query(
      `
        SELECT COUNT(*) AS count
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'ops_caja_movimiento_items'
          AND INDEX_NAME = 'idx_caja_items_barcode'
      `
    );

    if (!itemsBarcodeIndex[0]?.count) {
      await pool.query(`
        ALTER TABLE ops_caja_movimiento_items
        ADD INDEX idx_caja_items_barcode (barcode)
      `);
    }
  })();

  try {
    await cashboxTablesPromise;
  } catch (error) {
    cashboxTablesPromise = null;
    throw error;
  }
}

export async function findOpenCashbox() {
  await ensureCashboxTables();

  const [rows] = await pool.query(
    `
      SELECT ${CASHBOX_COLUMNS}
      FROM ops_cajas
      WHERE status = 'open'
      ORDER BY opened_at DESC, id DESC
      LIMIT 1
    `
  );

  return toCashboxViewModel(rows[0] || null);
}

function toCashboxViewModel(row) {
  if (!row) {
    return null;
  }

  const openingAmount = Number(row.opening_amount || 0);
  const salesTotal = Number(row.sales_total || 0);
  const paymentsTotal = Number(row.payments_total || 0);
  const currentAmount = Number((openingAmount + salesTotal - paymentsTotal).toFixed(2));

  return {
    ...row,
    opening_amount: openingAmount,
    sales_total: salesTotal,
    payments_total: paymentsTotal,
    current_amount: currentAmount
  };
}

async function loadCashboxById(connection, cajaId) {
  const [rows] = await connection.query(
    `
      SELECT ${CASHBOX_COLUMNS}
      FROM ops_cajas
      WHERE id = ?
      LIMIT 1
    `,
    [cajaId]
  );

  return toCashboxViewModel(rows[0] || null);
}

async function loadCashboxRowsInRange(connection, startDate, endDateExclusive) {
  const { startUtc, endUtc } = getUtcRangeForBusinessDates(startDate, endDateExclusive);
  const [rows] = await connection.query(
    `
      SELECT ${CASHBOX_COLUMNS}
      FROM ops_cajas
      WHERE opened_at >= ? AND opened_at < ?
      ORDER BY opened_at ASC, id ASC
    `,
    [startUtc, endUtc]
  );

  return rows;
}

function buildPeriodSummaryFromRows(rows, startDate, endDateExclusive) {
  const { startUtc, endUtc } = getUtcRangeForBusinessDates(startDate, endDateExclusive);
  const matchingRows = rows.filter((row) => row.opened_at >= startUtc && row.opened_at < endUtc);

  if (matchingRows.length === 0) {
    return buildEmptyPeriodSummary(startDate, startDate, endDateExclusive);
  }

  const openingAmount = Number(
    matchingRows.reduce((accumulator, row) => accumulator + Number(row.opening_amount || 0), 0).toFixed(2)
  );
  const salesTotal = Number(
    matchingRows.reduce((accumulator, row) => accumulator + Number(row.sales_total || 0), 0).toFixed(2)
  );
  const paymentsTotal = Number(
    matchingRows.reduce((accumulator, row) => accumulator + Number(row.payments_total || 0), 0).toFixed(2)
  );
  const latestRow = matchingRows[matchingRows.length - 1];
  const currentAmount = Number((openingAmount + salesTotal - paymentsTotal).toFixed(2));

  return {
    date: startDate,
    range_start: startDate,
    range_end: endDateExclusive,
    opening_amount: openingAmount,
    sales_total: salesTotal,
    payments_total: paymentsTotal,
    profit_amount: calculateProfitAmount(salesTotal, paymentsTotal),
    current_amount: currentAmount,
    status: latestRow.status || 'closed',
    opened_at: latestRow.opened_at || null,
    closed_at: latestRow.closed_at || null,
    opened_by_name: latestRow.opened_by_name || null,
    opened_by_role: latestRow.opened_by_role || null
  };
}

async function createMovement(connection, payload) {
  const [result] = await connection.query(
    `
      INSERT INTO ops_caja_movimientos (
        caja_id,
        type,
        amount,
        description,
        source,
        operator_id,
        operator_name,
        operator_role,
        metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.cajaId,
      payload.type,
      payload.amount,
      payload.description || null,
      payload.source || 'manual',
      payload.operatorId || null,
      payload.operatorName || null,
      payload.operatorRole || null,
      payload.metadata || null
    ]
  );

  return result.insertId;
}

async function insertMovementItems(connection, movementId, items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const values = items.map((item) => [
    movementId,
    item.barcode || null,
    item.product_name,
    item.quantity,
    item.unit_price,
    item.total
  ]);

  const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
  const flattened = values.flat();

  await connection.query(
    `
      INSERT INTO ops_caja_movimiento_items (
        movement_id,
        barcode,
        product_name,
        quantity,
        unit_price,
        total
      )
      VALUES ${placeholders}
    `,
    flattened
  );

  return values;
}

export async function createCashbox({ openingAmount, operator }) {
  const result = await withTransaction(async (connection) => {
    const [openRows] = await connection.query(
      `
        SELECT ${CASHBOX_COLUMNS}
        FROM ops_cajas
        WHERE status = 'open'
        ORDER BY opened_at DESC, id DESC
        LIMIT 1
      `
    );

    if (openRows[0]) {
      const error = new Error('Ya hay una caja abierta');
      error.status = 409;
      error.item = toCashboxViewModel(openRows[0]);
      throw error;
    }

    const [result] = await connection.query(
      `
        INSERT INTO ops_cajas (
          opening_amount,
          sales_total,
          payments_total,
          opened_by_user_id,
          opened_by_name,
          opened_by_role,
          status
        )
        VALUES (?, 0, 0, ?, ?, ?, 'open')
      `,
      [
        openingAmount,
        operator?.id || null,
        operator?.name || 'Usuario',
        operator?.role || 'operario'
      ]
    );

    const cajaId = result.insertId;

    await createMovement(connection, {
      cajaId,
      type: 'opening',
      amount: openingAmount,
      description: 'Apertura de caja',
      source: 'cashbox',
      operatorId: operator?.id || null,
      operatorName: operator?.name || null,
      operatorRole: operator?.role || null,
      metadata: JSON.stringify({
        opening_amount: openingAmount
      })
    });

    return loadCashboxById(connection, cajaId);
  });

  clearCashboxSummaryCache();
  return result;
}

export async function closeCashbox({ operator }) {
  const result = await withTransaction(async (connection) => {
    const [openRows] = await connection.query(
      `
        SELECT ${CASHBOX_COLUMNS}
        FROM ops_cajas
        WHERE status = 'open'
        ORDER BY opened_at DESC, id DESC
        LIMIT 1
      `
    );

    const caja = toCashboxViewModel(openRows[0] || null);

    if (!caja) {
      const error = new Error('No hay una caja abierta');
      error.status = 409;
      throw error;
    }

    await connection.query(
      `
        UPDATE ops_cajas
        SET status = 'closed',
            closed_at = NOW()
        WHERE id = ?
      `,
      [caja.id]
    );

    await createMovement(connection, {
      cajaId: caja.id,
      type: 'close',
      amount: 0,
      description: 'Cierre de caja',
      source: 'cashbox',
      operatorId: operator?.id || null,
      operatorName: operator?.name || null,
      operatorRole: operator?.role || null,
      metadata: JSON.stringify({
        closing_amount: caja.current_amount
      })
    });

    return loadCashboxById(connection, caja.id);
  });

  clearCashboxSummaryCache();
  return result;
}

export async function recordCashboxSale({
  amount,
  items = [],
  operator,
  source = 'scanner',
  description = 'Venta desde escaner',
  includeCashbox = true
}) {
  const saleItems = Array.isArray(items)
    ? items.map((item) => ({
        barcode: item.barcode || null,
        product_name: String(item.name || item.product_name || 'Producto').trim() || 'Producto',
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.price || item.unit_price || 0),
        total: Number(item.total || 0)
      }))
    : [];

  const computedAmount = saleItems.length > 0
    ? saleItems.reduce((accumulator, item) => accumulator + Number(item.total || 0), 0)
    : Number(amount || 0);

  const saleAmount = Number(computedAmount.toFixed(2));

  if (!Number.isFinite(saleAmount) || saleAmount <= 0) {
    const error = new Error('Monto valido requerido');
    error.status = 400;
    throw error;
  }

  const result = await withTransaction(async (connection) => {
    const [openRows] = await connection.query(
      `
        SELECT ${CASHBOX_COLUMNS}
        FROM ops_cajas
        WHERE status = 'open'
        ORDER BY opened_at DESC, id DESC
        LIMIT 1
      `
    );

    const caja = toCashboxViewModel(openRows[0] || null);

    if (!caja) {
      const error = new Error('Primero debés abrir la caja');
      error.status = 409;
      throw error;
    }

    const movementId = await createMovement(connection, {
      cajaId: caja.id,
      type: 'sale',
      amount: saleAmount,
      description,
      source,
      operatorId: operator?.id || null,
      operatorName: operator?.name || null,
      operatorRole: operator?.role || null,
      metadata: JSON.stringify({
        amount: saleAmount,
        source,
        items_count: saleItems.length
      })
    });

    if (saleItems.length > 0) {
      await insertMovementItems(connection, movementId, saleItems);
    }

    await connection.query(
      `
        UPDATE ops_cajas
        SET sales_total = sales_total + ?
        WHERE id = ?
      `,
      [saleAmount, caja.id]
    );

    const cajaView = includeCashbox ? await loadCashboxById(connection, caja.id) : null;

    return {
      caja: cajaView,
      caja_id: caja.id,
      movement_id: movementId
    };
  });

  clearCashboxSummaryCache();
  return result;
}

export async function recordCashboxPayment({ amount, description, operator }) {
  const paymentAmount = Number(amount);

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    const error = new Error('Monto valido requerido');
    error.status = 400;
    throw error;
  }

  const result = await withTransaction(async (connection) => {
    const [openRows] = await connection.query(
      `
        SELECT ${CASHBOX_COLUMNS}
        FROM ops_cajas
        WHERE status = 'open'
        ORDER BY opened_at DESC, id DESC
        LIMIT 1
      `
    );

    const caja = toCashboxViewModel(openRows[0] || null);

    if (!caja) {
      const error = new Error('Primero debés abrir la caja');
      error.status = 409;
      throw error;
    }

    const movementId = await createMovement(connection, {
      cajaId: caja.id,
      type: 'payment',
      amount: paymentAmount,
      description: String(description || '').trim() || 'Pago registrado',
      source: 'cashbox',
      operatorId: operator?.id || null,
      operatorName: operator?.name || null,
      operatorRole: operator?.role || null,
      metadata: JSON.stringify({
        description: String(description || '').trim() || 'Pago registrado'
      })
    });

    await connection.query(
      `
        UPDATE ops_cajas
        SET payments_total = payments_total + ?
        WHERE id = ?
      `,
      [paymentAmount, caja.id]
    );

    return {
      caja: await loadCashboxById(connection, caja.id),
      movement_id: movementId
    };
  });

  clearCashboxSummaryCache();
  return result;
}

function buildEmptyPeriodSummary(date, rangeStart = null, rangeEnd = null) {
  return {
    date,
    range_start: rangeStart,
    range_end: rangeEnd,
    opening_amount: 0,
    sales_total: 0,
    payments_total: 0,
    profit_amount: 0,
    current_amount: 0,
    status: 'empty',
    opened_at: null,
    closed_at: null
  };
}

function enrichPeriodSummary(date, rangeStart, rangeEnd, caja) {
  if (!caja) {
    return buildEmptyPeriodSummary(date, rangeStart, rangeEnd);
  }

  return {
    date,
    range_start: rangeStart,
    range_end: rangeEnd,
    opening_amount: caja.opening_amount,
    sales_total: caja.sales_total,
    payments_total: caja.payments_total,
    profit_amount: calculateProfitAmount(caja.sales_total, caja.payments_total),
    current_amount: caja.current_amount,
    status: caja.status,
    opened_at: caja.opened_at,
    closed_at: caja.closed_at,
    opened_by_name: caja.opened_by_name,
    opened_by_role: caja.opened_by_role
  };
}

function calculateComparisonPercent(currentSales, previousSales) {
  if (previousSales <= 0) {
    return null;
  }

  return Number((((currentSales - previousSales) / previousSales) * 100).toFixed(2));
}

function calculateProfitAmount(salesTotal, paymentsTotal) {
  return Number(((Number(salesTotal || 0) - Number(paymentsTotal || 0)) * 0.2).toFixed(2));
}

async function loadMovementItemsMap(connection, movementIds = []) {
  if (!Array.isArray(movementIds) || movementIds.length === 0) {
    return new Map();
  }

  const placeholders = movementIds.map(() => '?').join(', ');
  const [rows] = await connection.query(
    `
      SELECT ${CASHBOX_ITEM_COLUMNS}
      FROM ops_caja_movimiento_items
      WHERE movement_id IN (${placeholders})
      ORDER BY movement_id ASC, id ASC
    `,
    movementIds
  );

  const itemsMap = new Map();

  rows.forEach((row) => {
    const normalizedItem = {
      id: row.id,
      barcode: row.barcode || null,
      product_name: row.product_name || 'Producto',
      quantity: Number(row.quantity || 1),
      unit_price: Number(row.unit_price || 0),
      total: Number(row.total || 0),
      created_at: row.created_at || null
    };

    const currentItems = itemsMap.get(row.movement_id) || [];
    currentItems.push(normalizedItem);
    itemsMap.set(row.movement_id, currentItems);
  });

  return itemsMap;
}

async function loadRecentSaleMovements(connection, startDate, endDateExclusive, limit = 6) {
  const hasLimit = Number.isFinite(Number(limit)) && Number(limit) > 0;
  const safeLimit = hasLimit ? Math.floor(Number(limit)) : null;
  const { startUtc, endUtc } = getUtcRangeForBusinessDates(startDate, endDateExclusive);
  const sql = `
      SELECT ${CASHBOX_MOVEMENT_COLUMNS}
      FROM ops_caja_movimientos
      WHERE type IN ('sale', 'payment')
        AND created_at >= ?
        AND created_at < ?
      ORDER BY created_at DESC, id DESC
      ${hasLimit ? 'LIMIT ?' : ''}
    `;
  const params = hasLimit
    ? [startUtc, endUtc, safeLimit]
    : [startUtc, endUtc];
  const [rows] = await connection.query(sql, params);

  if (!rows.length) {
    return [];
  }

  const movementIds = rows.map((row) => row.id);
  const itemsMap = await loadMovementItemsMap(connection, movementIds);

  return rows.map((row) => ({
    id: row.id,
    movement_id: row.id,
    type: row.type,
    amount: Number(row.amount || 0),
    description: row.description || (row.type === 'payment' ? 'Pago registrado' : 'Venta desde escaner'),
    source: row.source || 'scanner',
    operator: {
      id: row.operator_id || null,
      name: row.operator_name || 'Operario',
      role: row.operator_role || null
    },
    operator_name: row.operator_name || 'Operario',
    operator_role: row.operator_role || null,
    created_at: row.created_at || null,
    items: itemsMap.get(row.id) || []
  }));
}

export async function listCashboxSaleMovements({ date, limit } = {}) {
  await ensureCashboxTables();
  const selectedDate = normalizeDateInput(date) || getBusinessTodayDate();
  const selectedDayEnd = addDays(selectedDate, 1);
  const movementLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.floor(Number(limit)) : null;
  const movements = await loadRecentSaleMovements(pool, selectedDate, selectedDayEnd, movementLimit);

  return {
    selected_date: selectedDate,
    items: movements
  };
}

export async function getCashboxSummary({ date, compareTo, forceRefresh = false } = {}) {
  await ensureCashboxTables();

  const selectedDate = normalizeDateInput(date) || getBusinessTodayDate();
  const comparisonDate = normalizeDateInput(compareTo) || addDays(selectedDate, -1);

  const cached = forceRefresh ? null : getCachedCashboxSummary(selectedDate, comparisonDate);
  if (cached) {
    return cached;
  }

  const selectedDayEnd = addDays(selectedDate, 1);
  const comparisonDayEnd = addDays(comparisonDate, 1);

  const weekStart = startOfWeek(selectedDate);
  const selectedWeekDays = diffInDays(weekStart, selectedDate) + 1;
  const previousWeekStart = addDays(weekStart, -selectedWeekDays);
  const previousWeekEnd = weekStart;

  const monthStart = selectedDate.slice(0, 7).concat('-01');
  const selectedMonthDays = diffInDays(monthStart, selectedDate) + 1;
  const previousMonthStart = addMonths(monthStart, -1);
  const previousMonthEnd = addDays(previousMonthStart, selectedMonthDays);

  const [periodRows, openBox, recentMovements] = await Promise.all([
    loadCashboxRowsInRange(pool, previousMonthStart, selectedDayEnd),
    findOpenCashbox(),
    loadRecentSaleMovements(pool, selectedDate, selectedDayEnd, 6)
  ]);

  const previousDay = buildPeriodSummaryFromRows(periodRows, comparisonDate, comparisonDayEnd);
  const currentWeek = buildPeriodSummaryFromRows(periodRows, weekStart, selectedDayEnd);
  const previousWeek = buildPeriodSummaryFromRows(periodRows, previousWeekStart, previousWeekEnd);
  const currentMonth = buildPeriodSummaryFromRows(periodRows, monthStart, selectedDayEnd);
  const previousMonth = buildPeriodSummaryFromRows(periodRows, previousMonthStart, previousMonthEnd);

  const selectedDay = openBox
    ? enrichPeriodSummary(selectedDate, selectedDate, selectedDayEnd, openBox)
    : buildEmptyPeriodSummary(selectedDate, selectedDate, selectedDayEnd);

  const comparisonPercent = calculateComparisonPercent(selectedDay.sales_total, previousDay.sales_total);
  const weeklyComparisonPercent = calculateComparisonPercent(currentWeek.sales_total, previousWeek.sales_total);
  const monthlyComparisonPercent = calculateComparisonPercent(currentMonth.sales_total, previousMonth.sales_total);

  const result = {
    is_open: Boolean(openBox),
    open_cashbox: openBox,
    selected_date: selectedDate,
    comparison_date: comparisonDate,
    selected_day: selectedDay,
    recent_movements: recentMovements,
    previous_day: previousDay,
    comparison_percent: comparisonPercent,
    weekly: {
      current: currentWeek,
      previous: previousWeek,
      comparison_percent: weeklyComparisonPercent,
      current_range: {
        start: weekStart,
        end: selectedDayEnd
      },
      previous_range: {
        start: previousWeekStart,
        end: previousWeekEnd
      }
    },
    monthly: {
      current: currentMonth,
      previous: previousMonth,
      comparison_percent: monthlyComparisonPercent,
      current_range: {
        start: monthStart,
        end: selectedDayEnd
      },
      previous_range: {
        start: previousMonthStart,
        end: previousMonthEnd
      }
    }
  };

  setCachedCashboxSummary(selectedDate, comparisonDate, result);

  return result;
}

export async function getCashboxObjectivesSummary({ date, compareTo, forceRefresh = false } = {}) {
  await ensureCashboxTables();

  const requestedSelectedDate = normalizeDateInput(date) || getBusinessTodayDate();
  const requestedComparisonDate = normalizeDateInput(compareTo) || addDays(requestedSelectedDate, -1);

  const cached = forceRefresh ? null : getCachedCashboxObjectives(requestedSelectedDate, requestedComparisonDate);
  if (cached) {
    return cached;
  }

  const openCashbox = await findOpenCashbox();
  const selectedDate = openCashbox?.opened_at
    ? utcStringToBusinessDate(openCashbox.opened_at) || requestedSelectedDate
    : requestedSelectedDate;
  const [previousClosedRows] = openCashbox
    ? await pool.query(
        `
          SELECT
            DATE_FORMAT(closed_at, '%Y-%m-%d %H:%i:%s') AS closed_at,
            sales_total
          FROM ops_cajas
          WHERE status = 'closed'
            AND closed_at IS NOT NULL
            AND closed_at <= ?
          ORDER BY closed_at DESC, id DESC
          LIMIT 1
        `,
        [openCashbox.opened_at]
      )
    : await pool.query(
        `
          SELECT
            DATE_FORMAT(closed_at, '%Y-%m-%d %H:%i:%s') AS closed_at,
            sales_total
          FROM ops_cajas
          WHERE status = 'closed'
            AND closed_at IS NOT NULL
          ORDER BY closed_at DESC, id DESC
          LIMIT 1
        `
      );

  const previousClosed = previousClosedRows[0] || {};
  const comparisonDate = utcStringToBusinessDate(previousClosed?.closed_at) || requestedComparisonDate;
  const currentSales = Number(openCashbox?.sales_total || 0);
  const comparisonSales = Number(previousClosed.sales_total || 0);

  const result = {
    selected_date: selectedDate,
    comparison_date: comparisonDate,
    is_open: Boolean(openCashbox),
    selected_day: {
      opening_amount: Number(openCashbox?.opening_amount || 0),
      sales_total: currentSales,
      payments_total: Number(openCashbox?.payments_total || 0)
    },
    previous_day: {
      sales_total: comparisonSales
    },
    comparison_percent: calculateComparisonPercent(currentSales, comparisonSales)
  };

  setCachedCashboxObjectives(requestedSelectedDate, requestedComparisonDate, result);

  return result;
}
