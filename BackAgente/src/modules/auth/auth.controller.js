import { loginWithCredentials } from './auth.service.js';

export async function loginController(req, res) {
  try {
    const { email, password } = req.body;
    const data = await loginWithCredentials(email, password);
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || 'No se pudo iniciar sesion'
    });
  }
}
