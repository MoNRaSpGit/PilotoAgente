import { pool } from '../../config/db.js';
import { migrationsRegistry } from './registry.js';

let migrationsRunPromise = null;

async function ensureMigrationsTable() {
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

async function runMigrationsInternal() {
  await ensureMigrationsTable();

  for (const migration of migrationsRegistry) {
    const migrationKey = String(migration?.key || '').trim();
    if (!migrationKey) {
      continue;
    }

    const executed = await hasExecutedMigration(migrationKey);
    if (executed) {
      continue;
    }

    await migration.up({ pool });
    await markMigrationExecuted(migrationKey);
    console.log(`[migrations] Applied ${migrationKey}`);
  }
}

export async function runMigrations() {
  if (migrationsRunPromise) {
    return migrationsRunPromise;
  }

  migrationsRunPromise = runMigrationsInternal();

  try {
    await migrationsRunPromise;
  } catch (error) {
    migrationsRunPromise = null;
    throw error;
  }
}
