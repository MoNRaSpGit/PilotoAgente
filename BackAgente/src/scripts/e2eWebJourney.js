const API_BASE_URL = process.env.E2E_API_BASE_URL || 'http://localhost:3000';
const E2E_USER = process.env.E2E_WEB_USER || 'demo.web';
const E2E_PASS = process.env.E2E_WEB_PASS || 'Demo123!';
const ITERATIONS = Math.max(1, Number(process.env.E2E_ITERATIONS || 8));
const PRODUCTS_LIMIT = Math.max(20, Math.min(200, Number(process.env.E2E_PRODUCTS_LIMIT || 80)));

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function percentile(values = [], p = 95) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return round2(sorted[rank]);
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function createCollector(stepNames = []) {
  const map = new Map();
  for (const name of stepNames) {
    map.set(name, []);
  }
  return {
    add(name, durationMs, ok = true) {
      if (!map.has(name)) {
        map.set(name, []);
      }
      map.get(name).push({
        ok: Boolean(ok),
        durationMs: round2(durationMs)
      });
    },
    printSummary() {
      const rows = [];
      for (const [name, samples] of map.entries()) {
        if (!samples.length) {
          continue;
        }
        const durations = samples.map((sample) => sample.durationMs);
        const okCount = samples.filter((sample) => sample.ok).length;
        const errCount = samples.length - okCount;
        const avg = durations.length
          ? round2(durations.reduce((sum, value) => sum + value, 0) / durations.length)
          : 0;
        rows.push({
          name,
          n: samples.length,
          ok: okCount,
          err: errCount,
          min: round2(Math.min(...durations)),
          p50: percentile(durations, 50),
          p95: percentile(durations, 95),
          avg,
          max: round2(Math.max(...durations))
        });
      }

      rows.sort((a, b) => b.p95 - a.p95);

      console.log('\n[e2e] Resumen por etapa (ordenado por p95 desc)');
      for (const row of rows) {
        console.log(
          `[e2e] ${row.name} | n=${row.n} ok=${row.ok} err=${row.err}`
          + ` | min=${row.min}ms p50=${row.p50}ms p95=${row.p95}ms avg=${row.avg}ms max=${row.max}ms`
        );
      }

      if (rows.length > 0) {
        console.log(`\n[e2e] Cuello principal: ${rows[0].name} (p95=${rows[0].p95}ms, avg=${rows[0].avg}ms)`);
      }
    }
  };
}

async function request(path, { method = 'GET', token = '', body = null } = {}) {
  const startedAt = nowMs();
  const headers = {
    'Cache-Control': 'no-cache'
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined
  });
  const data = await parseJsonSafe(response);
  const durationMs = round2(nowMs() - startedAt);

  return {
    ok: response.ok,
    status: response.status,
    data,
    durationMs
  };
}

function pickFirstImageProduct(items = []) {
  return (Array.isArray(items) ? items : []).find((item) => Boolean(item?.has_local_image)) || null;
}

async function runIteration(index, token, collector) {
  const authMe = await request('/api/web/auth/me', { token });
  collector.add('GET /api/web/auth/me', authMe.durationMs, authMe.ok);

  const categoriesRes = await request('/api/web/categories?status=activo');
  collector.add('GET /api/web/categories', categoriesRes.durationMs, categoriesRes.ok);
  const categories = Array.isArray(categoriesRes.data?.items) ? categoriesRes.data.items : [];

  const productsRes = await request(`/api/web/products?limit=${PRODUCTS_LIMIT}&offset=0`);
  collector.add('GET /api/web/products', productsRes.durationMs, productsRes.ok);
  const products = Array.isArray(productsRes.data?.items) ? productsRes.data.items : [];

  const activeCategory = String(categories.find(Boolean) || '').trim();
  if (activeCategory) {
    const categoryProductsRes = await request(
      `/api/web/products?limit=${PRODUCTS_LIMIT}&offset=0&category=${encodeURIComponent(activeCategory)}`
    );
    collector.add('GET /api/web/products?category=', categoryProductsRes.durationMs, categoryProductsRes.ok);
  }

  const firstImageProducts = products
    .filter((item) => Boolean(item?.has_local_image))
    .slice(0, 12)
    .map((item) => Number(item?.id || 0))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (firstImageProducts.length > 0) {
    const imagesBatchRes = await request('/api/web/products/images/batch', {
      method: 'POST',
      body: { ids: firstImageProducts }
    });
    collector.add('POST /api/web/products/images/batch', imagesBatchRes.durationMs, imagesBatchRes.ok);
  }

  const repeatProductsRes = await request('/api/web/orders/repeat-products?limit=10', { token });
  collector.add('GET /api/web/orders/repeat-products', repeatProductsRes.durationMs, repeatProductsRes.ok);

  const ordersMineRes = await request('/api/web/orders/mine?limit=20', { token });
  collector.add('GET /api/web/orders/mine', ordersMineRes.durationMs, ordersMineRes.ok);

  const profileRes = await request('/api/web/users/me/profile', { token });
  collector.add('GET /api/web/users/me/profile', profileRes.durationMs, profileRes.ok);

  const selectedProduct = pickFirstImageProduct(products) || products[0] || null;
  if (!selectedProduct?.id) {
    return;
  }

  const createOrderRes = await request('/api/web/orders', {
    method: 'POST',
    token,
    body: {
      items: [
        {
          product_id: Number(selectedProduct.id),
          quantity: 1
        }
      ],
      notes: `[e2e] order iteration ${index + 1}`,
      payment_method: 'efectivo',
      delivery_mode: 'pickup'
    }
  });
  collector.add('POST /api/web/orders', createOrderRes.durationMs, createOrderRes.ok);
}

async function main() {
  console.log(`[e2e] Base URL: ${API_BASE_URL}`);
  console.log(`[e2e] Iteraciones: ${ITERATIONS}`);

  const healthRes = await request('/api/health');
  if (!healthRes.ok || String(healthRes.data?.status || '').toLowerCase() !== 'ok' || healthRes.data?.database === false) {
    throw new Error('Health check fallido. Verifica backend y base de datos.');
  }
  console.log('[e2e] health ok');

  const loginRes = await request('/api/web/auth/login', {
    method: 'POST',
    body: {
      nombre: E2E_USER,
      password: E2E_PASS
    }
  });
  if (!loginRes.ok || !loginRes.data?.token) {
    throw new Error(`Login e2e fallido (${loginRes.status}).`);
  }
  const token = String(loginRes.data.token);
  console.log('[e2e] login ok');

  const collector = createCollector([
    'GET /api/web/auth/me',
    'GET /api/web/categories',
    'GET /api/web/products',
    'GET /api/web/products?category=',
    'POST /api/web/products/images/batch',
    'GET /api/web/orders/repeat-products',
    'GET /api/web/orders/mine',
    'GET /api/web/users/me/profile',
    'POST /api/web/orders'
  ]);

  for (let i = 0; i < ITERATIONS; i += 1) {
    await runIteration(i, token, collector);
  }

  collector.printSummary();
}

main().catch((error) => {
  console.error(`[e2e] failed: ${error?.message || error}`);
  process.exit(1);
});

