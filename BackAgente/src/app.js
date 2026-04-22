import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { registerAppRoutes } from './app.routes.js';
import { observabilityRequestMiddleware } from './observability/telemetry.js';

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOrigins = [env.clientUrl, env.webClientUrl].filter(Boolean);
      callback(null, allowedOrigins.includes(origin));
    }
  })
);
app.use(observabilityRequestMiddleware);
app.use(express.json());

await registerAppRoutes(app);

export default app;
