import { Router } from 'express';
import { profileController } from '../modules/protected/protected.controller.js';
import { authMiddleware } from '../modules/auth/auth.middleware.js';

const router = Router();

router.get('/profile', authMiddleware, profileController);

export default router;
