import app from './app.js';
import { env } from './config/env.js';
import { initDatabase } from './bootstrap/initDatabase.js';

async function startServer() {
  await initDatabase();

  app.listen(env.port, () => {
    console.log(`BackAgente escuchando en http://localhost:${env.port}`);
  });
}

startServer().catch((error) => {
  console.error('No se pudo iniciar BackAgente:', error);
  process.exit(1);
});
