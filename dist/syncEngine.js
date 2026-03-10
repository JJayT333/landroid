(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LANDroidSyncEngine = factory();
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const SYNC_OPLOG_KEY = 'landroid:sync:oplog';
  const MAX_SYNC_OPS = 500;

  function safeParse(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function listPendingOperations() {
    return safeParse(localStorage.getItem(SYNC_OPLOG_KEY));
  }

  function recordSyncOperation(operationType, entityType, entityId, payload = {}) {
    if (!operationType || !entityType) return null;
    const op = {
      id: (crypto && crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2, 11),
      operationType,
      entityType,
      entityId: entityId || null,
      payload,
      createdAt: Date.now(),
      attempts: 0,
    };
    const next = [op, ...listPendingOperations()].slice(0, MAX_SYNC_OPS);
    localStorage.setItem(SYNC_OPLOG_KEY, JSON.stringify(next));
    return op;
  }

  function clearPendingOperations() {
    localStorage.removeItem(SYNC_OPLOG_KEY);
  }

  function getSyncSummary() {
    const pending = listPendingOperations();
    return {
      pendingCount: pending.length,
      status: pending.length > 0 ? 'pending' : 'synced',
      lastOperationAt: pending[0]?.createdAt || null,
    };
  }

  return {
    SYNC_OPLOG_KEY,
    MAX_SYNC_OPS,
    listPendingOperations,
    recordSyncOperation,
    clearPendingOperations,
    getSyncSummary,
  };
});
