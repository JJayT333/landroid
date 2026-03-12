function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const mathEngine = require('../src/mathEngine.js');

function nowMs() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildSyntheticWorkspace(mapCount, nodesPerMap, seed) {
  const rng = createRng(seed);
  const deskMaps = [];
  for (let mapIdx = 0; mapIdx < mapCount; mapIdx += 1) {
    const nodes = [];
    const rootId = `m${mapIdx}-root`;
    nodes.push({ id: rootId, parentId: null, type: 'conveyance', fraction: 1, initialFraction: 1 });

    for (let i = 1; i < nodesPerMap; i += 1) {
      const parent = nodes[Math.floor(rng() * nodes.length)];
      const type = rng() < 0.12 ? 'related' : 'conveyance';
      const id = `m${mapIdx}-n${i}`;
      let fraction = 0;
      let initialFraction = 0;
      if (type === 'conveyance') {
        const share = parent && parent.type === 'conveyance' ? Math.min(parent.fraction || 0, 0.01 + rng() * 0.2) : 0;
        fraction = mathEngine.clampFraction(share);
        initialFraction = fraction;
      }
      nodes.push({ id, parentId: parent ? parent.id : rootId, type, fraction, initialFraction });
    }

    deskMaps.push({ id: `map-${mapIdx}`, nodes, code: `M${mapIdx}`, name: `Map ${mapIdx}` });
  }
  return { deskMaps, activeDeskMapId: deskMaps[0]?.id || null };
}

function deriveRunsheetAll(workspace) {
  return workspace.deskMaps.flatMap((map) => map.nodes.map((node) => ({ ...node, __mapId: map.id })));
}

function deriveFlowAll(workspace) {
  const edges = [];
  workspace.deskMaps.forEach((map) => {
    const ids = new Set(map.nodes.map((n) => n.id));
    map.nodes.forEach((node) => {
      if (node.parentId !== null && node.parentId !== 'unlinked' && node.type !== 'related') {
        assert(ids.has(node.parentId), `${map.id}: missing parent ${node.parentId}`);
        edges.push({ from: node.parentId, to: node.id });
      }
    });
  });
  return edges;
}

function runTier(name, mapCount, nodesPerMap, seed) {
  const workspace = buildSyntheticWorkspace(mapCount, nodesPerMap, seed);
  const totalNodes = mapCount * nodesPerMap;

  const startRunsheet = nowMs();
  const runsheet = deriveRunsheetAll(workspace);
  const runsheetMs = nowMs() - startRunsheet;

  const startFlow = nowMs();
  const edges = deriveFlowAll(workspace);
  const flowMs = nowMs() - startFlow;

  workspace.deskMaps.forEach((map) => {
    const validation = mathEngine.validateOwnershipGraph(map.nodes);
    assert(validation.valid, `${name}: graph invalid for ${map.id}: ${validation.issues[0]?.message || 'unknown issue'}`);
  });

  assert(runsheet.length === totalNodes, `${name}: runsheet node count mismatch`);
  console.log(`[stress-tier] ${name}: nodes=${totalNodes}, edges=${edges.length}, runsheet=${runsheetMs.toFixed(2)}ms, flow=${flowMs.toFixed(2)}ms`);
}

function run() {
  runTier('small-1x50', 1, 50, 11);
  runTier('baseline-5x200', 5, 200, 29);
  runTier('large-10x500', 10, 500, 47);
  console.log('Stress tier checks passed');
}

run();
