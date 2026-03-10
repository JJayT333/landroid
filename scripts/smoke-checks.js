function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createLocalStorageMock() {
  const state = new Map();
  return {
    getItem(key) {
      return state.has(key) ? state.get(key) : null;
    },
    setItem(key, value) {
      state.set(String(key), String(value));
    },
    removeItem(key) {
      state.delete(key);
    },
    clear() {
      state.clear();
    },
  };
}

function run() {
  global.localStorage = createLocalStorageMock();
  global.crypto = { randomUUID: () => 'smoke-id-1' };

  const workspaceDomain = require('../src/workspaceDomain.js');
  const storageProvider = require('../src/storageProvider.js');
  const auditLog = require('../src/auditLog.js');
  const syncEngine = require('../src/syncEngine.js');
  const dropboxIntegration = require('../src/dropboxIntegration.js');
  const workspaceStorage = require('../src/workspaceStorage.js');

  assert(typeof workspaceDomain.toWorkspaceSavePayload === 'function', 'workspaceDomain export missing');
  assert(typeof storageProvider.createLocalStorageProvider === 'function', 'storageProvider export missing');
  assert(typeof auditLog.recordAuditEvent === 'function', 'auditLog export missing');
  assert(typeof syncEngine.recordSyncOperation === 'function', 'syncEngine export missing');
  assert(typeof dropboxIntegration.normalizeAttachmentMetadata === 'function', 'dropbox export missing');
  assert(typeof workspaceStorage.saveWorkspace === 'function', 'workspaceStorage export missing');

  auditLog.clearAuditEvents();
  const auditEntry = auditLog.recordAuditEvent('smoke_event', { ok: true });
  assert(auditEntry && auditEntry.type === 'smoke_event', 'audit event recording failed');

  syncEngine.clearPendingOperations();
  const initialSync = syncEngine.getSyncSummary();
  assert(initialSync.status === 'synced', 'initial sync status should be synced');
  syncEngine.recordSyncOperation('upsert', 'workspace', 'ws-1', { name: 'Demo' });
  const pendingSync = syncEngine.getSyncSummary();
  assert(pendingSync.status === 'pending' && pendingSync.pendingCount === 1, 'sync pending summary failed');

  localStorage.setItem(dropboxIntegration.DROPBOX_FEATURE_FLAG_KEY, '1');
  const normalized = dropboxIntegration.normalizeAttachmentMetadata({ file_id: 'f-1', path_display: '/A/B.pdf' });
  assert(normalized.dropbox_file_id === 'f-1', 'dropbox metadata normalization failed');

  const savePayload = workspaceDomain.toWorkspaceSavePayload({
    projectName: '  Smoke  ',
    nodes: [{ id: 'n1', docData: 'blob' }],
    instrumentList: [],
    flowNodes: [],
    flowEdges: [],
    flowPz: { x: 0, y: 0, scale: 1 },
    treeScale: 1,
    printOrientation: 'landscape',
    gridCols: 1,
    gridRows: 1,
    tracts: [],
    contacts: [],
    ownershipInterests: [],
    contactLogs: [],
    deskMaps: [],
    activeDeskMapId: null,
    appId: 'app',
  });

  assert(savePayload.name === 'Smoke', 'workspace payload name should be trimmed');
  assert(savePayload.nodes[0].docData === undefined, 'docData should be stripped');
  assert(savePayload.nodes[0].hasDoc === true, 'hasDoc should be set');
  assert(savePayload.nodes[0].attachmentMetadata === null || typeof savePayload.nodes[0].attachmentMetadata === 'object' || savePayload.nodes[0].attachmentMetadata === undefined, 'attachment metadata normalization should be safe');

  console.log('Smoke checks passed');
}

run();
