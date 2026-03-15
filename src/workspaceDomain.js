(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LANDroidWorkspaceDomain = factory();
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  function serializeNodesForSave(sourceNodes) {
    return (sourceNodes || []).map((node) => {
      const copy = { ...node };
      if (copy.docData) copy.hasDoc = true;
      delete copy.docData;
      return copy;
    });
  }

  function toWorkspaceSavePayload(state) {
    const {
      projectName,
      nodes,
      instrumentList,
      flowNodes,
      flowEdges,
      flowPz,
      treeScale,
      printOrientation,
      gridCols,
      gridRows,
      tracts,
      contacts,
      ownershipInterests,
      contactLogs,
      deskMaps,
      activeDeskMapId,
      appId,
    } = state;

    return {
      name: (projectName || '').trim(),
      nodes: serializeNodesForSave(nodes),
      instrumentList,
      flowNodes,
      flowEdges,
      flowLayoutVersion: state.flowLayoutVersion,
      flowPz,
      treeScale,
      printOrientation,
      gridCols,
      gridRows,
      tracts,
      contacts,
      ownershipInterests,
      contactLogs,
      deskMaps: (deskMaps || []).map((map) => ({ ...map, nodes: serializeNodesForSave(map.nodes || []) })),
      activeDeskMapId,
      updatedAt: Date.now(),
      appId,
    };
  }

  function fromStoredWorkspace(payload, deps) {
    const {
      makeId,
      defaultRoot,
      defaultViewport,
      defaultFlowViewport,
      normalizeFlowNodeGroups,
    } = deps;

    const workspace = payload || {};
    const flowNodes = workspace.flowNodes ? normalizeFlowNodeGroups(workspace.flowNodes) : undefined;
    const flowLayoutVersion = workspace.flowLayoutVersion || 0;
    const flowPz = workspace.flowPz || { ...defaultFlowViewport };
    const tracts = workspace.tracts || [];
    const contacts = workspace.contacts || [];

    const deskMaps = Array.isArray(workspace.deskMaps) ? workspace.deskMaps : [];
    const activeDeskMapId =
      workspace.activeDeskMapId && deskMaps.some((map) => map.id === workspace.activeDeskMapId)
        ? workspace.activeDeskMapId
        : (deskMaps[0]?.id || '');
    const activeDeskMap = deskMaps.find((map) => map.id === activeDeskMapId) || null;

    return {
      nodes: activeDeskMap?.nodes || workspace.nodes || [{ ...defaultRoot }],
      instrumentList: workspace.instrumentList,
      flowNodes,
      flowEdges: workspace.flowEdges,
      flowLayoutVersion,
      flowPz,
      treeScale: workspace.treeScale,
      printOrientation: workspace.printOrientation,
      gridCols: workspace.gridCols,
      gridRows: workspace.gridRows,
      tracts,
      contacts,
      ownershipInterests: workspace.ownershipInterests || [],
      contactLogs: workspace.contactLogs || [],
      selectedContactId: (contacts[0] && contacts[0].id) || null,
      deskMaps,
      activeDeskMapId,
      pz: activeDeskMap?.pz || { ...defaultViewport },
      projectName: workspace.name || '',
      workspaceId: workspace.id || null,
    };
  }

  return {
    serializeNodesForSave,
    toWorkspaceSavePayload,
    fromStoredWorkspace,
  };
});
