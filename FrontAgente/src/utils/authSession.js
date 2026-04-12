const AUTH_SESSION_KEY = 'frontagente:auth-session';
const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getBrowserStorage(storageType) {
  if (typeof window === 'undefined') {
    return null;
  }

  return storageType === 'local' ? window.localStorage : window.sessionStorage;
}

function clearAllSessionStorage() {
  const localStorage = getBrowserStorage('local');
  const sessionStorage = getBrowserStorage('session');
  localStorage?.removeItem(AUTH_SESSION_KEY);
  sessionStorage?.removeItem(AUTH_SESSION_KEY);
}

function readStoredSession() {
  const localStorage = getBrowserStorage('local');
  const sessionStorage = getBrowserStorage('session');

  try {
    // Session storage is isolated per browser tab/window.
    // We prioritize it to avoid cross-role collisions (admin/operario) in the same browser.
    const sessionRaw = sessionStorage?.getItem(AUTH_SESSION_KEY);
    const localRaw = localStorage?.getItem(AUTH_SESSION_KEY);
    const raw = sessionRaw || localRaw;

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (!parsed?.token || !parsed?.user) {
      clearAllSessionStorage();
      return null;
    }

    if (Number.isFinite(Number(parsed.expiresAt)) && Number(parsed.expiresAt) <= Date.now()) {
      clearAllSessionStorage();
      return null;
    }

    const normalizedSession = {
      token: parsed.token,
      user: parsed.user,
      expiresAt: Date.now() + AUTH_SESSION_TTL_MS
    };

    sessionStorage?.setItem(AUTH_SESSION_KEY, JSON.stringify(normalizedSession));
    localStorage?.removeItem(AUTH_SESSION_KEY);

    return normalizedSession;
  } catch (_error) {
    clearAllSessionStorage();
    return null;
  }
}

export function getStoredAuthSession() {
  return readStoredSession();
}

export function saveAuthSession(session) {
  const localStorage = getBrowserStorage('local');
  const sessionStorage = getBrowserStorage('session');

  if (!session?.token || !session?.user) {
    clearAllSessionStorage();
    return;
  }

  const sessionWithExpiry = {
    token: session.token,
    user: session.user,
    expiresAt: Date.now() + AUTH_SESSION_TTL_MS
  };

  sessionStorage?.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionWithExpiry));
  localStorage?.removeItem(AUTH_SESSION_KEY);
}

export function clearAuthSession() {
  clearAllSessionStorage();
}

export function getAuthToken() {
  return readStoredSession()?.token || '';
}
