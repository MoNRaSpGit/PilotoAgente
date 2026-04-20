import app from './app.js';
import { env } from './config/env.js';
import { initDatabase } from './bootstrap/initDatabase.js';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function initDatabaseWithRetry() {
  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      await initDatabase();
      console.log(`[init] Base de datos lista (intento ${attempt})`);
      return;
    } catch (error) {
      console.error(`[init] Error inicializando base de datos (intento ${attempt}):`, error.message || error);
      await sleep(5000);
    }
  }
}

function startServer() {
  app.listen(env.port, () => {
    console.log(`BackAgente escuchando en http://localhost:${env.port}`);
  });

  initDatabaseWithRetry().catch((error) => {
    console.error('No se pudo iniciar inicializacion de base de datos:', error);
  });
}

startServer();
