import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (email !== 'admin@agente.dev' || password !== '123456') {
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }

  const user = {
    id: 1,
    name: 'Admin Agente',
    email
  };

  const token = jwt.sign(user, env.jwtAccessSecret, { expiresIn: env.accessTokenTtl });

  return res.json({ token, user });
});

export default router;
