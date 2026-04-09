import { ensureUsersTable, seedDemoUsers } from '../modules/auth/auth.repository.js';
import { ensureClientHistoryTable, ensureClientsTable } from '../modules/clients/client.repository.js';

export async function initDatabase() {
  await ensureUsersTable();
  await ensureClientsTable();
  await ensureClientHistoryTable();
  await seedDemoUsers();
}
