import { ensureUsersTable, seedDemoUsers } from '../modules/auth/auth.repository.js';
import { ensureCashboxTables } from '../modules/caja/caja.repository.js';
import { ensureClientHistoryTable, ensureClientsTable } from '../modules/clients/client.repository.js';
import { ensureCategoriesTable } from '../modules/categories/category.repository.js';
import { ensureExpenseTables } from '../modules/gastos/gastos.repository.js';
import { ensureStockTables } from '../modules/stock/stock.repository.js';
import { seedSupplierStockDemo } from '../modules/stock/stock.service.js';
import { ensureSupplierTables } from '../modules/suppliers/supplier.repository.js';
import { ensureWebUsersTable, seedDemoWebUsers } from '../modules/webAuth/webAuth.repository.js';
import { ensureWebOrdersTables } from '../modules/webOrders/webOrders.repository.js';
import { ensureWebUsersSupportTables } from '../modules/webUsers/webUsers.repository.js';
import { env } from '../config/env.js';

export async function initDatabase() {
  await ensureUsersTable();
  await ensureClientsTable();
  await ensureClientHistoryTable();
  await ensureCashboxTables();
  await ensureExpenseTables();
  await ensureSupplierTables();
  await ensureCategoriesTable();
  await ensureStockTables();
  await ensureWebUsersTable();
  await seedDemoWebUsers();
  await ensureWebUsersSupportTables();
  await ensureWebOrdersTables();
  await seedDemoUsers();

  if (env.stockDemoSeedEnabled) {
    const seeded = await seedSupplierStockDemo({
      limit: env.stockDemoSeedLimit
    });
    if (seeded.items.length > 0) {
      console.log(`[init] Seed stock demo aplicado en ${seeded.items.length} productos`);
    } else {
      console.log('[init] Seed stock demo activo, pero no encontro productos compatibles');
    }
  }
}
