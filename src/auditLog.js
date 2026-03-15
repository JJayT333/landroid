(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LANDroidAuditLog = factory();
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const AUDIT_EVENTS_KEY = 'landroid:auditEvents';
  const MAX_AUDIT_EVENTS = 200;

  function safeParse(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function listAuditEvents() {
    return safeParse(localStorage.getItem(AUDIT_EVENTS_KEY));
  }

  function recordAuditEvent(type, detail = {}) {
    if (!type) return null;
    const entry = {
      id: (crypto && crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2, 11),
      type,
      detail,
      timestamp: Date.now(),
    };
    const next = [entry, ...listAuditEvents()].slice(0, MAX_AUDIT_EVENTS);
    try {
      localStorage.setItem(AUDIT_EVENTS_KEY, JSON.stringify(next));
    } catch (_e) {
      // QuotaExceededError — trim oldest 50 entries and retry once
      const trimmed = next.slice(0, MAX_AUDIT_EVENTS - 50);
      try {
        localStorage.setItem(AUDIT_EVENTS_KEY, JSON.stringify(trimmed));
      } catch (_e2) {
        // Storage full even after trim — silently drop
      }
    }
    return entry;
  }

  function clearAuditEvents() {
    localStorage.removeItem(AUDIT_EVENTS_KEY);
  }

  return {
    AUDIT_EVENTS_KEY,
    MAX_AUDIT_EVENTS,
    listAuditEvents,
    recordAuditEvent,
    clearAuditEvents,
  };
});
