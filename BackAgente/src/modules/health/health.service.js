import { checkDatabaseConnection } from '../../config/db.js';

export async function getHealthStatus() {
  const database = await checkDatabaseConnection();

  return {
    status: 'ok',
    database
  };
}
