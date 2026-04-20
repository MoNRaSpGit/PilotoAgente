import {
  getWebAdminUsersSummary,
  getWebUserAdminDetail,
  getWebUserProfileSnapshot,
  listWebUsersForAdmin
} from './webUsers.repository.js';

function createServiceError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function getWebAuthProfile(userId) {
  const profile = await getWebUserProfileSnapshot(userId);
  return { profile };
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