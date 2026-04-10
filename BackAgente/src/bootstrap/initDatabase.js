import { ensureUsersTable, seedDemoUsers } from '../modules/auth/auth.repository.js';
import { ensureCashboxTables } from '../modules/caja/caja.repository.js';
import { ensureClientHistoryTable, ensureClientsTable } from '../modules/clients/client.repository.js';
import { ensureExpenseTables } from '../modules/gastos/gastos.repository.js';

export async function initDatabase() {
  await ensureUsersTable();
  await ensureClientsTable();
  await ensureClientHistoryTable();
  await ensureCashboxTables();
  await ensureExpenseTables();
  await seedDemoUsers();
}
