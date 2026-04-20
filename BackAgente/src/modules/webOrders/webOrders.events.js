const adminClients = new Set();
const webClients = new Set();

function writeSseEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function registerClient(clientSet, client) {
  clientSet.add(client);
  const { res } = client;

  const keepAliveId = setInterval(() => {
    writeSseEvent(res, { type: 'keepalive', ts: Date.now() });
  }, 25000);

  res.on('close', () => {
    clearInterval(keepAliveId);
    clientSet.delete(client);
  });
}

export function openAdminWebOrdersStream(res) {
  registerClient(adminClients, { res });
  writeSseEvent(res, { type: 'connected', channel: 'admin_web_orders', ts: Date.now() });
}

export function openUserWebOrdersStream(res, { webUserId }) {
  registerClient(webClients, {
    res,
    webUserId: Number(webUserId || 0) || null
  });
  writeSseEvent(res, { type: 'connected', channel: 'user_web_orders', ts: Date.now() });
}

export function emitWebOrderEvent(payload = {}) {
  const eventOrder = payload.order ? {
    ...payload.order,
    id: Number(payload.order.id || 0) || null,
    web_usuario_id: Number(payload.order.web_usuario_id || 0) || null
  } : null;
  const targetWebUserId = Number(eventOrder?.web_usuario_id || payload.webUserId || 0) || null;
  const event = {
    type: payload.type || 'order_updated',
    order_id: Number(payload.orderId || 0) || null,
    status: payload.status || null,
    order: eventOrder,
    ts: Date.now()
  };

  for (const client of adminClients) {
    writeSseEvent(client.res, event);
  }

  for (const client of webClients) {
    if (!targetWebUserId || !client.webUserId || client.webUserId !== targetWebUserId) {
      continue;
    }
    writeSseEvent(client.res, event);
  }
}
