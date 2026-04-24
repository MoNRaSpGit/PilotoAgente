import { migration as migration20260422WebUsersSupportTables } from './files/20260422_001_web_users_support_tables.js';
import { migration as migration20260422WebOrdersSchema } from './files/20260422_002_web_orders_schema.js';
import { migration as migration20260422ProductMediaTable } from './files/20260422_003_product_media_table.js';
import { migration as migration20260422WebProductsQueryIndexes } from './files/20260422_004_web_products_query_indexes.js';
import { migration as migration20260422WebOrderItemsPedidoIdIdIdx } from './files/20260422_005_web_order_items_pedido_id_id_idx.js';
import { migration as migration20260424PushSubscriptionsTable } from './files/20260424_006_push_subscriptions_table.js';

export const migrationsRegistry = [
  migration20260422WebUsersSupportTables,
  migration20260422WebOrdersSchema,
  migration20260422ProductMediaTable,
  migration20260422WebProductsQueryIndexes,
  migration20260422WebOrderItemsPedidoIdIdIdx,
  migration20260424PushSubscriptionsTable
].sort((a, b) => String(a.key).localeCompare(String(b.key)));
