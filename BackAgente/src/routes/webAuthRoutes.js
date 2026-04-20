import { Router } from 'express';
import {
  loginWebUserController,
  meWebUserController,
  registerWebUserController
} from '../modules/webAuth/webAuth.controller.js';
import { webAuthMiddleware } from '../modules/webAuth/webAuth.middleware.js';

const router = Router();

router.post('/web/auth/register', registerWebUserController);
router.post('/web/auth/login', loginWebUserController);
router.get('/web/auth/me', webAuthMiddleware, meWebUserController);

export default router;