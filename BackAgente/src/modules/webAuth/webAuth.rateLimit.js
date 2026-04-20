const ATTEMPTS_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const REGISTER_MAX_ATTEMPTS = 6;
const LOCK_MS = 15 * 60 * 1000;

const buckets = new Map();

function now() {
  return Date.now();
}

function cleanup(records, timestamp) {
  return records.filter((record) => timestamp - record <= ATTEMPTS_WINDOW_MS);
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function buildKey(req, tag) {
  const nombre = String(req.body?.nombre || '').trim().toLowerCase();
  return `${tag}:${getClientIp(req)}:${nombre}`;
}

function checkBucket(key, maxAttempts) {
  const timestamp = now();
  const state = buckets.get(key) || { attempts: [], lockedUntil: 0 };

  if (state.lockedUntil > timestamp) {
    return {
      allowed: false,
      retryAfterMs: state.lockedUntil - timestamp
    };
  }

  state.attempts = cleanup(state.attempts, timestamp);

  if (state.attempts.length >= maxAttempts) {
    state.lockedUntil = timestamp + LOCK_MS;
    state.attempts = [];
    buckets.set(key, state);

    return {
      allowed: false,
      retryAfterMs: LOCK_MS
    };
  }

  buckets.set(key, state);

  return {
    allowed: true,
    retryAfterMs: 0
  };
}

function addFailure(key) {
  const timestamp = now();
  const state = buckets.get(key) || { attempts: [], lockedUntil: 0 };
  state.attempts = cleanup(state.attempts, timestamp);
  state.attempts.push(timestamp);
  buckets.set(key, state);
}

function clearBucket(key) {
  buckets.delete(key);
}

function createLimiter(tag, maxAttempts) {
  return {
    check(req) {
      const key = buildKey(req, tag);
      const result = checkBucket(key, maxAttempts);
      return { key, ...result };
    },
    recordFailure(key) {
      addFailure(key);
    },
    clear(key) {
      clearBucket(key);
    }
  };
}

export const webLoginRateLimiter = createLimiter('login', LOGIN_MAX_ATTEMPTS);
export const webRegisterRateLimiter = createLimiter('register', REGISTER_MAX_ATTEMPTS);