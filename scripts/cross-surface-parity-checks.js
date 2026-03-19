const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i += 2; continue; }
      inQuotes = !inQuotes; i += 1; continue;
    }
    if (ch === ',' && !inQuotes) { cells.push(current); current = ''; i += 1; continue; }
    current += ch; i += 1;
  }
  cells.push(current);
  return cells;
}

function loadWorkspaceFromCsv(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  assert(lines.length >= 2, 'CSV missing header or rows');
  const headers = parseCsvLine(lines[0]);
  const firstCells = parseCsvLine(lines[1]);
  const firstRow = {};
  headers.forEach((h, idx) => { firstRow[h] = firstCells[idx] ?? ''; });
  const deskMaps = JSON.parse(firstRow['INTERNAL_DESKMAPS'] || '[]');
  const activeDeskMapId = firstRow['INTERNAL_ACTIVE_DESKMAP_ID'] || (deskMaps[0]?.id || '');
  assert(Array.isArray(deskMaps) && deskMaps.length > 0, `${csvPath}: no embedded desk maps`);
  return { deskMaps, activeDeskMapId };
}

function loadWorkspace() {
  const csvFile = path.join(process.cwd(), 'test-200-realistic.import.csv');
  return loadWorkspaceFromCsv(csvFile);
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

function verifyWorkspace(workspace, label) {
  const allMaps = workspace.deskMaps;
  assert(allMaps.length >= 1, `${label}: expected at least 1 desk map, got ${allMaps.length}`);

  let totalRecords = 0;
  allMaps.forEach((map) => {
    const nodes = map.nodes || [];
    assert(nodes.length > 0, `${label}/${map.id}: expected nodes, got 0`);
    totalRecords += nodes.length;

    const summary = summarizeNodes(nodes);
    assert(summary.total === nodes.length, `${label}/${map.id}: node summary mismatch`);

    const allRecords = buildRunsheetViewNodes(nodes, false);
    const conveyOnly = buildRunsheetViewNodes(nodes, true);
    assert(allRecords.length === summary.total, `${label}/${map.id}: title ledger all-record count mismatch`);
    assert(conveyOnly.length === summary.conveyance - summary.unlinked, `${label}/${map.id}: conveyance-only count mismatch`);

    const unlinkedLedgerCount = allRecords.filter((node) => node.parentId === 'unlinked').length;
    assert(unlinkedLedgerCount === summary.unlinked, `${label}/${map.id}: unlinked ledger mismatch`);

    verifyCycleFree(map);
  });

  const allProjection = buildFlowchartProjection(allMaps, workspace.activeDeskMapId, 'all');
  assert(allProjection.selectedMaps.length === allMaps.length, `${label}: flow all mode map selection mismatch`);
  assert(allProjection.projectedNodes.length === allMaps.reduce((sum, map) => sum + map.nodes.length, 0), `${label}: flow all mode node count mismatch`);

  const activeProjection = buildFlowchartProjection(allMaps, workspace.activeDeskMapId, 'active');
  assert(activeProjection.selectedMaps.length === 1, `${label}: flow active mode should select exactly one map`);
  assert(activeProjection.selectedMaps[0].id === workspace.activeDeskMapId, `${label}: flow active mode selected wrong map`);

  allMaps.forEach((map) => {
    const selectedProjection = buildFlowchartProjection(allMaps, workspace.activeDeskMapId, map.id);
    assert(selectedProjection.selectedMaps.length === 1, `${label}/${map.id}: selected-map filter should return one map`);
    assert(selectedProjection.selectedMaps[0].id === map.id, `${label}/${map.id}: selected-map filter returned wrong map`);
    assert(selectedProjection.projectedNodes.length === map.nodes.length, `${label}/${map.id}: selected-map flow node count mismatch`);
  });

  return { maps: allMaps.length, records: totalRecords };
}

function run() {
  const csvFiles = [
    'test-200-realistic.import.csv',
    'test-500-realistic.import.csv',
    'test-1024-realistic.import.csv',
  ];
  let totalMaps = 0;
  let totalRecords = 0;
  csvFiles.forEach((file) => {
    const csvPath = path.join(process.cwd(), file);
    const workspace = loadWorkspaceFromCsv(csvPath);
    const result = verifyWorkspace(workspace, file);
    totalMaps += result.maps;
    totalRecords += result.records;
  });

  console.log(`Cross-surface parity checks passed (${totalMaps} maps, ${totalRecords} records)`);
}

run();
