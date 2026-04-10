import { listTopSoldProducts } from './ranking.repository.js';

function clampLimit(rawLimit) {
  if (rawLimit === 'all') {
    return null;
  }

  const parsed = Number(rawLimit);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5;
  }

  return Math.min(50, Math.floor(parsed));
}

export async function fetchCashboxRanking(query = {}) {
  return listTopSoldProducts({
    limit: clampLimit(query?.limit)
  });
}
