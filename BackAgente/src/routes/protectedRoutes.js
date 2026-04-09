import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/profile', authMiddleware, (req, res) => {
  res.json({
    message: 'Ruta protegida activa',
    user: req.user
  });
});

export default router;
