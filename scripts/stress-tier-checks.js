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
        if (parent && parent.type === 'conveyance') {
          parent.fraction = mathEngine.clampFraction((parent.fraction || 0) - fraction);
        }
      }
      nodes.push({ id, parentId: parent ? parent.id : rootId, type, fraction, initialFraction });
    }

    deskMaps.push({ id: `map-${mapIdx}`, nodes, code: `M${mapIdx}`, name: `Map ${mapIdx}` });
  }
  return { deskMaps, activeDeskMapId: deskMaps[0]?.id || null };
}

function buildShapedWorkspace({ name, nodeCount, seed, shape }) {
  const rng = createRng(seed);
  const rootId = `${name}-root`;
  const nodes = [{ id: rootId, parentId: null, type: 'conveyance', fraction: 1, initialFraction: 1 }];
  const conveyanceIds = [rootId];

  for (let i = 1; i < nodeCount; i += 1) {
    const id = `${name}-n${i}`;
    const relatedBias = shape === 'unlinked-dense' ? 0.3 : 0.12;
    const unlinkedBias = shape === 'unlinked-dense' ? 0.28 : 0;
    const isUnlinked = rng() < unlinkedBias;
    const type = rng() < relatedBias ? 'related' : 'conveyance';

    let parentId = null;
    if (!isUnlinked) {
      if (shape === 'deep-chain') {
        parentId = nodes[nodes.length - 1].id;
      } else if (shape === 'wide-fan') {
        parentId = rootId;
      } else {
        parentId = conveyanceIds[Math.floor(rng() * conveyanceIds.length)] || rootId;
      }
    } else {
      parentId = 'unlinked';
    }

    let fraction = 0;
    let initialFraction = 0;
    if (type === 'conveyance' && parentId !== 'unlinked') {
      const parent = nodes.find((node) => node.id === parentId);
      const maxShare = Math.min(parent?.fraction || 0, shape === 'wide-fan' ? 0.03 : 0.15);
      const share = maxShare * (0.15 + rng() * 0.85);
      fraction = mathEngine.clampFraction(share);
      initialFraction = fraction;
      if (parent && parent.type === 'conveyance') {
        parent.fraction = mathEngine.clampFraction((parent.fraction || 0) - fraction);
      }
      conveyanceIds.push(id);
    }

    nodes.push({ id, parentId, type, fraction, initialFraction });
  }

  return { deskMaps: [{ id: `${name}-map`, code: name.toUpperCase(), name, nodes }], activeDeskMapId: `${name}-map` };
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

function assertWorkspaceInvariants(name, workspace) {
  workspace.deskMaps.forEach((map) => {
    const validation = mathEngine.validateOwnershipGraph(map.nodes);
    assert(validation.valid, `${name}: invalid graph for ${map.id}: ${validation.issues[0]?.message || 'unknown issue'}`);
    map.nodes.forEach((node) => {
      assert(Number.isFinite(Number(node.fraction || 0)), `${name}: non-finite fraction at ${node.id}`);
      assert(Number.isFinite(Number(node.initialFraction || 0)), `${name}: non-finite initial fraction at ${node.id}`);
      assert(Number(node.fraction || 0) >= -mathEngine.FRACTION_EPSILON, `${name}: negative fraction at ${node.id}`);
      assert(Number(node.initialFraction || 0) >= -mathEngine.FRACTION_EPSILON, `${name}: negative initial fraction at ${node.id}`);
    });
  });
}

function runShapedTier(name, nodeCount, seed, shape) {
  const workspace = buildShapedWorkspace({ name, nodeCount, seed, shape });
  const runsheet = deriveRunsheetAll(workspace);
  const edges = deriveFlowAll(workspace);
  assertWorkspaceInvariants(name, workspace);
  assert(runsheet.length === nodeCount, `${name}: runsheet node count mismatch`);
  const unlinkedCount = workspace.deskMaps[0].nodes.filter((node) => node.parentId === 'unlinked').length;
  console.log(`[stress-tier] ${name}: shape=${shape}, nodes=${nodeCount}, edges=${edges.length}, unlinked=${unlinkedCount}, seed=${seed}`);
}

function runSeededInvariantMatrix() {
  const seeds = [17, 1701, 17001];
  seeds.forEach((seed) => {
    const workspace = buildSyntheticWorkspace(3, 150, seed);
    assertWorkspaceInvariants(`seed-matrix-${seed}`, workspace);
    const roots = workspace.deskMaps
      .flatMap((map) => map.nodes)
      .filter((node) => node.parentId === null)
      .length;
    assert(roots === 3, `seed-matrix-${seed}: expected one root per map`);
    console.log(`[stress-tier] seed-matrix-${seed}: deterministic invariant pass`);
  });
}

function run() {
  runTier('small-1x50', 1, 50, 11);
  runTier('baseline-5x200', 5, 200, 29);
  runTier('large-10x500', 10, 500, 47);
  runShapedTier('shape-deep-chain-1x300', 300, 101, 'deep-chain');
  runShapedTier('shape-wide-fan-1x300', 300, 202, 'wide-fan');
  runShapedTier('shape-unlinked-dense-1x300', 300, 303, 'unlinked-dense');
  runSeededInvariantMatrix();
  console.log('Stress tier checks passed');
}

run();
