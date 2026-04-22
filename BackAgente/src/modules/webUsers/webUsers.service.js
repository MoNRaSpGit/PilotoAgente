import {
  getWebAdminUsersSummary,
  getWebUserAdminDetail,
  getWebUserProfileSnapshot,
  listWebUsersForAdmin
} from './webUsers.repository.js';

const WEB_PROFILE_CACHE_TTL_MS = 60 * 1000;
const webProfileCache = new Map();
const webProfileInFlight = new Map();

function createServiceError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getNow() {
  return Date.now();
}

function getCachedProfile(userId) {
  const key = Number(userId);
  const entry = webProfileCache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= getNow()) {
    webProfileCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedProfile(userId, profile) {
  const key = Number(userId);
  webProfileCache.set(key, {
    value: profile,
    expiresAt: getNow() + WEB_PROFILE_CACHE_TTL_MS
  });
}

function runProfileSingleFlight(userId, factory) {
  const key = Number(userId);
  if (webProfileInFlight.has(key)) {
    return webProfileInFlight.get(key);
  }

  const task = Promise.resolve()
    .then(factory)
    .finally(() => {
      webProfileInFlight.delete(key);
    });

  webProfileInFlight.set(key, task);
  return task;
}

export function invalidateWebAuthProfileCache(userId) {
  const key = Number(userId);
  if (Number.isFinite(key) && key > 0) {
    webProfileCache.delete(key);
    return;
  }
  webProfileCache.clear();
}

export async function getWebAuthProfile(userId) {
  const cached = getCachedProfile(userId);
  if (cached) {
    return { profile: cached };
  }

  return runProfileSingleFlight(userId, async () => {
    const secondCached = getCachedProfile(userId);
    if (secondCached) {
      return { profile: secondCached };
    }

    const profile = await getWebUserProfileSnapshot(userId);
    setCachedProfile(userId, profile);
    return { profile };
  });
}

export async function getAdminUsersSummary() {
  const item = await getWebAdminUsersSummary();
  return { item };
}

export async function listAdminUsers(query = {}) {
  const items = await listWebUsersForAdmin({
    limit: query?.limit
  });

  return { items };
}

export async function getAdminUserDetail(webUserId) {
  const parsedId = Number(webUserId);

  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    throw createServiceError('Usuario web invalido', 400);
  }

  const item = await getWebUserAdminDetail(parsedId);

  if (!item) {
    throw createServiceError('Usuario web no encontrado', 404);
  }

  return { item };
}
