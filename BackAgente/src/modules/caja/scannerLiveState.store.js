const SCANNER_LIVE_STATE_TTL_MS = 12 * 60 * 60 * 1000;

const operatorStates = new Map();

function createEmptyState() {
  return {
    state: 'idle',
    source: 'scanner',
    total: 0,
    items: [],
    operator: null,
    editing: null,
    manual: null,
    updated_at: null
  };
}

function getOperatorKey(operator = {}) {
  if (operator?.id !== null && operator?.id !== undefined && String(operator.id).trim()) {
    return `id:${String(operator.id).trim()}`;
  }

  if (typeof operator?.name === 'string' && operator.name.trim()) {
    return `name:${operator.name.trim().toLowerCase()}`;
  }

  return null;
}

function pruneExpiredStates() {
  const now = Date.now();

  for (const [key, entry] of operatorStates.entries()) {
    if (entry.expiresAt <= now) {
      operatorStates.delete(key);
    }
  }
}

function normalizeSnapshot(snapshot = {}) {
  return {
    state: snapshot.state || 'idle',
    source: snapshot.source || 'scanner',
    total: Number(snapshot.total || 0),
    items: Array.isArray(snapshot.items) ? snapshot.items : [],
    operator: snapshot.operator || null,
    editing: snapshot.editing || null,
    manual: snapshot.manual || null,
    updated_at: snapshot.updated_at || new Date().toISOString()
  };
}

export function saveScannerLiveState(snapshot = {}) {
  pruneExpiredStates();

  const normalizedSnapshot = normalizeSnapshot(snapshot);
  const operatorKey = getOperatorKey(normalizedSnapshot.operator);

  if (!operatorKey) {
    return normalizedSnapshot;
  }

  operatorStates.set(operatorKey, {
    snapshot: normalizedSnapshot,
    expiresAt: Date.now() + SCANNER_LIVE_STATE_TTL_MS
  });

  return normalizedSnapshot;
}

export function getScannerLiveState(requester = null) {
  pruneExpiredStates();

  const requesterKey = getOperatorKey(requester);

  if (requester?.role !== 'admin' && requesterKey) {
    const ownEntry = operatorStates.get(requesterKey);
    return ownEntry?.snapshot || createEmptyState();
  }

  const entries = [...operatorStates.values()]
    .map((entry) => entry.snapshot)
    .sort((left, right) => {
      const leftTime = new Date(left.updated_at || 0).getTime();
      const rightTime = new Date(right.updated_at || 0).getTime();
      return rightTime - leftTime;
    });

  if (entries.length === 0) {
    return createEmptyState();
  }

  const prioritized = entries.find(
    (entry) => entry.state === 'editing' || entry.state === 'manual' || entry.state === 'active' || entry.items.length > 0
  );

  return prioritized || entries[0];
}
