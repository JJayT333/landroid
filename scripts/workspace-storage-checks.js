function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createLocalStorageMock() {
  const state = new Map();
  return {
    getItem: (key) => (state.has(key) ? state.get(key) : null),
    setItem: (key, value) => state.set(String(key), String(value)),
    removeItem: (key) => state.delete(key),
    clear: () => state.clear(),
  };
}

function createIndexedDbMock() {
  const databases = new Map();
  const createRequest = () => ({ onsuccess: null, onerror: null, onupgradeneeded: null, result: null, error: null });

  const createStoreApi = (dbRecord, storeName) => {
    const store = dbRecord.stores.get(storeName);
    const createSimpleRequest = (resolver) => {
      const request = createRequest();
      setTimeout(() => {
        try {
          request.result = resolver();
          request.onsuccess && request.onsuccess();
        } catch (error) {
          request.error = error;
          request.onerror && request.onerror();
        }
      }, 0);
      return request;
    };

    return {
      put(payload) {
        const value = { ...payload };
        store.records.set(value.id, value);
      },
      get(id) {
        return createSimpleRequest(() => store.records.get(id));
      },
      delete(id) {
        store.records.delete(id);
      },
      clear() {
        store.records.clear();
      },
      index(indexName) {
        if (indexName !== 'updatedAt') {
          throw new Error('Only updatedAt index is supported in mock');
        }
        return {
          openCursor(_query, direction) {
            const request = createRequest();
            const entries = [...store.records.values()].sort((a, b) => {
              const delta = (a.updatedAt || 0) - (b.updatedAt || 0);
              return direction === 'prev' ? -delta : delta;
            });
            let idx = 0;
            const emit = () => {
              request.result = idx < entries.length
                ? {
                    value: entries[idx],
                    continue() {
                      idx += 1;
                      setTimeout(emit, 0);
                    },
                  }
                : null;
              request.onsuccess && request.onsuccess();
            };
            setTimeout(emit, 0);
            return request;
          },
        };
      },
    };
  };

  return {
    open(name, version) {
      const request = createRequest();
      setTimeout(() => {
        const existing = databases.get(name);
        if (!existing) {
          const dbRecord = { version, stores: new Map() };
          const db = {
            objectStoreNames: {
              contains: (storeName) => dbRecord.stores.has(storeName),
            },
            createObjectStore(storeName) {
              const store = { records: new Map() };
              store.createIndex = () => {};
              dbRecord.stores.set(storeName, store);
              return store;
            },
            transaction(storeName) {
              const tx = {
                oncomplete: null,
                onerror: null,
                onabort: null,
                error: null,
                objectStore: () => createStoreApi(dbRecord, storeName),
              };
              setTimeout(() => {
                tx.oncomplete && tx.oncomplete();
              }, 10);
              return tx;
            },
            close() {},
          };
          dbRecord.db = db;
          databases.set(name, dbRecord);
          request.result = db;
          request.onupgradeneeded && request.onupgradeneeded();
          request.onsuccess && request.onsuccess();
          return;
        }
        request.result = existing.db;
        request.onsuccess && request.onsuccess();
      }, 0);
      return request;
    },
  };
}

async function run() {
  global.localStorage = createLocalStorageMock();
  global.indexedDB = createIndexedDbMock();
  // Keep runtime crypto behavior as-is for portability across Node/browser-like environments.

  delete require.cache[require.resolve('../src/workspaceStorage.js')];
  const api = require('../src/workspaceStorage.js');

  const empty = await api.getAllWorkspaces();
  assert(Array.isArray(empty) && empty.length === 0, 'expected empty workspace list initially');

  const saved = await api.saveWorkspace({ name: 'A' });
  assert(typeof saved.id === 'string' && saved.id.length > 0, 'saveWorkspace should generate a non-empty id');
  assert(saved.schemaVersion === api.CURRENT_SCHEMA_VERSION, 'save should include schemaVersion');

  const loaded = await api.loadWorkspace(saved.id);
  assert(loaded && loaded.name === 'A', 'loadWorkspace should return saved payload');

  await api.saveWorkspace({ id: 'older', updatedAt: 1, name: 'older' });
  await api.saveWorkspace({ id: 'newer', updatedAt: Number.MAX_SAFE_INTEGER - 1, name: 'newer' });
  const all = await api.getAllWorkspaces();
  assert(all[0].id === 'newer', 'getAllWorkspaces should sort by updatedAt desc');

  await api.deleteWorkspace(saved.id);
  const missing = await api.loadWorkspace(saved.id);
  assert(missing === null, 'deleteWorkspace should remove record');

  await api.deleteAllWorkspaces();
  const afterDeleteAll = await api.getAllWorkspaces();
  assert(afterDeleteAll.length === 0, 'deleteAllWorkspaces should remove all records');

  console.log('Workspace storage checks passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
