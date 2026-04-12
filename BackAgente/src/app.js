import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { registerAppRoutes } from './app.routes.js';

const app = express();

app.use(
  cors({
    origin: env.clientUrl
  })
);
app.use(express.json());

registerAppRoutes(app);

export default app;
