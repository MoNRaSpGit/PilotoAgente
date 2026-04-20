import {
  changeWebOrderStatus,
  createOrderFromWebUser,
  hideAdminWebOrder,
  hideMyWebOrder,
  listAdminIncomingWebOrders,
  listMyWebOrders
} from './webOrders.service.js';
import { openAdminWebOrdersStream, openUserWebOrdersStream } from './webOrders.events.js';

function handleServiceError(res, error, fallbackMessage) {
  const status = error.status || 500;

  return res.status(status).json({
    message: error.message || fallbackMessage,
    ...(error.item ? { item: error.item } : {}),
    ...(error.items ? { items: error.items } : {}),
    ...(error.meta ? { meta: error.meta } : {})
  });
}

export async function createWebOrderController(req, res) {
  try {
    const data = await createOrderFromWebUser(req.webUser, req.body);
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo crear el pedido web');
  }
}

export async function listMyWebOrdersController(req, res) {
  try {
    const data = await listMyWebOrders(req.webUser, req.query);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudieron cargar tus pedidos');
  }
}

export async function listAdminIncomingWebOrdersController(req, res) {
  try {
    const data = await listAdminIncomingWebOrders(req.query);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudieron cargar los pedidos web');
  }
}

export async function changeWebOrderStatusController(req, res) {
  try {
    const data = await changeWebOrderStatus(req.params.orderId, req.body);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo actualizar el estado del pedido');
  }
}

export async function hideMyWebOrderController(req, res) {
  try {
    const data = await hideMyWebOrder(req.webUser, req.params.orderId);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo ocultar el pedido');
  }
}

export async function hideAdminWebOrderController(req, res) {
  try {
    const data = await hideAdminWebOrder(req.params.orderId);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo ocultar el pedido');
  }
}

function initSseResponse(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

export function streamAdminWebOrdersController(_req, res) {
  initSseResponse(res);
  openAdminWebOrdersStream(res);
}

export function streamMyWebOrdersController(_req, res) {
  initSseResponse(res);
  openUserWebOrdersStream(res, { webUserId: _req.webUser?.id });
}
