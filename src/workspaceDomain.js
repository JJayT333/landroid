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
    const flowPz = workspace.flowPz || { ...defaultFlowViewport };
    const tracts = workspace.tracts || [];
    const contacts = workspace.contacts || [];

    const fallbackDeskMap = {
      id: makeId(),
      name: tracts[0]?.name || 'Unit Tract 1',
      code: tracts[0]?.code || 'TRACT-1',
      tractId: tracts[0]?.id || null,
      nodes: workspace.nodes || [{ ...defaultRoot }],
      pz: { ...defaultViewport },
    };

    const deskMaps = workspace.deskMaps && workspace.deskMaps.length ? workspace.deskMaps : [fallbackDeskMap];
    const activeDeskMapId =
      workspace.activeDeskMapId && deskMaps.some((map) => map.id === workspace.activeDeskMapId)
        ? workspace.activeDeskMapId
        : deskMaps[0].id;
    const activeDeskMap = deskMaps.find((map) => map.id === activeDeskMapId) || deskMaps[0];

    return {
      nodes: activeDeskMap.nodes || workspace.nodes || [{ ...defaultRoot }],
      instrumentList: workspace.instrumentList,
      flowNodes,
      flowEdges: workspace.flowEdges,
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
      pz: activeDeskMap.pz || { ...defaultViewport },
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
