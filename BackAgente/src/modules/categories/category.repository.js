import { pool } from '../../config/db.js';

let categoriesPromise = null;

function normalizeCategoryName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function toCategoryDisplayName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
}

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

async function foreignKeyExists(tableName, constraintName) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        AND CONSTRAINT_NAME = ?
    `,
    [tableName, constraintName]
  );

  return Boolean(rows[0]?.count);
}

async function upsertCategoryWithId(nombre, nombreNormalized) {
  const [result] = await pool.query(
    `
      INSERT INTO ops_categoria (nombre, nombre_normalized, estado)
      VALUES (?, ?, 'activo')
      ON DUPLICATE KEY UPDATE
        id = LAST_INSERT_ID(id),
        nombre = CASE
          WHEN nombre IS NULL OR nombre = '' THEN VALUES(nombre)
          ELSE nombre
        END,
        estado = 'activo'
    `,
    [nombre, nombreNormalized]
  );

  return Number(result.insertId);
}

async function migrateExistingProductCategories() {
  const [rows] = await pool.query(
    `
      SELECT id, categoria
      FROM ops_producto
      WHERE categoria IS NOT NULL
        AND TRIM(categoria) <> ''
    `
  );

  if (!rows.length) {
    return;
  }

  const categoriesByNormalized = new Map();

  for (const row of rows) {
    const normalized = normalizeCategoryName(row.categoria);
    if (!normalized) {
      continue;
    }

    if (categoriesByNormalized.has(normalized)) {
      continue;
    }

    const displayName = toCategoryDisplayName(row.categoria);
    const categoryId = await upsertCategoryWithId(displayName, normalized);
    categoriesByNormalized.set(normalized, {
      id: categoryId,
      nombre: displayName
    });
  }

  for (const row of rows) {
    const normalized = normalizeCategoryName(row.categoria);
    const match = categoriesByNormalized.get(normalized);

    if (!match?.id) {
      continue;
    }

    await pool.query(
      `
        UPDATE ops_producto
        SET categoria = ?, categoria_id = ?
        WHERE id = ?
      `,
      [match.nombre, match.id, row.id]
    );
  }
}

export async function ensureCategoriesTable() {
  if (categoriesPromise) {
    return categoriesPromise;
  }

  categoriesPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ops_categoria (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(140) NOT NULL,
        nombre_normalized VARCHAR(140) NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'activo',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_categoria_nombre_normalized (nombre_normalized),
        INDEX idx_categoria_estado (estado)
      )
    `);

    const hasCategoryId = await columnExists('ops_producto', 'categoria_id');
    if (!hasCategoryId) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD COLUMN categoria_id INT NULL AFTER categoria
      `);
    }

    const hasCategoryIndex = await indexExists('ops_producto', 'idx_producto_categoria_id');
    if (!hasCategoryIndex) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD INDEX idx_producto_categoria_id (categoria_id)
      `);
    }

    const hasEstadoIndex = await indexExists('ops_producto', 'idx_producto_estado');
    if (!hasEstadoIndex) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD INDEX idx_producto_estado (estado)
      `);
    }

    const hasEstadoCategoriaIndex = await indexExists('ops_producto', 'idx_producto_estado_categoria_id');
    if (!hasEstadoCategoriaIndex) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD INDEX idx_producto_estado_categoria_id (estado, categoria_id, id)
      `);
    }

    const hasCategoryFk = await foreignKeyExists('ops_producto', 'fk_producto_categoria');
    if (!hasCategoryFk) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD CONSTRAINT fk_producto_categoria
          FOREIGN KEY (categoria_id) REFERENCES ops_categoria(id)
          ON DELETE SET NULL
      `);
    }

    await migrateExistingProductCategories();
  })();

  try {
    await categoriesPromise;
  } catch (error) {
    categoriesPromise = null;
    throw error;
  }
}

export async function resolveCategoryIdByName(categoria) {
  await ensureCategoriesTable();

  const normalized = normalizeCategoryName(categoria);
  if (!normalized) {
    return null;
  }

  const displayName = toCategoryDisplayName(categoria);
  const categoryId = await upsertCategoryWithId(displayName, normalized);
  return categoryId || null;
}
