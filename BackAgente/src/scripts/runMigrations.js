import { runMigrations } from '../bootstrap/migrations/runMigrations.js';

async function main() {
  await runMigrations();
  console.log('[migrations] Database schema is up to date');
}

main().catch((error) => {
  console.error('[migrations] Failed:', error?.message || error);
  process.exit(1);
});
