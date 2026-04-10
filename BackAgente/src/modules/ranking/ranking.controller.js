import { fetchCashboxRanking } from './ranking.service.js';

function handleServiceError(res, error, fallbackMessage) {
  const status = error.status || 500;

  return res.status(status).json({
    message: error.message || fallbackMessage
  });
}

export async function getCashboxRankingController(req, res) {
  try {
    const data = await fetchCashboxRanking(req.query);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo obtener el ranking de productos');
  }
}
