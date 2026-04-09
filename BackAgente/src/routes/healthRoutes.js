import { Router } from 'express';
import { checkDatabaseConnection } from '../config/db.js';

const router = Router();

router.get('/health', async (_req, res) => {
  const database = await checkDatabaseConnection();

  res.json({
    status: 'ok',
    database
  });
});

export default router;
