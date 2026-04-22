import { migration as migration20260422WebUsersSupportTables } from './files/20260422_001_web_users_support_tables.js';
import { migration as migration20260422WebOrdersSchema } from './files/20260422_002_web_orders_schema.js';

export const migrationsRegistry = [
  migration20260422WebUsersSupportTables,
  migration20260422WebOrdersSchema
].sort((a, b) => String(a.key).localeCompare(String(b.key)));
