import { Router } from 'express';
import { healthController } from '../modules/health/health.controller.js';

const router = Router();

router.get('/health', healthController);

export default router;
