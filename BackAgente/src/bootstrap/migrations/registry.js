import { migration as migration20260422WebUsersSupportTables } from './files/20260422_001_web_users_support_tables.js';
import { migration as migration20260422WebOrdersSchema } from './files/20260422_002_web_orders_schema.js';
import { migration as migration20260422ProductMediaTable } from './files/20260422_003_product_media_table.js';

export const migrationsRegistry = [
  migration20260422WebUsersSupportTables,
  migration20260422WebOrdersSchema,
  migration20260422ProductMediaTable
].sort((a, b) => String(a.key).localeCompare(String(b.key)));
