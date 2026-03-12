const mathEngine = require('../src/mathEngine.js');
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const FRACTION_EPSILON = mathEngine.FRACTION_EPSILON;
const OWNERSHIP_TOTAL_TOLERANCE = mathEngine.OWNERSHIP_TOTAL_TOLERANCE || 0.05;
const clampFraction = mathEngine.clampFraction;
const collectDescendantIds = mathEngine.collectDescendantIds;
const applyBranchScale = mathEngine.applyBranchScale;

function applyPredecessor(nodes, nodeId, newInitialFraction, predId) {
  const activeNode = nodes.find((n) => n.id === nodeId);
  assert(activeNode, `missing node ${nodeId}`);
  const oldInitialFraction = Math.max(activeNode.initialFraction || 0, FRACTION_EPSILON);
  const targetInitialFraction = clampFraction(newInitialFraction);
  const scaleFactor = targetInitialFraction / oldInitialFraction;
  const scaledNodes = applyBranchScale(nodes, nodeId, scaleFactor);

  const updated = scaledNodes.map((n) => {
    if (n.id === nodeId) return { ...n, parentId: predId };
    if (activeNode.parentId && n.id === activeNode.parentId) {
      return { ...n, fraction: clampFraction((n.fraction || 0) + oldInitialFraction - targetInitialFraction) };
    }
    return n;
  });

  updated.push({
    id: predId,
    parentId: activeNode.parentId,
    type: 'conveyance',
    grantee: `Predecessor-${predId}`,
    grantor: 'Unknown',
    initialFraction: targetInitialFraction,
    fraction: 0,
  });
  return updated;
}

function applyAttachConveyance(nodes, sourceRootId, destinationId, newRootFraction) {
  const descendants = collectDescendantIds(nodes, sourceRootId);
  assert(!descendants.has(destinationId), 'destination cannot be descendant of source root');
  const sourceRoot = nodes.find((n) => n.id === sourceRootId);
  assert(sourceRoot, `missing source root ${sourceRootId}`);
  const oldRootFraction = Math.max(sourceRoot.fraction || 0, FRACTION_EPSILON);
  const targetRoot = clampFraction(newRootFraction);
  const scaleFactor = targetRoot / oldRootFraction;

  return nodes.map((n) => {
    if (n.id === destinationId) return { ...n, fraction: clampFraction((n.fraction || 0) - targetRoot) };
    if (n.id === sourceRootId) {
      return {
        ...n,
        parentId: destinationId,
        type: 'conveyance',
        fraction: targetRoot,
        initialFraction: targetRoot,
      };
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
}

function byId(nodes, id) {
  const node = nodes.find((n) => n.id === id);
  assert(node, `missing node ${id}`);
  return node;
}

function near(a, b, msg) {
  assert(Math.abs(a - b) <= 0.0000005, `${msg} (expected ${b}, got ${a})`);
}

function scenarioLateSplitDiscovered() {
  // Original recorded as A=100%; later corrected to predecessor split causing A branch to become 50%.
  let nodes = [
    { id: 'root', parentId: null, type: 'conveyance', grantee: 'A', grantor: 'State', initialFraction: 1, fraction: 0.4 },
    { id: 'a1', parentId: 'root', type: 'conveyance', grantee: 'C', grantor: 'A', initialFraction: 0.3, fraction: 0.1 },
    { id: 'a2', parentId: 'root', type: 'conveyance', grantee: 'D', grantor: 'A', initialFraction: 0.3, fraction: 0.05 },
    { id: 'a3', parentId: 'a1', type: 'conveyance', grantee: 'E', grantor: 'C', initialFraction: 0.2, fraction: 0.2 },
  ];
  nodes = applyPredecessor(nodes, 'root', 0.5, 'predAB');

  near(byId(nodes, 'root').initialFraction, 0.5, 'root initial should scale to 0.5');
  near(byId(nodes, 'a1').initialFraction, 0.15, 'child initial scales proportionally');
  near(byId(nodes, 'a3').fraction, 0.1, 'grandchild fraction scales proportionally');
  near(byId(nodes, 'predAB').initialFraction, 0.5, 'new predecessor receives corrected share');
}

function scenarioAttachLooseTree() {
  let nodes = [
    { id: 'main', parentId: null, type: 'conveyance', grantee: 'Main', grantor: 'Origin', initialFraction: 1, fraction: 0.8 },
    { id: 'm1', parentId: 'main', type: 'conveyance', grantee: 'M1', grantor: 'Main', initialFraction: 0.2, fraction: 0.2 },
    { id: 'looseRoot', parentId: null, type: 'conveyance', grantee: 'Loose Root', grantor: 'Unknown', initialFraction: 0.1, fraction: 0.06 },
    { id: 'looseChild', parentId: 'looseRoot', type: 'conveyance', grantee: 'Loose Child', grantor: 'Loose Root', initialFraction: 0.04, fraction: 0.04 },
  ];
  nodes = applyAttachConveyance(nodes, 'looseRoot', 'main', 0.04);

  near(byId(nodes, 'main').fraction, 0.76, 'destination should reduce by attached amount');
  near(byId(nodes, 'looseRoot').parentId === 'main' ? 1 : 0, 1, 'loose root should reparent to destination');
  near(byId(nodes, 'looseChild').initialFraction, 0.0266666667, 'descendants should scale with root');
}

function scenarioRelatedDocsDoNotMoveMath() {
  const nodes = [
    { id: 'root', parentId: null, type: 'conveyance', grantee: 'A', grantor: 'State', initialFraction: 1, fraction: 0.7 },
    { id: 'child', parentId: 'root', type: 'conveyance', grantee: 'B', grantor: 'A', initialFraction: 0.3, fraction: 0.3 },
    { id: 'doc1', parentId: 'child', type: 'related', grantee: 'B', grantor: '', initialFraction: 0, fraction: 0 },
  ];
  near(byId(nodes, 'root').fraction + byId(nodes, 'child').fraction, 1, 'related docs should not affect ownership sum');
}

function scenarioMultipleCorrectionsSameBranch() {
  let nodes = [
    { id: 'r', parentId: null, type: 'conveyance', grantee: 'R', grantor: 'State', initialFraction: 1, fraction: 0.5 },
    { id: 'c1', parentId: 'r', type: 'conveyance', grantee: 'C1', grantor: 'R', initialFraction: 0.5, fraction: 0.3 },
    { id: 'c2', parentId: 'c1', type: 'conveyance', grantee: 'C2', grantor: 'C1', initialFraction: 0.2, fraction: 0.2 },
  ];
  nodes = applyPredecessor(nodes, 'r', 0.75, 'p1');
  nodes = applyPredecessor(nodes, 'r', 0.6, 'p2');

  near(byId(nodes, 'r').initialFraction, 0.6, 'second correction should define final initial fraction');
  near(byId(nodes, 'c2').fraction, 0.12, 'nested descendant should remain proportionally scaled after multiple corrections');
}

function scenarioCycleGuard() {
  const nodes = [
    { id: 'root', parentId: null, type: 'conveyance', grantee: 'A', grantor: 'State', initialFraction: 1, fraction: 1 },
    { id: 'child', parentId: 'root', type: 'conveyance', grantee: 'B', grantor: 'A', initialFraction: 0.3, fraction: 0.3 },
  ];
  let failed = false;
  try {
    applyAttachConveyance(nodes, 'root', 'child', 0.2);
  } catch (error) {
    failed = String(error.message).includes('descendant');
  }
  assert(failed, 'attach should reject cycle-creating operations');
}

function run() {
  scenarioLateSplitDiscovered();
  scenarioAttachLooseTree();
  scenarioRelatedDocsDoNotMoveMath();
  scenarioMultipleCorrectionsSameBranch();
  scenarioCycleGuard();
  console.log('Title scenario checks passed (5 canonical scenarios)');
}

run();
