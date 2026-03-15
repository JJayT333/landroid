(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LANDroidWorkspaceStorage = factory();
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const LOCAL_META_KEY = 'landroid:lastWorkspaceId';
  const DB_NAME = 'landroid-offline-db';
  const DB_VERSION = 2;
  const WORKSPACES_STORE = 'workspaces';
  const DOCBLOBS_STORE = 'docblobs';
  const CURRENT_SCHEMA_VERSION = 1;


  function migrateWorkspaceRecord(record) {
    if (!record) return null;
    if (typeof record.schemaVersion === 'number' && record.schemaVersion >= CURRENT_SCHEMA_VERSION) {
      return record;
    }
    return {
      ...record,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  function createWorkspaceId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11);
  }

  let _dbPromise = null;

  function getDb() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(WORKSPACES_STORE)) {
          const store = db.createObjectStore(WORKSPACES_STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(DOCBLOBS_STORE)) {
          db.createObjectStore(DOCBLOBS_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => { _dbPromise = null; };
        db.onversionchange = () => { db.close(); _dbPromise = null; };
        resolve(db);
      };
      request.onerror = () => { _dbPromise = null; reject(request.error); };
      request.onblocked = () => { _dbPromise = null; reject(new Error('IndexedDB upgrade blocked: close other tabs using this app and retry')); };
    });
    return _dbPromise;
  }

  async function withStore(storeName, mode, handler) {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      let settled = false;
      let result;
      let hasResult = false;

      const safeResolve = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const setResult = (value) => {
        result = value;
        hasResult = true;
      };

      const safeReject = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      tx.oncomplete = () => {
        safeResolve(hasResult ? result : undefined);
      };
      tx.onerror = () => {
        safeReject(tx.error);
      };
      tx.onabort = () => {
        safeReject(tx.error || new Error('Transaction aborted'));
      };

      handler({ store, setResult, reject: safeReject });
    });
  }

  async function withWorkspaceStore(mode, handler) {
    return withStore(WORKSPACES_STORE, mode, handler);
  }

  async function getAllWorkspaces() {
    return withWorkspaceStore('readonly', ({ store, setResult, reject }) => {
      const entries = [];
      const request = store.index('updatedAt').openCursor(null, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          setResult(entries);
          return;
        }
        entries.push(migrateWorkspaceRecord(cursor.value));
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function loadWorkspace(id) {
    return withWorkspaceStore('readonly', ({ store, setResult, reject }) => {
      const request = store.get(id);
      request.onsuccess = () => setResult(migrateWorkspaceRecord(request.result) || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteWorkspace(id) {
    await withWorkspaceStore('readwrite', ({ store }) => {
      store.delete(id);
    });
    if (localStorage.getItem(LOCAL_META_KEY) === id) {
      localStorage.removeItem(LOCAL_META_KEY);
    }
  }

  async function deleteAllWorkspaces() {
    await withWorkspaceStore('readwrite', ({ store }) => {
      store.clear();
    });
    localStorage.removeItem(LOCAL_META_KEY);
  }

  async function saveWorkspace(data, workspaceId = null) {
    const payload = migrateWorkspaceRecord({ ...data, id: workspaceId || data.id || createWorkspaceId(), updatedAt: Date.now() });
    await withWorkspaceStore('readwrite', ({ store }) => {
      store.put(payload);
    });
    localStorage.setItem(LOCAL_META_KEY, payload.id);
    return payload;
  }

  async function getLatestWorkspace() {
    return withWorkspaceStore('readonly', ({ store, setResult, reject }) => {
      const request = store.index('updatedAt').openCursor(null, 'prev');
      request.onsuccess = () => setResult(request.result ? migrateWorkspaceRecord(request.result.value) : null);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveDocBlobs(workspaceId, nodes) {
    const blobs = [];
    (nodes || []).forEach((node) => {
      if (node.docData) {
        blobs.push({ key: `${workspaceId}::${node.id}`, workspaceId, nodeId: node.id, docData: node.docData });
      }
    });
    if (!blobs.length) return;
    await withStore(DOCBLOBS_STORE, 'readwrite', ({ store }) => {
      blobs.forEach((blob) => store.put(blob));
    });
  }

  async function loadDocBlobs(workspaceId) {
    return withStore(DOCBLOBS_STORE, 'readonly', ({ store, setResult, reject }) => {
      const entries = [];
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { setResult(entries); return; }
        if (cursor.value.workspaceId === workspaceId) {
          entries.push(cursor.value);
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteDocBlobs(workspaceId) {
    await withStore(DOCBLOBS_STORE, 'readwrite', ({ store }) => {
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (cursor.value.workspaceId === workspaceId) cursor.delete();
        cursor.continue();
      };
    });
  }

  async function deleteAllDocBlobs() {
    await withStore(DOCBLOBS_STORE, 'readwrite', ({ store }) => {
      store.clear();
    });
  }

  return {
    LOCAL_META_KEY,
    getAllWorkspaces,
    loadWorkspace,
    deleteWorkspace,
    deleteAllWorkspaces,
    saveWorkspace,
    getLatestWorkspace,
    saveDocBlobs,
    loadDocBlobs,
    deleteDocBlobs,
    deleteAllDocBlobs,
    CURRENT_SCHEMA_VERSION,
  };
});
