function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const mathEngine = require('../src/mathEngine.js');

function near(actual, expected, message, epsilon = mathEngine.FRACTION_EPSILON) {
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
    { id: 'child', parentId: 'root', type: 'conveyance', fraction: 0.2, initialFraction: 0.3 },
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
  near(byId(updatedNodes, 'child').fraction, 0.1, 'rebalance should scale node fraction');
  near(byId(updatedNodes, 'grand').fraction, 0.05, 'rebalance should scale descendant fraction');
  near(byId(updatedNodes, 'root').fraction, 0.75, 'rebalance should return interest to parent');
}

function runPredecessorScenario() {
  const nodes = [
    { id: 'root', parentId: null, type: 'conveyance', fraction: 0.7, initialFraction: 1 },
    { id: 'child', parentId: 'root', type: 'conveyance', fraction: 0.2, initialFraction: 0.3 },
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
    { id: 'a', parentId: null, type: 'conveyance', fraction: 0.7, initialFraction: 1 },
    { id: 'b', parentId: 'a', type: 'conveyance', fraction: 0.3, initialFraction: 0.3 },
  ]);
  assert(valid.valid, 'valid graph should pass validation');

  const invalid = mathEngine.validateOwnershipGraph([
    { id: 'a', parentId: 'b', type: 'conveyance', fraction: 1, initialFraction: 1 },
    { id: 'b', parentId: 'a', type: 'conveyance', fraction: 0.3, initialFraction: 0.3 },
  ]);
  assert(!invalid.valid, 'cycle graph should fail validation');
  assert(invalid.issues.some((issue) => issue.code === 'cycle_detected'), 'cycle validation should report cycle_detected');

  const overAllocated = mathEngine.validateOwnershipGraph([
    { id: 'root', parentId: null, type: 'conveyance', fraction: 0.7, initialFraction: 0.5 },
    { id: 'child', parentId: 'root', type: 'conveyance', fraction: 0.3, initialFraction: 0.3 },
  ]);
  assert(!overAllocated.valid, 'over-allocated branch should fail validation');
  assert(overAllocated.issues.some((issue) => issue.code === 'over_allocated_branch'), 'over-allocation should report over_allocated_branch');
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

  const nodes = [{ id: 'root', parentId: null, type: 'conveyance', fraction: 0.2, initialFraction: 1 }];
  const exceedsParent = mathEngine.executeConveyance({ allNodes: nodes, parentId: 'root', newNodeId: 'x', share: 0.5, form: {} });
  assert(!exceedsParent.ok, 'conveyance over parent remaining should fail');
  assert(exceedsParent.error?.code === 'invalid_input', 'conveyance over parent should return invalid_input envelope');

  const wrongParent = mathEngine.executeRebalance({
    allNodes: [
      { id: 'root', parentId: null, type: 'conveyance', fraction: 0.7, initialFraction: 1 },
      { id: 'child', parentId: 'root', type: 'conveyance', fraction: 0.3, initialFraction: 0.3 },
    ],
    nodeId: 'child',
    parentId: 'different-parent',
    newInitialFraction: 0.2,
  });
  assert(wrongParent.ok, 'rebalance should resolve parent from node shape for compatibility');
}

function runMineralInterestChainScenario() {
  const tracts = [
    { id: 't1', code: 'TRACT-CHAIN', name: 'Gamma', acres: 160 },
  ];
  const ownershipInterests = [
    { id: 'mi1', tractId: 't1', contactId: 'c-mi', interestType: 'MI', interestValue: 0.5, leaseBurdenDecimal: 0.25 },
    { id: 'ri1', tractId: 't1', contactId: 'c-ri', interestType: 'RI', interestValue: 0.2, royaltyDecimal: 0.25 },
    { id: 'orri1', tractId: 't1', contactId: 'c-orri', interestType: 'ORRI', interestValue: 0.04, royaltyDecimal: 0.5 },
    { id: 'nma-bad', tractId: 't1', contactId: 'c-bad', interestType: 'MI', interestValue: 2.4, leaseBurdenDecimal: -1 },
    { id: 'decimal-bad', tractId: 't1', contactId: 'c-dec', interestType: 'RI', interestValue: 0.1, royaltyDecimal: 5 },
  ];

  const [summary] = mathEngine.computeTractMetrics({ tracts, ownershipInterests });
  near(summary.totalMI, 1.5, 'MI totals should include clamped in-range + out-of-range MI values');
  near(summary.totalNetMineralAcres, 240, 'NMA should follow clamped MI values by tract acres');
  near(summary.totalDecimalInterest, 1.545, 'decimal total should apply burden and royalty rules to MI/RI/ORRI records');

  const nmaRecord = summary.lineItems.find((item) => item.id === 'nma-bad');
  near(nmaRecord.inputDecimal, 1, 'out-of-range MI decimal should clamp to 1');
  near(nmaRecord.leaseBurdenDecimal, 0, 'negative lease burden should clamp to 0');
  near(nmaRecord.netMineralAcres, 160, 'clamped MI should produce deterministic NMA');

  const badRiRecord = summary.lineItems.find((item) => item.id === 'decimal-bad');
  near(badRiRecord.royaltyDecimal, 1, 'royalty decimal should clamp to 1');
  near(badRiRecord.decimalInterest, 0.1, 'clamped royalty decimal should keep RI decimal deterministic');
}


function runRootOwnershipTotalScenario() {
  const nodes = [
    { id: 'r1', parentId: null, type: 'conveyance', initialFraction: 0.5, fraction: 0.25 },
    { id: 'r2', parentId: null, type: 'conveyance', initialFraction: 0.5, fraction: 0.5 },
    { id: 'c1', parentId: 'r1', type: 'conveyance', initialFraction: 0.25, fraction: 0.25 },
    { id: 'u1', parentId: 'unlinked', type: 'conveyance', initialFraction: 0.2, fraction: 0.2 },
  ];
  near(mathEngine.rootOwnershipTotal(nodes), 1, 'master total should sum distributed conveyance fractions, excluding unlinked');
}

function run() {
  runConveyScenario();
  runRebalanceScenario();
  runPredecessorScenario();
  runValidationScenario();
  runTractMetricScenario();
  runOperationFailureScenario();
  runMineralInterestChainScenario();
  runRootOwnershipTotalScenario();
  console.log('Math engine checks passed');
}

run();
