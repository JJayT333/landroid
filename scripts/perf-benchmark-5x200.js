const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nowMs() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function measure(label, fn) {
  const start = nowMs();
  const result = fn();
  const end = nowMs();
  return { label, durationMs: end - start, result };
}

function loadWorkspaceFixture() {
  const filePath = path.join(process.cwd(), 'testdata', 'deskmap-stress-5x200.workspace.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const workspace = JSON.parse(raw);
  assert(Array.isArray(workspace.deskMaps), 'workspace fixture missing deskMaps');
  return workspace;
}

function buildRunsheetNodes(workspace, mode = 'all') {
  const maps = workspace.deskMaps || [];
  if (mode === 'all') {
    return maps.flatMap((map) => (map.nodes || []).map((node) => ({
      ...node,
      __deskMapId: map.id,
      __deskMapLabel: `${map.code || ''} ${map.name || ''}`.trim(),
    })));
  }
  if (mode === 'active') {
    const activeMap = maps.find((map) => map.id === workspace.activeDeskMapId) || maps[0];
    return (activeMap?.nodes || []).map((node) => ({
      ...node,
      __deskMapId: activeMap?.id || workspace.activeDeskMapId,
      __deskMapLabel: `${activeMap?.code || ''} ${activeMap?.name || ''}`.trim(),
    }));
  }
  const selected = maps.find((map) => map.id === mode);
  return (selected?.nodes || []).map((node) => ({
    ...node,
    __deskMapId: selected?.id,
    __deskMapLabel: `${selected?.code || ''} ${selected?.name || ''}`.trim(),
  }));
}

function deriveLedgerViews(nodes) {
  const sorted = [...nodes].sort((a, b) => {
    const d = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (d !== 0) return d;
    return String(a.id).localeCompare(String(b.id));
  });
  const conveyanceOnly = sorted.filter((node) => node.type !== 'related' && node.parentId !== 'unlinked');
  const looseCount = sorted.reduce((count, node) => count + (node.parentId === 'unlinked' ? 1 : 0), 0);
  return { sorted, conveyanceOnly, looseCount };
}

function deriveFlowProjection(workspace, filterMode = 'all') {
  const maps = workspace.deskMaps || [];
  const selectedMaps = filterMode === 'all'
    ? maps
    : filterMode === 'active'
      ? maps.filter((map) => map.id === workspace.activeDeskMapId)
      : maps.filter((map) => map.id === filterMode);

  const nodes = [];
  const edges = [];
  selectedMaps.forEach((map) => {
    const nodeIds = new Set((map.nodes || []).map((node) => node.id));
    (map.nodes || []).forEach((node) => {
      nodes.push({ mapId: map.id, id: node.id, parentId: node.parentId });
      if (node.parentId !== null && node.parentId !== 'unlinked') {
        assert(nodeIds.has(node.parentId), `${map.id}: invalid parent for ${node.id}`);
        edges.push({ mapId: map.id, from: node.parentId, to: node.id });
      }
    });
  });

  return { nodes, edges, selectedMapCount: selectedMaps.length };
}

function evaluateThresholds(results) {
  // Conservative, deterministic thresholds for this fixture size in CI/local containers.
  const thresholdsMs = {
    load_fixture: 120,
    derive_runsheet_all: 120,
    derive_ledger_views_all: 120,
    derive_flow_all: 120,
  };

  let warningCount = 0;
  Object.entries(thresholdsMs).forEach(([key, threshold]) => {
    const hit = results.find((row) => row.label === key);
    if (!hit) return;
    if (hit.durationMs > threshold) {
      warningCount += 1;
      console.warn(`[perf-warning] ${key} took ${hit.durationMs.toFixed(2)}ms (threshold ${threshold}ms)`);
    }
  });

  return { warningCount, thresholdsMs };
}

function run() {
  const timingRows = [];

  const loadTiming = measure('load_fixture', () => loadWorkspaceFixture());
  timingRows.push(loadTiming);
  const workspace = loadTiming.result;

  const runsheetAllTiming = measure('derive_runsheet_all', () => buildRunsheetNodes(workspace, 'all'));
  timingRows.push(runsheetAllTiming);

  const ledgerAllTiming = measure('derive_ledger_views_all', () => deriveLedgerViews(runsheetAllTiming.result));
  timingRows.push(ledgerAllTiming);

  const flowAllTiming = measure('derive_flow_all', () => deriveFlowProjection(workspace, 'all'));
  timingRows.push(flowAllTiming);

  const activeRunsheetTiming = measure('derive_runsheet_active', () => buildRunsheetNodes(workspace, 'active'));
  timingRows.push(activeRunsheetTiming);

  const activeFlowTiming = measure('derive_flow_active', () => deriveFlowProjection(workspace, 'active'));
  timingRows.push(activeFlowTiming);

  const fixtureStats = {
    deskMapCount: (workspace.deskMaps || []).length,
    totalNodes: (workspace.deskMaps || []).reduce((sum, map) => sum + (map.nodes || []).length, 0),
    activeMapId: workspace.activeDeskMapId,
    activeRunsheetNodeCount: activeRunsheetTiming.result.length,
    allRunsheetNodeCount: runsheetAllTiming.result.length,
    conveyanceOnlyCount: ledgerAllTiming.result.conveyanceOnly.length,
    looseRecordCount: ledgerAllTiming.result.looseCount,
    flowAllNodes: flowAllTiming.result.nodes.length,
    flowAllEdges: flowAllTiming.result.edges.length,
    flowActiveNodes: activeFlowTiming.result.nodes.length,
    flowActiveEdges: activeFlowTiming.result.edges.length,
  };

  assert(fixtureStats.deskMapCount === 5, `expected 5 desk maps, got ${fixtureStats.deskMapCount}`);
  assert(fixtureStats.totalNodes === 1000, `expected 1000 nodes, got ${fixtureStats.totalNodes}`);

  const { warningCount } = evaluateThresholds(timingRows);

  console.log('Performance benchmark (5x200) complete.');
  timingRows.forEach((row) => {
    console.log(`- ${row.label}: ${row.durationMs.toFixed(2)}ms`);
  });
  console.log(`- fixture: maps=${fixtureStats.deskMapCount}, totalNodes=${fixtureStats.totalNodes}, allRunsheetNodes=${fixtureStats.allRunsheetNodeCount}, flowAllEdges=${fixtureStats.flowAllEdges}`);
  console.log(`- warnings: ${warningCount}`);
}

run();
