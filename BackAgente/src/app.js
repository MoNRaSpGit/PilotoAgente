import cors from 'cors';
import express from 'express';
import authRoutes from './routes/authRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import cajaRoutes from './routes/cajaRoutes.js';
import gastosRoutes from './routes/gastosRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import productRoutes from './routes/productRoutes.js';
import protectedRoutes from './routes/protectedRoutes.js';
import { env } from './config/env.js';

const app = express();

app.use(
  cors({
    origin: env.clientUrl
  })
);
app.use(express.json());

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

export default app;
