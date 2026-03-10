(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LANDroidStorageProvider = factory();
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  function createLocalStorageProvider(workspaceStorageApi) {
    if (!workspaceStorageApi) {
      throw new Error('workspaceStorageApi is required');
    }

    const {
      LOCAL_META_KEY,
      getAllWorkspaces,
      loadWorkspace,
      deleteWorkspace,
      deleteAllWorkspaces,
      saveWorkspace,
      getLatestWorkspace,
    } = workspaceStorageApi;

    return {
      LOCAL_META_KEY,
      listWorkspaces: getAllWorkspaces,
      loadWorkspace,
      saveWorkspace,
      deleteWorkspace,
      deleteAllWorkspaces,
      getLatestWorkspace,
      getLastWorkspaceId() {
        return localStorage.getItem(LOCAL_META_KEY);
      },
      setLastWorkspaceId(id) {
        if (!id) {
          localStorage.removeItem(LOCAL_META_KEY);
          return;
        }
        localStorage.setItem(LOCAL_META_KEY, id);
      },
      clearLastWorkspaceId() {
        localStorage.removeItem(LOCAL_META_KEY);
      },
    };
  }

  return {
    createLocalStorageProvider,
  };
});
