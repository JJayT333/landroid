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

  const createRequest = () => ({ onsuccess: null, onerror: null, result: null, error: null });

  const createStoreApi = (dbRecord, tx, storeName) => {
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
          const dbRecord = {
            version,
            stores: new Map(),
          };

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
                objectStore: () => createStoreApi(dbRecord, tx, storeName),
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

describe('workspace storage unit tests', () => {
  let localStorage;
  let indexedDB;
  let api;

  beforeEach(() => {
    localStorage = createLocalStorageMock();
    indexedDB = createIndexedDbMock();
    global.indexedDB = indexedDB;
    global.localStorage = localStorage;
    global.crypto = { randomUUID: () => 'uuid-fixed-123' };
    jest.resetModules();
    api = require('../src/workspaceStorage');
  });

  test('returns an empty list when there are no saved workspaces', async () => {
    await expect(api.getAllWorkspaces()).resolves.toEqual([]);
  });

  test('returns null when loading a non-existent workspace id or null id', async () => {
    await expect(api.loadWorkspace('missing-id')).resolves.toBeNull();
    await expect(api.loadWorkspace(null)).resolves.toBeNull();
  });

  test('throws on null input payload (null edge case)', async () => {
    await expect(api.saveWorkspace(null)).rejects.toThrow(TypeError);
  });

  test('creates ids, persists payloads, and tracks the latest workspace id in localStorage', async () => {
    const saved = await api.saveWorkspace({ name: 'A' });

    expect(saved.id).toBe('uuid-fixed-123');
    expect(localStorage.getItem(api.LOCAL_META_KEY)).toBe('uuid-fixed-123');

    const loaded = await api.loadWorkspace(saved.id);
    expect(loaded.name).toBe('A');
  });

  test('honors explicit workspace id at boundary length values', async () => {
    const boundaryId = 'x'.repeat(256);
    const saved = await api.saveWorkspace({ name: 'boundary' }, boundaryId);

    expect(saved.id).toHaveLength(256);
    expect(saved.id).toBe(boundaryId);
    expect(localStorage.getItem(api.LOCAL_META_KEY)).toBe(boundaryId);
  });

  test('orders getAllWorkspaces and getLatestWorkspace by updatedAt descending', async () => {
    await api.saveWorkspace({ id: 'older', updatedAt: 10, name: 'older' });
    await api.saveWorkspace({ id: 'newer', updatedAt: Number.MAX_SAFE_INTEGER - 1, name: 'newer' });

    const all = await api.getAllWorkspaces();
    expect(all.map((w) => w.id)).toEqual(['newer', 'older']);

    const latest = await api.getLatestWorkspace();
    expect(latest.id).toBe('newer');
  });

  test('deleteWorkspace removes workspace and clears local storage key when it matches', async () => {
    await api.saveWorkspace({ id: 'delete-me', name: 'x' }, 'delete-me');

    await api.deleteWorkspace('delete-me');

    await expect(api.loadWorkspace('delete-me')).resolves.toBeNull();
    expect(localStorage.getItem(api.LOCAL_META_KEY)).toBeNull();
  });

  test('deleteAllWorkspaces clears records and local storage metadata', async () => {
    await api.saveWorkspace({ id: 'one' }, 'one');
    await api.saveWorkspace({ id: 'two' }, 'two');

    await api.deleteAllWorkspaces();

    await expect(api.getAllWorkspaces()).resolves.toEqual([]);
    expect(localStorage.getItem(api.LOCAL_META_KEY)).toBeNull();
  });
});
