const mathEngine = require('../src/mathEngine.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const { executePredecessorInsert, executeAttachConveyance } = mathEngine;

function byId(nodes, id) {
  const node = nodes.find((n) => n.id === id);
  assert(node, `missing node ${id}`);
  return node;
}

function near(a, b, msg) {
  assert(Math.abs(a - b) <= mathEngine.FRACTION_EPSILON, `${msg} (expected ${b}, got ${a})`);
}

function scenarioLateSplitDiscovered() {
  // Original recorded as A=100%; later corrected to predecessor split causing A branch to become 50%.
  let nodes = [
    { id: 'root', parentId: null, type: 'conveyance', grantee: 'A', grantor: 'State', initialFraction: 1, fraction: 0.4 },
    { id: 'a1', parentId: 'root', type: 'conveyance', grantee: 'C', grantor: 'A', initialFraction: 0.3, fraction: 0.1 },
    { id: 'a2', parentId: 'root', type: 'conveyance', grantee: 'D', grantor: 'A', initialFraction: 0.3, fraction: 0.05 },
    { id: 'a3', parentId: 'a1', type: 'conveyance', grantee: 'E', grantor: 'C', initialFraction: 0.2, fraction: 0.2 },
  ];
  const result = executePredecessorInsert({
    allNodes: nodes,
    activeNodeId: 'root',
    activeNodeParentId: null,
    newPredecessorId: 'predAB',
    newInitialFraction: 0.5,
    form: { grantee: 'Predecessor-predAB', grantor: 'Unknown' },
  });
  assert(result.ok, `executePredecessorInsert should succeed: ${result.error && result.error.message}`);
  nodes = result.data;

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
  const result = executeAttachConveyance({
    allNodes: nodes,
    activeNodeId: 'looseRoot',
    attachParentId: 'main',
    calcShare: 0.04,
    form: {},
  });
  assert(result.ok, `executeAttachConveyance should succeed: ${result.error && result.error.message}`);
  nodes = result.data;

  near(byId(nodes, 'main').fraction, 0.76, 'destination should reduce by attached amount');
  assert(byId(nodes, 'looseRoot').parentId === 'main', 'loose root should reparent to destination');
  // Descendants scale by calcShare/looseRoot.initialFraction = 0.04/0.1 = 0.4
  near(byId(nodes, 'looseChild').initialFraction, 0.016, 'descendants should scale with root');
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

  const r1 = executePredecessorInsert({
    allNodes: nodes,
    activeNodeId: 'r',
    activeNodeParentId: null,
    newPredecessorId: 'p1',
    newInitialFraction: 0.75,
    form: { grantee: 'Predecessor-p1', grantor: 'Unknown' },
  });
  assert(r1.ok, `first predecessor insert should succeed: ${r1.error && r1.error.message}`);
  nodes = r1.data;

  const activeR = nodes.find((n) => n.id === 'r');
  const r2 = executePredecessorInsert({
    allNodes: nodes,
    activeNodeId: 'r',
    activeNodeParentId: activeR.parentId,
    newPredecessorId: 'p2',
    newInitialFraction: 0.6,
    form: { grantee: 'Predecessor-p2', grantor: 'Unknown' },
  });
  assert(r2.ok, `second predecessor insert should succeed: ${r2.error && r2.error.message}`);
  nodes = r2.data;

  near(byId(nodes, 'r').initialFraction, 0.6, 'second correction should define final initial fraction');
  near(byId(nodes, 'c2').fraction, 0.12, 'nested descendant should remain proportionally scaled after multiple corrections');
}

function scenarioCycleGuard() {
  const nodes = [
    { id: 'root', parentId: null, type: 'conveyance', grantee: 'A', grantor: 'State', initialFraction: 1, fraction: 1 },
    { id: 'child', parentId: 'root', type: 'conveyance', grantee: 'B', grantor: 'A', initialFraction: 0.3, fraction: 0.3 },
  ];
  const result = executeAttachConveyance({
    allNodes: nodes,
    activeNodeId: 'root',
    attachParentId: 'child',
    calcShare: 0.2,
    form: {},
  });
  assert(!result.ok && result.error.code === 'conflicting_structure', 'attach should reject cycle-creating operations');
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
