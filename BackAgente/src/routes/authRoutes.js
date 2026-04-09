import { Router } from 'express';
import { loginController } from '../modules/auth/auth.controller.js';

const router = Router();

router.post('/login', loginController);

export default router;
