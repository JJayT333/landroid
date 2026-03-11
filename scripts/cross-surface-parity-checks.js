const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadWorkspace() {
  const file = path.join(process.cwd(), 'testdata', 'deskmap-stress-5x200.workspace.json');
  const raw = fs.readFileSync(file, 'utf8');
  const workspace = JSON.parse(raw);
  assert(Array.isArray(workspace.deskMaps), 'workspace missing deskMaps array');
  return workspace;
}

function summarizeNodes(nodes) {
  return nodes.reduce((acc, node) => {
    acc.total += 1;
    if (node.type === 'related') acc.related += 1;
    else acc.conveyance += 1;
    if (node.parentId === null) acc.roots += 1;
    if (node.parentId === 'unlinked') acc.unlinked += 1;
    return acc;
  }, { total: 0, conveyance: 0, related: 0, roots: 0, unlinked: 0 });
}

function buildRunsheetViewNodes(mapNodes, showOnlyConveyances) {
  return [...mapNodes]
    .sort((a, b) => {
      const timeA = new Date(a.date || '').getTime();
      const timeB = new Date(b.date || '').getTime();
      if (timeA !== timeB) return timeA - timeB;
      return String(a.id).localeCompare(String(b.id));
    })
    .filter((node) => (showOnlyConveyances ? (node.type !== 'related' && node.parentId !== 'unlinked') : true));
}

function buildFlowchartProjection(maps, activeDeskMapId, filterMode) {
  const selectedMaps = filterMode === 'all'
    ? maps
    : filterMode === 'active'
      ? maps.filter((map) => map.id === activeDeskMapId)
      : maps.filter((map) => map.id === filterMode);

  const projectedNodes = [];
  const projectedEdges = [];

  selectedMaps.forEach((map) => {
    const nodeIds = new Set((map.nodes || []).map((node) => node.id));
    (map.nodes || []).forEach((node) => {
      projectedNodes.push({ mapId: map.id, id: node.id, parentId: node.parentId });
      if (node.parentId !== null && node.parentId !== 'unlinked') {
        assert(nodeIds.has(node.parentId), `${map.id}: flow projection parent missing (${node.parentId})`);
        assert(node.parentId !== node.id, `${map.id}: self edge at ${node.id}`);
        projectedEdges.push({ from: node.parentId, to: node.id, mapId: map.id });
      }
    });
  });

  return { selectedMaps, projectedNodes, projectedEdges };
}

function verifyCycleFree(map) {
  const nodes = map.nodes || [];
  const childrenByParent = new Map();
  nodes.forEach((node) => {
    if (!childrenByParent.has(node.parentId)) childrenByParent.set(node.parentId, []);
    childrenByParent.get(node.parentId).push(node.id);
  });

  const visiting = new Set();
  const visited = new Set();

  function dfs(nodeId) {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) throw new Error(`${map.id}: cycle detected at ${nodeId}`);
    visiting.add(nodeId);
    const children = childrenByParent.get(nodeId) || [];
    children.forEach(dfs);
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  nodes.filter((node) => node.parentId === null).forEach((root) => dfs(root.id));
}

function run() {
  const workspace = loadWorkspace();
  const allMaps = workspace.deskMaps;
  assert(allMaps.length === 5, `expected 5 desk maps, got ${allMaps.length}`);

  allMaps.forEach((map) => {
    const nodes = map.nodes || [];
    assert(nodes.length === 200, `${map.id}: expected 200 nodes, got ${nodes.length}`);

    const summary = summarizeNodes(nodes);
    assert(summary.total === nodes.length, `${map.id}: node summary mismatch`);

    const allRecords = buildRunsheetViewNodes(nodes, false);
    const conveyOnly = buildRunsheetViewNodes(nodes, true);
    assert(allRecords.length === summary.total, `${map.id}: title ledger all-record count mismatch`);
    assert(conveyOnly.length === summary.conveyance - summary.unlinked, `${map.id}: conveyance-only count mismatch`);

    const unlinkedLedgerCount = allRecords.filter((node) => node.parentId === 'unlinked').length;
    assert(unlinkedLedgerCount === summary.unlinked, `${map.id}: unlinked ledger mismatch`);

    verifyCycleFree(map);
  });

  const allProjection = buildFlowchartProjection(allMaps, workspace.activeDeskMapId, 'all');
  assert(allProjection.selectedMaps.length === allMaps.length, 'flow all mode map selection mismatch');
  assert(allProjection.projectedNodes.length === allMaps.reduce((sum, map) => sum + map.nodes.length, 0), 'flow all mode node count mismatch');

  const activeProjection = buildFlowchartProjection(allMaps, workspace.activeDeskMapId, 'active');
  assert(activeProjection.selectedMaps.length === 1, 'flow active mode should select exactly one map');
  assert(activeProjection.selectedMaps[0].id === workspace.activeDeskMapId, 'flow active mode selected wrong map');

  allMaps.forEach((map) => {
    const selectedProjection = buildFlowchartProjection(allMaps, workspace.activeDeskMapId, map.id);
    assert(selectedProjection.selectedMaps.length === 1, `${map.id}: selected-map filter should return one map`);
    assert(selectedProjection.selectedMaps[0].id === map.id, `${map.id}: selected-map filter returned wrong map`);
    assert(selectedProjection.projectedNodes.length === map.nodes.length, `${map.id}: selected-map flow node count mismatch`);
  });

  console.log(`Cross-surface parity checks passed (${allMaps.length} maps, ${allMaps.length * 200} records)`);
}

run();
