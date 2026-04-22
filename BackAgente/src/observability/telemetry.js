import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

const storage = new AsyncLocalStorage();
const routeStats = new Map();

const REQUEST_SLOW_MS = Number(process.env.OBS_REQUEST_SLOW_MS || 1200);
const REQUEST_LOG_MIN_MS = Number(process.env.OBS_REQUEST_LOG_MIN_MS || 300);
const DB_QUERY_SLOW_MS = Number(process.env.OBS_DB_QUERY_SLOW_MS || 700);
const ROUTE_SUMMARY_EVERY = Math.max(10, Number(process.env.OBS_ROUTE_SUMMARY_EVERY || 50));
const ROUTE_SUMMARY_WINDOW_SIZE = Math.max(20, Number(process.env.OBS_ROUTE_WINDOW_SIZE || 200));
const LOG_FORMAT = String(process.env.OBS_LOG_FORMAT || 'pretty').trim().toLowerCase();

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function sanitizeSql(sql) {
  const raw = String(sql || '').replace(/\s+/g, ' ').trim();
  if (!raw) {
    return '';
  }
  if (raw.length <= 120) {
    return raw;
  }
  return `${raw.slice(0, 117)}...`;
}

function formatMs(value) {
  return `${round2(value)}ms`;
}

function emitLog(payload) {
  const isWarn = payload?.level === 'warn';

  if (LOG_FORMAT === 'json') {
    const line = JSON.stringify(payload);
    if (isWarn) {
      console.warn(line);
    } else {
      console.log(line);
    }
    return;
  }

  const kind = String(payload?.kind || '');

  if (kind === 'http_request') {
    const slowTag = payload.total_ms >= REQUEST_SLOW_MS ? ' | SLOW' : '';
    const errTag = Number(payload.status || 0) >= 500 ? ' | ERROR' : '';
    const line =
      `[OBS][REQ] ${payload.method} ${payload.path} | status=${payload.status}`
      + ` | total=${formatMs(payload.total_ms)} | db=${formatMs(payload.db_ms)}`
      + ` | q=${payload.db_count} | req=${payload.request_id}${slowTag}${errTag}`;
    if (isWarn) {
      console.warn(line);
    } else {
      console.log(line);
    }
    return;
  }

  if (kind === 'db_query_slow') {
    const line =
      `[OBS][DB-SLOW] ${formatMs(payload.duration_ms)} | req=${payload.request_id}`
      + ` | sql=${payload.sql}`;
    console.warn(line);
    return;
  }

  if (kind === 'http_route_summary') {
    const line =
      `[OBS][ROUTE] ${payload.route} | n=${payload.sample_count} | avg=${formatMs(payload.avg_ms)}`
      + ` | p95=${formatMs(payload.p95_ms)} | db_avg=${formatMs(payload.avg_db_ms)}`
      + ` | err=${round2(payload.error_rate_pct)}% | slow=${round2(payload.slow_rate_pct)}%`;
    if (isWarn) {
      console.warn(line);
    } else {
      console.log(line);
    }
    return;
  }

  const fallbackLine = JSON.stringify(payload);
  if (isWarn) {
    console.warn(fallbackLine);
  } else {
    console.log(fallbackLine);
  }
}

export function getRequestContext() {
  return storage.getStore() || null;
}

export function addDbTiming({ durationMs, sql }) {
  const context = getRequestContext();
  if (!context) {
    return;
  }

  const safeDuration = Number(Number(durationMs || 0).toFixed(2));
  if (!Number.isFinite(safeDuration) || safeDuration < 0) {
    return;
  }

  context.db.count += 1;
  context.db.totalMs = Number((context.db.totalMs + safeDuration).toFixed(2));
  context.db.maxMs = Math.max(context.db.maxMs, safeDuration);

  if (safeDuration >= DB_QUERY_SLOW_MS) {
    const payload = {
      level: 'warn',
      kind: 'db_query_slow',
      request_id: context.requestId,
      duration_ms: safeDuration,
      sql: sanitizeSql(sql)
    };
    emitLog(payload);
  }
}

function buildRequestId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function safePath(req) {
  const raw = String(req.path || (req.originalUrl || req.url || '').split('?')[0] || '').trim();
  return raw || '/';
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

function updateRouteStats({ method, path, statusCode, totalMs, dbMs }) {
  const routeKey = `${method} ${path}`;
  const current = routeStats.get(routeKey) || {
    method,
    path,
    count: 0,
    errors: 0,
    slowCount: 0,
    totalMs: 0,
    totalDbMs: 0,
    window: []
  };

  current.count += 1;
  current.totalMs += totalMs;
  current.totalDbMs += dbMs;
  if (statusCode >= 500) {
    current.errors += 1;
  }
  if (totalMs >= REQUEST_SLOW_MS) {
    current.slowCount += 1;
  }
  current.window.push(totalMs);
  if (current.window.length > ROUTE_SUMMARY_WINDOW_SIZE) {
    current.window.shift();
  }

  routeStats.set(routeKey, current);

  if (current.count % ROUTE_SUMMARY_EVERY !== 0) {
    return;
  }

  const avgMs = current.totalMs / current.count;
  const avgDbMs = current.totalDbMs / current.count;
  const p95Ms = percentile(current.window, 95);
  const errorRate = (current.errors / current.count) * 100;
  const slowRate = (current.slowCount / current.count) * 100;

  const payload = {
    level: p95Ms >= REQUEST_SLOW_MS || errorRate > 0 ? 'warn' : 'info',
    kind: 'http_route_summary',
    route: routeKey,
    sample_count: current.count,
    window_size: current.window.length,
    avg_ms: round2(avgMs),
    p95_ms: p95Ms,
    avg_db_ms: round2(avgDbMs),
    error_rate_pct: round2(errorRate),
    slow_rate_pct: round2(slowRate)
  };

  emitLog(payload);
}

export function observabilityRequestMiddleware(req, res, next) {
  const requestId = buildRequestId();
  const startMs = nowMs();

  const context = {
    requestId,
    startMs,
    db: {
      count: 0,
      totalMs: 0,
      maxMs: 0
    }
  };

  res.setHeader('x-request-id', requestId);

  storage.run(context, () => {
    res.on('finish', () => {
      const totalMs = Number((nowMs() - startMs).toFixed(2));
      const statusCode = Number(res.statusCode || 0);
      const path = safePath(req);
      const method = String(req.method || 'GET').toUpperCase();
      const dbMs = Number(context.db.totalMs.toFixed(2));
      const payload = {
        level: statusCode >= 500 || totalMs >= REQUEST_SLOW_MS ? 'warn' : 'info',
        kind: 'http_request',
        request_id: requestId,
        method,
        path,
        status: statusCode,
        total_ms: totalMs,
        db_count: context.db.count,
        db_ms: dbMs,
        db_max_ms: Number(context.db.maxMs.toFixed(2)),
        ip: getClientIp(req),
        user_id: req.user?.id || req.webUser?.id || null
      };

      const shouldLogRequest =
        statusCode >= 400
        || totalMs >= REQUEST_LOG_MIN_MS
        || totalMs >= REQUEST_SLOW_MS;

      if (shouldLogRequest) {
        emitLog(payload);
      }

      updateRouteStats({
        method,
        path,
        statusCode,
        totalMs,
        dbMs
      });
    });

    next();
  });
}
