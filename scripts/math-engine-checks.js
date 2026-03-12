function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const mathEngine = require('../src/mathEngine.js');

function near(actual, expected, message, epsilon = 0.00000001) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function byId(nodes, id) {
  return nodes.find((n) => n.id === id);
}

function runConveyScenario() {
  const nodes = [{ id: 'root', parentId: null, type: 'conveyance', fraction: 1, initialFraction: 1 }];
  const execute = mathEngine.executeConveyance({
    allNodes: nodes,
    parentId: 'root',
    newNodeId: 'child',
    share: 0.3,
    form: { type: 'conveyance', instrument: 'Warranty Deed' },
  });

  assert(execute.ok, 'convey execution should succeed');
  const result = execute.data;
  near(byId(result, 'root').fraction, 0.7, 'convey should reduce parent remaining');
  near(byId(result, 'child').fraction, 0.3, 'convey should create child remaining');
  assert(byId(result, 'child').parentId === 'root', 'convey should set child parent');
}

function runRebalanceScenario() {
  const nodes = [
    { id: 'root', parentId: null, type: 'conveyance', fraction: 0.6, initialFraction: 1 },
    { id: 'child', parentId: 'root', type: 'conveyance', fraction: 0.3, initialFraction: 0.3 },
    { id: 'grand', parentId: 'child', type: 'conveyance', fraction: 0.1, initialFraction: 0.1 },
  ];

  const execute = mathEngine.executeRebalance({
    allNodes: nodes,
    nodeId: 'child',
    parentId: 'root',
    newInitialFraction: 0.15,
    formFields: null,
  });

  assert(execute.ok, 'rebalance execution should succeed');
  const result = execute.audit;
  const updatedNodes = execute.data;
  near(result.newInitialFraction, 0.15, 'rebalance should normalize new initial');
  near(byId(updatedNodes, 'child').fraction, 0.15, 'rebalance should scale node fraction');
  near(byId(updatedNodes, 'grand').fraction, 0.05, 'rebalance should scale descendant fraction');
  near(byId(updatedNodes, 'root').fraction, 0.75, 'rebalance should return interest to parent');
}

function runPredecessorScenario() {
  const nodes = [
    { id: 'root', parentId: null, type: 'conveyance', fraction: 0.7, initialFraction: 1 },
    { id: 'child', parentId: 'root', type: 'conveyance', fraction: 0.3, initialFraction: 0.3 },
    { id: 'grand', parentId: 'child', type: 'conveyance', fraction: 0.1, initialFraction: 0.1 },
  ];

  const execute = mathEngine.executePredecessorInsert({
    allNodes: nodes,
    activeNodeId: 'child',
    activeNodeParentId: 'root',
    newPredecessorId: 'pred-1',
    form: { instrument: 'Prior Deed', grantor: 'A', grantee: 'B' },
    newInitialFraction: 0.2,
  });

  assert(execute.ok, 'precede execution should succeed');
  const result = execute.data;
  const pred = byId(result, 'pred-1');
  assert(pred && pred.parentId === 'root', 'precede should insert predecessor at old parent');
  near(pred.initialFraction, 0.2, 'precede should set predecessor initial fraction');
  assert(byId(result, 'child').parentId === 'pred-1', 'precede should reparent active node');
  near(byId(result, 'root').fraction, 0.8, 'precede should restore parent remainder delta');
}

function runValidationScenario() {
  const valid = mathEngine.validateOwnershipGraph([
    { id: 'a', parentId: null, type: 'conveyance', fraction: 1, initialFraction: 1 },
    { id: 'b', parentId: 'a', type: 'conveyance', fraction: 0.3, initialFraction: 0.3 },
  ]);
  assert(valid.valid, 'valid graph should pass validation');

  const invalid = mathEngine.validateOwnershipGraph([
    { id: 'a', parentId: 'b', type: 'conveyance', fraction: 1, initialFraction: 1 },
    { id: 'b', parentId: 'a', type: 'conveyance', fraction: 0.3, initialFraction: 0.3 },
  ]);
  assert(!invalid.valid, 'cycle graph should fail validation');
  assert(invalid.issues.some((issue) => issue.code === 'cycle_detected'), 'cycle validation should report cycle_detected');
}


function runTractMetricScenario() {
  const tracts = [
    { id: 't1', code: 'TRACT-1', name: 'Alpha', acres: 100 },
    { id: 't2', code: 'TRACT-2', name: 'Beta', acres: 80 },
  ];
  const ownershipInterests = [
    { id: 'i1', tractId: 't1', contactId: 'c1', interestType: 'MI', interestValue: 0.25, leaseBurdenDecimal: 0.2 },
    { id: 'i2', tractId: 't1', contactId: 'c2', interestType: 'RI', interestValue: 0.125, royaltyDecimal: 0.25 },
    { id: 'i3', tractId: 't2', contactId: 'c1', interestType: 'ORRI', interestValue: 0.05, royaltyDecimal: 1 },
  ];

  const metrics = mathEngine.computeTractMetrics({ tracts, ownershipInterests });
  assert(metrics.length === 2, 'tract metrics should return two tract summaries');
  const tract1 = metrics.find((m) => m.tractId === 't1');
  near(tract1.totalNetMineralAcres, 25, 'tract1 net mineral acres should be acres * MI');
  near(tract1.totalDecimalInterest, 0.23125, 'tract1 decimal interest should include burden-adjusted MI + royalty-adjusted RI');

  const portfolio = mathEngine.aggregatePortfolioMetrics({ tracts, ownershipInterests });
  near(portfolio.totalTracts, 2, 'portfolio should include two tracts');
  near(portfolio.totalNetMineralAcres, 25, 'portfolio should roll up net mineral acres');
}


function runOperationFailureScenario() {
  const failed = mathEngine.executeConveyance({ allNodes: null, parentId: 'root', newNodeId: 'x', share: 0.1, form: {} });
  assert(!failed.ok, 'invalid input should fail with envelope');
}

function run() {
  runConveyScenario();
  runRebalanceScenario();
  runPredecessorScenario();
  runValidationScenario();
  runTractMetricScenario();
  runOperationFailureScenario();
  console.log('Math engine checks passed');
}

run();
