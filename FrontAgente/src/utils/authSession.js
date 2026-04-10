const AUTH_SESSION_KEY = 'frontagente:auth-session';

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(AUTH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

export function getStoredAuthSession() {
  return readStoredSession();
}

export function saveAuthSession(session) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session?.token || !session?.user) {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }

  window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(AUTH_SESSION_KEY);
}

export function getAuthToken() {
  return readStoredSession()?.token || '';
}
