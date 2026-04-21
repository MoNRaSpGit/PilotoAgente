import { pool } from '../../config/db.js';

let categoriesPromise = null;
const CATEGORY_NORMALIZATION_MIGRATION = 'ops_categories_normalization_v1';
const CATEGORY_RELATION_SYNC_MIGRATION = 'ops_categories_relation_sync_v1';

function normalizeCategoryName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function compactCategoryName(name) {
  return normalizeCategoryName(name).replace(/[\s_-]+/g, '');
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

async function ensureSchemaMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ops_schema_migrations (
      migration_key VARCHAR(140) PRIMARY KEY,
      executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function hasExecutedMigration(migrationKey) {
  const [rows] = await pool.query(
    `
      SELECT 1
      FROM ops_schema_migrations
      WHERE migration_key = ?
      LIMIT 1
    `,
    [migrationKey]
  );
  return rows.length > 0;
}

async function markMigrationExecuted(migrationKey) {
  await pool.query(
    `
      INSERT INTO ops_schema_migrations (migration_key)
      VALUES (?)
      ON DUPLICATE KEY UPDATE
        migration_key = VALUES(migration_key)
    `,
    [migrationKey]
  );
}

async function upsertCategoryWithId(nombre, nombreNormalized) {
  const nombreCompact = compactCategoryName(nombre);
  const [result] = await pool.query(
    `
      INSERT INTO ops_categoria (nombre, nombre_normalized, nombre_compact, estado)
      VALUES (?, ?, ?, 'activo')
      ON DUPLICATE KEY UPDATE
        id = LAST_INSERT_ID(id),
        nombre = CASE
          WHEN nombre IS NULL OR nombre = '' THEN VALUES(nombre)
          ELSE nombre
        END,
        nombre_compact = VALUES(nombre_compact),
        estado = 'activo'
    `,
    [nombre, nombreNormalized, nombreCompact]
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
        SET categoria = ?, categoria_compact = ?, categoria_id = ?
        WHERE id = ?
      `,
      [match.nombre, compactCategoryName(match.nombre), match.id, row.id]
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
        nombre_compact VARCHAR(140) NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'activo',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_categoria_nombre_normalized (nombre_normalized),
        INDEX idx_categoria_nombre_compact (nombre_compact),
        INDEX idx_categoria_estado (estado)
      )
    `);
    await ensureSchemaMigrationsTable();

    const hasCategoryCompact = await columnExists('ops_categoria', 'nombre_compact');
    if (!hasCategoryCompact) {
      await pool.query(`
        ALTER TABLE ops_categoria
        ADD COLUMN nombre_compact VARCHAR(140) NULL AFTER nombre_normalized
      `);
    }


    const hasCategoryCompactIndex = await indexExists('ops_categoria', 'idx_categoria_nombre_compact');
    if (!hasCategoryCompactIndex) {
      await pool.query(`
        ALTER TABLE ops_categoria
        ADD INDEX idx_categoria_nombre_compact (nombre_compact)
      `);
    }

    const hasCategoryId = await columnExists('ops_producto', 'categoria_id');
    if (!hasCategoryId) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD COLUMN categoria_id INT NULL AFTER categoria
      `);
    }

    const hasProductCategoryCompact = await columnExists('ops_producto', 'categoria_compact');
    if (!hasProductCategoryCompact) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD COLUMN categoria_compact VARCHAR(140) NULL AFTER categoria
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

    const hasEstadoCategoriaTextIndex = await indexExists('ops_producto', 'idx_producto_estado_categoria_text');
    if (!hasEstadoCategoriaTextIndex) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD INDEX idx_producto_estado_categoria_text (estado, categoria, id)
      `);
    }

    const hasEstadoCategoriaCompactIndex = await indexExists('ops_producto', 'idx_producto_estado_categoria_compact');
    if (!hasEstadoCategoriaCompactIndex) {
      await pool.query(`
        ALTER TABLE ops_producto
        ADD INDEX idx_producto_estado_categoria_compact (estado, categoria_compact, id)
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

    const normalizationDone = await hasExecutedMigration(CATEGORY_NORMALIZATION_MIGRATION);
    if (!normalizationDone) {
      await pool.query(`
        UPDATE ops_categoria
        SET nombre_compact = REPLACE(REPLACE(REPLACE(LOWER(TRIM(COALESCE(nombre_normalized, nombre, ''))), ' ', ''), '_', ''), '-', '')
        WHERE nombre_compact IS NULL OR TRIM(nombre_compact) = ''
      `);

      await pool.query(`
        UPDATE ops_categoria
        SET estado = LOWER(TRIM(COALESCE(estado, 'activo')))
        WHERE estado IS NULL OR estado <> LOWER(TRIM(COALESCE(estado, 'activo')))
      `);

      await pool.query(`
        UPDATE ops_producto
        SET categoria_compact = REPLACE(REPLACE(REPLACE(LOWER(TRIM(COALESCE(categoria, ''))), ' ', ''), '_', ''), '-', '')
        WHERE categoria_id IS NULL
          AND (categoria_compact IS NULL OR TRIM(categoria_compact) = '')
      `);

      await pool.query(`
        UPDATE ops_producto
        SET estado = LOWER(TRIM(COALESCE(estado, 'inactivo')))
        WHERE estado IS NULL OR estado <> LOWER(TRIM(COALESCE(estado, 'inactivo')))
      `);

      await markMigrationExecuted(CATEGORY_NORMALIZATION_MIGRATION);
    }

    const relationSyncDone = await hasExecutedMigration(CATEGORY_RELATION_SYNC_MIGRATION);
    if (!relationSyncDone) {
      await migrateExistingProductCategories();
      await markMigrationExecuted(CATEGORY_RELATION_SYNC_MIGRATION);
    }
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
