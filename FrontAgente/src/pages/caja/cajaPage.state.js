export function createEmptyScannerLiveState() {
  return {
    items: [],
    total: 0,
    state: 'idle',
    operator: null,
    editing: null,
    manual: null,
    updated_at: null
  };
}

export function normalizeScannerLiveState(payload = {}) {
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    total: Number(payload?.total || 0),
    state: payload?.state || 'idle',
    operator: payload?.operator || null,
    editing: payload?.editing || null,
    manual: payload?.manual || null,
    updated_at: payload?.updated_at || null
  };
}

export function resolveMovementLimit(mode = 'recent') {
  if (mode === 'all') {
    return 'all';
  }

  if (mode === 'top10') {
    return 10;
  }

  return 3;
}

export function resolveRankingLimit(mode = 'top5') {
  if (mode === 'all') {
    return 'all';
  }

  if (mode === 'top10') {
    return 10;
  }

  return 5;
}

export function getMovementSummaryLabel(mode = 'recent') {
  if (mode === 'all') {
    return 'Mostrando todo hoy';
  }

  if (mode === 'top10') {
    return 'Mostrando ultimos 10';
  }

  return 'Mostrando ultimos 3';
}
