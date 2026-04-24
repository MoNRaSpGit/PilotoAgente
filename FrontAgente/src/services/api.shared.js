import { getAuthToken } from '../utils/authSession';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function normalizeBarcode(value = '') {
  return String(value).trim().replace(/\s+/g, '');
}

export async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {};
  }
}

export function getAuthHeaders() {
  const token = getAuthToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`
  };
}

export function getCurrentAuthToken() {
  return getAuthToken();
}
