const DEFAULT_BASE_URL = process.env.SMOKE_API_BASE_URL || 'http://localhost:3000';
const DEFAULT_USERNAME = process.env.SMOKE_WEB_USER || 'demo.web';
const DEFAULT_PASSWORD = process.env.SMOKE_WEB_PASS || 'Demo123!';

function toErrorMessage(error) {
  if (!error) {
    return 'Unknown error';
  }
  return String(error.message || error);
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchStep(path, options = {}) {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
  const url = `${DEFAULT_BASE_URL}${normalizedPath}`;
  const response = await fetch(url, options);
  const data = await readJsonSafe(response);
  return { url, response, data };
}

async function run() {
  console.log(`[smoke] Base URL: ${DEFAULT_BASE_URL}`);

  const healthStep = await fetchStep('/api/health');
  assert(healthStep.response.ok, `[health] HTTP ${healthStep.response.status}`);
  assert(String(healthStep.data?.status || '').toLowerCase() === 'ok', '[health] Respuesta invalida (status != ok)');
  assert(healthStep.data?.database !== false, '[health] Base de datos no disponible');
  console.log('[smoke] health ok');

  const loginStep = await fetchStep('/api/web/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: DEFAULT_USERNAME,
      password: DEFAULT_PASSWORD
    })
  });

  assert(loginStep.response.ok, `[login] HTTP ${loginStep.response.status} - ${loginStep.data?.message || 'sin detalle'}`);
  const token = String(loginStep.data?.token || '').trim();
  assert(token, '[login] No se recibio token');
  console.log('[smoke] login ok');

  const productsStep = await fetchStep('/api/web/products?limit=20&offset=0');
  assert(productsStep.response.ok, `[products] HTTP ${productsStep.response.status}`);
  const products = Array.isArray(productsStep.data?.items) ? productsStep.data.items : [];
  const activeProducts = products.filter((item) => String(item?.estado || '').toLowerCase() === 'activo');
  assert(activeProducts.length > 0, '[products] No hay productos activos disponibles para smoke');
  const selectedProduct = activeProducts[0];
  console.log(`[smoke] products ok (activo seleccionado: ${selectedProduct.id})`);

  const orderPayload = {
    items: [
      {
        product_id: Number(selectedProduct.id),
        quantity: 1
      }
    ],
    notes: '[smoke] pedido de validacion automatica',
    payment_method: 'efectivo',
    delivery_mode: 'pickup'
  };

  const createOrderStep = await fetchStep('/api/web/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(orderPayload)
  });
  assert(
    createOrderStep.response.ok,
    `[create-order] HTTP ${createOrderStep.response.status} - ${createOrderStep.data?.message || 'sin detalle'}`
  );
  const createdOrderId = Number(createOrderStep.data?.item?.id || 0);
  assert(Number.isFinite(createdOrderId) && createdOrderId > 0, '[create-order] No se recibio id de pedido');
  console.log(`[smoke] create order ok (id=${createdOrderId})`);

  const myOrdersStep = await fetchStep('/api/web/orders/mine?limit=5', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  assert(myOrdersStep.response.ok, `[my-orders] HTTP ${myOrdersStep.response.status}`);
  const myOrders = Array.isArray(myOrdersStep.data?.items) ? myOrdersStep.data.items : [];
  const existsCreatedOrder = myOrders.some((item) => Number(item?.id) === createdOrderId);
  assert(existsCreatedOrder, '[my-orders] El pedido creado no aparece en el listado del usuario');
  console.log('[smoke] my-orders ok');

  console.log('[smoke] Web flow smoke completed successfully');
}

run().catch((error) => {
  console.error(`[smoke] failed: ${toErrorMessage(error)}`);
  process.exit(1);
});
