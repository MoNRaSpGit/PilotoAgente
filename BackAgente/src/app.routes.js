import authRoutes from './routes/authRoutes.js';
import cajaRoutes from './routes/cajaRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import gastosRoutes from './routes/gastosRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import productRoutes from './routes/productRoutes.js';
import protectedRoutes from './routes/protectedRoutes.js';

const optionalRoutes = [
  {
    id: 'stock',
    mountPath: '/api',
    modulePath: './routes/stockRoutes.js'
  },
  {
    id: 'suppliers',
    mountPath: '/api',
    modulePath: './routes/supplierRoutes.js'
  }
];

async function registerOptionalRoutes(app) {
  for (const route of optionalRoutes) {
    try {
      const loadedModule = await import(route.modulePath);
      const router = loadedModule?.default;

      if (typeof router === 'function') {
        app.use(route.mountPath, router);
      } else {
        console.warn(`[routes] ${route.id} loaded but has no default router export`);
      }
    } catch (error) {
      console.warn(`[routes] ${route.id} skipped: ${error?.code || 'load_error'}`);
    }
  }
}

export async function registerAppRoutes(app) {
  app.get('/', (_req, res) => {
    res.json({
      name: 'BackAgente',
      status: 'running'
    });
  });

  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api', clientRoutes);
  app.use('/api', cajaRoutes);
  app.use('/api', gastosRoutes);
  app.use('/api', productRoutes);
  app.use('/api', protectedRoutes);

  await registerOptionalRoutes(app);
}
