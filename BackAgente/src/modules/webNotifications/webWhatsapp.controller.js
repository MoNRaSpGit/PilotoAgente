import { sendWebWhatsappTest } from './webWhatsapp.service.js';

function handleServiceError(res, error, fallbackMessage) {
  const status = error.status || 500;
  return res.status(status).json({
    message: error.message || fallbackMessage,
    ...(error.item ? { item: error.item } : {})
  });
}

export async function sendWebWhatsappTestController(req, res) {
  try {
    const data = await sendWebWhatsappTest({
      to: req.body?.to,
      message: req.body?.message
    });
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo enviar WhatsApp de prueba');
  }
}
