import { env } from '../../config/env.js';

function createServiceError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sanitizePhone(phone) {
  const normalized = String(phone || '').trim().replace(/[^\d]/g, '');
  return normalized;
}

export async function sendWebWhatsappTest({ to, message }) {
  if (!env.whatsappEnabled) {
    throw createServiceError('WhatsApp deshabilitado en entorno', 503);
  }

  const accessToken = String(env.whatsappAccessToken || '').trim();
  const phoneNumberId = String(env.whatsappPhoneNumberId || '').trim();
  const recipient = sanitizePhone(to || env.whatsappDefaultTo);
  const text = String(message || 'hola desde la web').trim();

  if (!accessToken || !phoneNumberId || !recipient) {
    throw createServiceError('Configurar WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_DEFAULT_TO', 503);
  }

  if (!text) {
    throw createServiceError('Mensaje invalido', 400);
  }

  const endpoint = `https://graph.facebook.com/${encodeURIComponent(env.whatsappApiVersion)}/${encodeURIComponent(phoneNumberId)}/messages`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: {
        body: text
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const apiMessage = payload?.error?.message || 'Error enviando WhatsApp';
    throw createServiceError(apiMessage, response.status || 502);
  }

  return {
    item: {
      to: recipient,
      message: text,
      whatsapp_message_id: payload?.messages?.[0]?.id || null
    }
  };
}
