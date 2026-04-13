import authRoutes from './routes/authRoutes.js';
import cajaRoutes from './routes/cajaRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import gastosRoutes from './routes/gastosRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import productRoutes from './routes/productRoutes.js';
import protectedRoutes from './routes/protectedRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';

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
  app.use('/api', supplierRoutes);
}
