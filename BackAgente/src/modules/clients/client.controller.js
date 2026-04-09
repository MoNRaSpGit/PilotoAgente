import {
  createClient,
  getClientHistory,
  getClients,
  updateClientCharge,
  updateClientDelivery,
  updateClientPayment
} from './client.service.js';

function handleServiceError(res, error, fallbackMessage) {
  return res.status(error.status || 500).json({
    message: error.message || fallbackMessage,
    ...(error.item ? { item: error.item } : {})
  });
}

export async function listClientsController(_req, res) {
  try {
    const data = await getClients();
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudieron obtener los clientes');
  }
}

export async function createClientController(req, res) {
  try {
    const data = await createClient(req.body);
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo crear el cliente');
  }
}

export async function updateClientPaymentController(req, res) {
  try {
    const data = await updateClientPayment(req.params.id, req.body);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo actualizar el cliente');
  }
}

export async function updateClientDeliveryController(req, res) {
  try {
    const data = await updateClientDelivery(req.params.id, req.body);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo registrar la entrega');
  }
}

export async function updateClientChargeController(req, res) {
  try {
    const data = await updateClientCharge(req.params.id, req.body);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo agregar el cargo al cliente');
  }
}

export async function listClientHistoryController(req, res) {
  try {
    const data = await getClientHistory(req.params.id, req.query);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo obtener el historial del cliente');
  }
}
