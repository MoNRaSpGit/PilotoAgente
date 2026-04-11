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
  const hasVersion =
    snapshot.version !== null &&
    snapshot.version !== undefined &&
    String(snapshot.version).trim() !== '';
  const normalizedVersion = hasVersion ? Number(snapshot.version) : Number.NaN;

  return {
    state: snapshot.state || 'idle',
    source: snapshot.source || 'scanner',
    version: Number.isFinite(normalizedVersion) ? normalizedVersion : null,
    client_updated_at: snapshot.client_updated_at || null,
    total: Number(snapshot.total || 0),
    items: Array.isArray(snapshot.items) ? snapshot.items : [],
    operator: snapshot.operator || null,
    editing: snapshot.editing || null,
    manual: snapshot.manual || null,
    updated_at: snapshot.updated_at || new Date().toISOString()
  };
}

function parseTimestamp(value) {
  if (!value) {
    return Number.NaN;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isIncomingSnapshotStale(currentSnapshot = {}, incomingSnapshot = {}) {
  const hasCurrentVersion =
    currentSnapshot.version !== null &&
    currentSnapshot.version !== undefined &&
    String(currentSnapshot.version).trim() !== '';
  const hasIncomingVersion =
    incomingSnapshot.version !== null &&
    incomingSnapshot.version !== undefined &&
    String(incomingSnapshot.version).trim() !== '';
  const currentVersion = hasCurrentVersion ? Number(currentSnapshot.version) : Number.NaN;
  const incomingVersion = hasIncomingVersion ? Number(incomingSnapshot.version) : Number.NaN;

  if (Number.isFinite(currentVersion) && Number.isFinite(incomingVersion)) {
    return incomingVersion < currentVersion;
  }

  const currentClientTime = parseTimestamp(currentSnapshot.client_updated_at);
  const incomingClientTime = parseTimestamp(incomingSnapshot.client_updated_at);

  if (Number.isFinite(currentClientTime) && Number.isFinite(incomingClientTime)) {
    return incomingClientTime < currentClientTime;
  }

  return false;
}

export function saveScannerLiveState(snapshot = {}) {
  pruneExpiredStates();

  const normalizedSnapshot = normalizeSnapshot(snapshot);
  const operatorKey = getOperatorKey(normalizedSnapshot.operator);

  if (!operatorKey) {
    return normalizedSnapshot;
  }

  const currentEntry = operatorStates.get(operatorKey);

  if (currentEntry && isIncomingSnapshotStale(currentEntry.snapshot, normalizedSnapshot)) {
    return currentEntry.snapshot;
  }

  operatorStates.set(operatorKey, {
    snapshot: normalizedSnapshot,
    expiresAt: Date.now() + SCANNER_LIVE_STATE_TTL_MS
  });

  return normalizedSnapshot;
}

function sortByUpdatedAtDesc(items = []) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.updated_at || 0).getTime();
    const rightTime = new Date(right.updated_at || 0).getTime();
    return rightTime - leftTime;
  });
}

function pickPrioritizedSnapshot(items = []) {
  const sortedItems = sortByUpdatedAtDesc(items);

  if (sortedItems.length === 0) {
    return null;
  }

  const prioritized = sortedItems.find(
    (entry) => entry.state === 'editing' || entry.state === 'manual' || entry.state === 'active' || entry.items.length > 0
  );

  return prioritized || sortedItems[0];
}

export function getScannerLiveState(requester = null, options = {}) {
  pruneExpiredStates();

  const scope = String(options?.scope || '').trim().toLowerCase();
  const requesterKey = getOperatorKey(requester);
  const wantsOwnScope = scope === 'own';

  if (wantsOwnScope && requesterKey) {
    const ownEntry = operatorStates.get(requesterKey);
    return ownEntry?.snapshot || createEmptyState();
  }

  if (requester?.role !== 'admin' && requesterKey) {
    const ownEntry = operatorStates.get(requesterKey);
    return ownEntry?.snapshot || createEmptyState();
  }

  const entries = [...operatorStates.values()].map((entry) => entry.snapshot);

  if (requester?.role === 'admin') {
    const operarioEntries = entries.filter((entry) => entry?.operator?.role === 'operario');
    const operarioSnapshot = pickPrioritizedSnapshot(operarioEntries);
    return operarioSnapshot || createEmptyState();
  }

  const snapshot = pickPrioritizedSnapshot(entries);
  return snapshot || createEmptyState();
}
