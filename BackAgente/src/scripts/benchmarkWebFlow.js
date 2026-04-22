const API_BASE_URL = process.env.BENCH_API_BASE_URL || 'http://localhost:3000';
const BENCH_USER = process.env.BENCH_WEB_USER || 'demo.web';
const BENCH_PASS = process.env.BENCH_WEB_PASS || 'Demo123!';
const ITERATIONS = Math.max(1, Number(process.env.BENCH_ITERATIONS || 20));

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

function printSummary(resultsByName) {
  const rows = [];
  for (const [name, result] of resultsByName.entries()) {
    const durations = result.samples.map((item) => item.durationMs);
    const successCount = result.samples.filter((item) => item.ok).length;
    const errorCount = result.samples.length - successCount;
    const avg = durations.length ? round2(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0;
    const min = durations.length ? round2(Math.min(...durations)) : 0;
    const max = durations.length ? round2(Math.max(...durations)) : 0;
    const p50 = percentile(durations, 50);
    const p95 = percentile(durations, 95);

    rows.push({
      name,
      count: result.samples.length,
      ok: successCount,
      err: errorCount,
      min,
      p50,
      p95,
      avg,
      max
    });
  }

  rows.sort((a, b) => b.p95 - a.p95);

  console.log('\n[bench] Resumen por endpoint (ordenado por p95 desc)');
  for (const row of rows) {
    console.log(
      `[bench] ${row.name} | n=${row.count} ok=${row.ok} err=${row.err}`
      + ` | min=${row.min}ms p50=${row.p50}ms p95=${row.p95}ms avg=${row.avg}ms max=${row.max}ms`
    );
  }

  if (rows.length > 0) {
    const top = rows[0];
    console.log(`\n[bench] Cuello principal actual: ${top.name} (p95=${top.p95}ms, avg=${top.avg}ms)`);
  }
}

async function requestStep(path, { token } = {}) {
  const startedAt = nowMs();
  const headers = {
    'Cache-Control': 'no-cache'
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  await parseJsonSafe(response);
  const durationMs = round2(nowMs() - startedAt);

  return {
    ok: response.status < 500,
    status: response.status,
    durationMs
  };
}

async function main() {
  console.log(`[bench] Base URL: ${API_BASE_URL}`);
  console.log(`[bench] Iteraciones por endpoint: ${ITERATIONS}`);

  const healthResponse = await fetch(`${API_BASE_URL}/api/health`);
  const healthData = await parseJsonSafe(healthResponse);
  if (!healthResponse.ok || String(healthData?.status || '').toLowerCase() !== 'ok' || healthData?.database === false) {
    throw new Error('Health check fallido. Verifica backend y base de datos.');
  }
  console.log('[bench] health ok');

  const loginResponse = await fetch(`${API_BASE_URL}/api/web/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      nombre: BENCH_USER,
      password: BENCH_PASS
    })
  });
  const loginData = await parseJsonSafe(loginResponse);
  if (!loginResponse.ok || !loginData?.token) {
    throw new Error(`Login bench fallido (${loginResponse.status}).`);
  }
  const token = String(loginData.token);
  console.log('[bench] login ok');

  const steps = [
    { name: 'GET /api/web/products', path: '/api/web/products?limit=20&offset=0', auth: false },
    { name: 'GET /api/web/categories', path: '/api/web/categories?status=activo', auth: false },
    { name: 'GET /api/web/orders/mine', path: '/api/web/orders/mine?limit=20', auth: true },
    { name: 'GET /api/web/users/me/profile', path: '/api/web/users/me/profile', auth: true }
  ];

  const resultsByName = new Map(steps.map((step) => [step.name, { samples: [] }]));

  for (let i = 0; i < ITERATIONS; i += 1) {
    for (const step of steps) {
      const result = await requestStep(step.path, {
        token: step.auth ? token : ''
      });
      resultsByName.get(step.name).samples.push(result);
    }
  }

  printSummary(resultsByName);
}

main().catch((error) => {
  console.error(`[bench] failed: ${error?.message || error}`);
  process.exit(1);
});
