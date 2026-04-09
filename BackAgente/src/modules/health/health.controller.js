import { getHealthStatus } from './health.service.js';

export async function healthController(_req, res) {
  try {
    const data = await getHealthStatus();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      database: false,
      message: error.message || 'No se pudo comprobar el estado'
    });
  }
}
