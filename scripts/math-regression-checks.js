function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const FRACTION_EPSILON = 0.00000001;

function clampFraction(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0 && numeric > -FRACTION_EPSILON) return 0;
  return Math.max(0, numeric);
}

function collectDescendantIds(allNodes, rootId) {
  const descendants = new Set();
  const queue = [rootId];
  while (queue.length) {
    const currentId = queue.shift();
    allNodes.forEach((node) => {
      if (node.parentId !== currentId || descendants.has(node.id)) return;
      descendants.add(node.id);
      queue.push(node.id);
    });
  }
  return descendants;
}

function applyBranchScale(allNodes, rootId, scaleFactor) {
  if (!Number.isFinite(scaleFactor)) return allNodes;
  const descendants = collectDescendantIds(allNodes, rootId);
  return allNodes.map((n) => {
    if (n.id !== rootId && !descendants.has(n.id)) return n;
    return {
      ...n,
      fraction: clampFraction((n.fraction || 0) * scaleFactor),
      initialFraction: clampFraction((n.initialFraction || 0) * scaleFactor),
    };
  });
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pickRandom(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function validateNodes(nodes, label) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  assert(byId.size === nodes.length, `${label}: duplicate ids detected`);

  nodes.forEach((n) => {
    assert(Number.isFinite(n.fraction), `${label}: non-finite fraction at ${n.id}`);
    assert(Number.isFinite(n.initialFraction), `${label}: non-finite initialFraction at ${n.id}`);
    assert(n.fraction >= -FRACTION_EPSILON, `${label}: negative fraction at ${n.id}`);
    assert(n.initialFraction >= -FRACTION_EPSILON, `${label}: negative initialFraction at ${n.id}`);
    if (n.parentId !== null) {
      assert(byId.has(n.parentId), `${label}: missing parent ${n.parentId} for ${n.id}`);
      assert(n.parentId !== n.id, `${label}: self-parent cycle at ${n.id}`);
    }
  });

  // Cycle detection
  const visiting = new Set();
  const visited = new Set();
  function dfs(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`${label}: cycle detected at ${id}`);
    visiting.add(id);
    nodes.forEach((n) => {
      if (n.parentId === id) dfs(n.id);
    });
    visiting.delete(id);
    visited.add(id);
  }
  nodes.filter((n) => n.parentId === null).forEach((root) => dfs(root.id));

  const byIdMap = new Map(nodes.map((n) => [n.id, n]));
  const rootSums = new Map();
  nodes.forEach((node) => {
    if (node.type === 'related' || node.fraction <= FRACTION_EPSILON) return;
    let cursor = node;
    while (cursor.parentId !== null) {
      cursor = byIdMap.get(cursor.parentId);
      if (!cursor) throw new Error(`${label}: missing ancestor for ${node.id}`);
    }
    rootSums.set(cursor.id, (rootSums.get(cursor.id) || 0) + node.fraction);
  });
  rootSums.forEach((sum, rootId) => {
    assert(sum <= 1.05, `${label}: root ${rootId} exceeds 100% (${sum})`);
    assert(sum >= -FRACTION_EPSILON, `${label}: root ${rootId} negative total (${sum})`);
  });
}

function runScenario(seed, targetNodeCount) {
  const rng = createRng(seed);
  let id = 0;
  const makeId = () => `n-${seed}-${++id}`;

  let nodes = [{
    id: makeId(),
    parentId: null,
    grantee: 'Person-0',
    grantor: 'Origin',
    type: 'conveyance',
    initialFraction: 1,
    fraction: 1,
  }];

  // grow primary chain/tree
  while (nodes.length < targetNodeCount - 15) {
    const candidates = nodes.filter((n) => n.type === 'conveyance' && n.fraction > 0.001);
    if (!candidates.length) break;
    const parent = pickRandom(candidates, rng);
    const maxShare = Math.max(0, parent.fraction * (0.15 + rng() * 0.55));
    const share = clampFraction(Math.min(parent.fraction, maxShare));
    const child = {
      id: makeId(),
      parentId: parent.id,
      grantee: `Person-${id}`,
      grantor: parent.grantee,
      type: 'conveyance',
      initialFraction: share,
      fraction: share,
    };
    nodes = nodes.map((n) => n.id === parent.id ? { ...n, fraction: clampFraction(n.fraction - share) } : n);
    nodes.push(child);
  }

  // add separate mini-roots to later attach/merge
  for (let i = 0; i < 5; i += 1) {
    const base = 0.01 + rng() * 0.03;
    const root = {
      id: makeId(), parentId: null, grantee: `LooseRoot-${i}`, grantor: 'Unknown', type: 'conveyance',
      initialFraction: base, fraction: base,
    };
    const child = {
      id: makeId(), parentId: root.id, grantee: `LooseChild-${i}`, grantor: root.grantee, type: 'conveyance',
      initialFraction: base * 0.4, fraction: base * 0.4,
    };
    root.fraction = clampFraction(root.fraction - child.fraction);
    nodes.push(root, child);
  }

  validateNodes(nodes, `seed ${seed} after build`);

  // correction round 1: predecessor updates on random nodes
  const nonRoots = nodes.filter((n) => n.parentId !== null && n.type === 'conveyance');
  for (let i = 0; i < Math.min(20, nonRoots.length); i += 1) {
    const activeNode = pickRandom(nonRoots, rng);
    const oldInitialFraction = Math.max(activeNode.initialFraction || 0, FRACTION_EPSILON);
    const parentNode = nodes.find((n) => n.id === activeNode.parentId);
    const maxAllowed = oldInitialFraction + Math.max(parentNode?.fraction || 0, 0);
    const proposed = oldInitialFraction * (0.45 + rng() * 1.2);
    const newInitialFraction = clampFraction(Math.min(proposed, maxAllowed));
    const scaleFactor = newInitialFraction / oldInitialFraction;
    const scaledNodes = applyBranchScale(nodes, activeNode.id, scaleFactor);

    nodes = scaledNodes.map((n) => {
      if (n.id === activeNode.id) return { ...n, parentId: `${activeNode.id}-pred-${i}` };
      if (activeNode.parentId && n.id === activeNode.parentId) {
        return { ...n, fraction: clampFraction((n.fraction || 0) + oldInitialFraction - newInitialFraction) };
      }
      return n;
    });

    nodes.push({
      id: `${activeNode.id}-pred-${i}`,
      parentId: activeNode.parentId,
      grantee: `${activeNode.grantor || 'Pred'}-${i}`,
      grantor: 'Predecessor',
      type: 'conveyance',
      initialFraction: newInitialFraction,
      fraction: 0,
    });

    validateNodes(nodes, `seed ${seed} after predecessor correction ${i}`);
  }

  // correction round 2: attach separate trees into main tree
  for (let i = 0; i < 5; i += 1) {
    const roots = nodes.filter((n) => n.parentId === null && n.type === 'conveyance');
    if (roots.length < 2) break;
    const sourceRoot = roots.find((r) => String(r.grantee || '').startsWith('LooseRoot-')) || pickRandom(roots, rng);
    const destinationCandidates = nodes.filter((n) => n.id !== sourceRoot.id && n.type === 'conveyance' && n.fraction > 0.001);
    if (!destinationCandidates.length) break;
    const destination = pickRandom(destinationCandidates, rng);

    const descendants = collectDescendantIds(nodes, sourceRoot.id);
    if (destination.id === sourceRoot.id || descendants.has(destination.id)) continue;

    const oldRootFraction = Math.max(sourceRoot.fraction || 0, FRACTION_EPSILON);
    const newRootFraction = clampFraction(Math.min(destination.fraction * (0.2 + rng() * 0.6), sourceRoot.fraction));
    const scaleFactor = newRootFraction / oldRootFraction;

    nodes = nodes.map((n) => {
      if (n.id === destination.id) return { ...n, fraction: clampFraction((n.fraction || 0) - newRootFraction) };
      if (n.id === sourceRoot.id) {
        return { ...n, parentId: destination.id, fraction: newRootFraction, initialFraction: newRootFraction };
      }
      if (descendants.has(n.id)) {
        return {
          ...n,
          fraction: clampFraction((n.fraction || 0) * scaleFactor),
          initialFraction: clampFraction((n.initialFraction || 0) * scaleFactor),
        };
      }
      return n;
    });

    validateNodes(nodes, `seed ${seed} after attach correction ${i}`);
  }

  return nodes.length;
}

function run() {
  const seeds = [11, 29, 47, 83, 131];
  const counts = [100, 110, 125, 140, 150];
  const totals = [];

  seeds.forEach((seed, idx) => {
    const count = runScenario(seed, counts[idx]);
    totals.push(count);
  });

  const min = Math.min(...totals);
  const max = Math.max(...totals);
  assert(min >= 100, `expected at least 100 nodes per scenario, got ${min}`);
  assert(max >= 140, `expected high-complexity scenario >=140 nodes, got ${max}`);
  console.log(`Math regression checks passed (${totals.length} scenarios, node counts: ${totals.join(', ')})`);
}

run();
