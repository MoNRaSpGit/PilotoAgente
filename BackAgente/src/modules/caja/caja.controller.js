import {
  addCashboxPayment,
  addCashboxSale,
  closeOpenCashbox,
  fetchCashboxDashboard,
  openCashbox
} from './caja.service.js';
import { attachCashboxStream, authenticateCashboxStream } from './caja.realtime.js';

function handleServiceError(res, error, fallbackMessage) {
  const status = error.status || 500;

  return res.status(status).json({
    message: error.message || fallbackMessage,
    ...(error.item ? { item: error.item } : {})
  });
}

export async function getCashboxSummaryController(_req, res) {
  try {
    const data = await fetchCashboxDashboard(_req.query);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo obtener la caja');
  }
}

export async function openCashboxController(req, res) {
  try {
    const data = await openCashbox(req.body, req.user);
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo abrir la caja');
  }
}

export async function addCashboxPaymentController(req, res) {
  try {
    const data = await addCashboxPayment(req.body, req.user);
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo registrar el pago');
  }
}

export async function addCashboxSaleController(req, res) {
  try {
    const data = await addCashboxSale(req.body, req.user);
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo registrar la venta');
  }
}

export async function closeCashboxController(req, res) {
  try {
    const data = await closeOpenCashbox(req.user);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo cerrar la caja');
  }
}

export function cashboxStreamController(req, res) {
  try {
    const user = authenticateCashboxStream(req);
    attachCashboxStream(req, res, user);
    return undefined;
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || 'No se pudo abrir el canal en vivo'
    });
  }
}
