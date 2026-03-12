(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LANDroidMathEngine = factory();
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const FRACTION_EPSILON = 0.000000001;
  const OWNERSHIP_TOTAL_TOLERANCE = 0.05;

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

  function calculateShare({ form, parent }) {
    if (!parent) return 0;
    const numerator = parseFloat(form?.numerator || 0);
    const denominator = parseFloat(form?.denominator || 1);
    const ratio = denominator > 0 ? numerator / denominator : 0;

    if (form?.conveyanceMode === 'all') return clampFraction(parent.fraction);
    if (form?.conveyanceMode === 'fixed') return clampFraction(parseFloat(form?.manualAmount || 0));
    if (form?.conveyanceMode === 'fraction') {
      let base = parent.initialFraction ?? parent.fraction;
      if (form?.splitBasis === 'remaining') base = parent.fraction;
      return clampFraction(base * ratio);
    }
    return 0;
  }

  function applyConveyanceUpdate({ allNodes, parentId, newNodeId, share, form }) {
    const normalizedShare = clampFraction(share);
    const updatedParents = allNodes.map((n) => {
      if (n.id !== parentId) return n;
      return { ...n, fraction: clampFraction((n.fraction || 0) - normalizedShare) };
    });

    return [
      ...updatedParents,
      {
        ...form,
        id: newNodeId,
        type: 'conveyance',
        fraction: normalizedShare,
        initialFraction: normalizedShare,
        parentId,
      },
    ];
  }

  function applyRebalanceUpdate({ allNodes, nodeId, newInitialFraction, parentId, formFields }) {
    const node = allNodes.find((item) => item.id === nodeId);
    if (!node) return null;

    const oldInitialFraction = Math.max(node.initialFraction || 0, FRACTION_EPSILON);
    const normalizedNewInitialFraction = clampFraction(newInitialFraction);
    const scaleFactor = normalizedNewInitialFraction / oldInitialFraction;
    const scaledNodes = applyBranchScale(allNodes, nodeId, scaleFactor);
    const affectedCount = collectDescendantIds(allNodes, nodeId).size + 1;

    const updatedNodes = scaledNodes.map((n) => {
      if (n.id === nodeId) {
        if (formFields) {
          return { ...n, ...formFields, initialFraction: normalizedNewInitialFraction };
        }
        return { ...n, initialFraction: normalizedNewInitialFraction };
      }
      if (parentId && n.id === parentId) {
        return { ...n, fraction: clampFraction((n.fraction || 0) + oldInitialFraction - normalizedNewInitialFraction) };
      }
      return n;
    });

    return {
      updatedNodes,
      oldInitialFraction,
      newInitialFraction: normalizedNewInitialFraction,
      scaleFactor,
      affectedCount,
    };
  }

  function applyPredecessorInsertUpdate({ allNodes, activeNodeId, activeNodeParentId, newPredecessorId, form, newInitialFraction }) {
    const activeNode = allNodes.find((item) => item.id === activeNodeId);
    if (!activeNode) return null;

    const oldInitialFraction = Math.max(activeNode.initialFraction || 0, FRACTION_EPSILON);
    const normalizedNewInitialFraction = clampFraction(newInitialFraction);
    const scaleFactor = normalizedNewInitialFraction / oldInitialFraction;
    const scaledNodes = applyBranchScale(allNodes, activeNodeId, scaleFactor);
    const affectedCount = collectDescendantIds(allNodes, activeNodeId).size + 1;

    const updatedNodes = scaledNodes.map((n) => {
      if (n.id === activeNodeId) return { ...n, parentId: newPredecessorId };
      if (activeNodeParentId && n.id === activeNodeParentId) {
        return { ...n, fraction: clampFraction((n.fraction || 0) + oldInitialFraction - normalizedNewInitialFraction) };
      }
      return n;
    });

    return {
      updatedNodes: [
        ...updatedNodes,
        {
          ...form,
          id: newPredecessorId,
          type: 'conveyance',
          parentId: activeNodeParentId,
          initialFraction: normalizedNewInitialFraction,
          fraction: 0,
        },
      ],
      oldInitialFraction,
      newInitialFraction: normalizedNewInitialFraction,
      scaleFactor,
      affectedCount,
    };
  }

  function applyAttachConveyanceUpdate({ allNodes, activeNodeId, attachParentId, calcShare, form }) {
    const descendants = collectDescendantIds(allNodes, activeNodeId);
    if (attachParentId === activeNodeId || descendants.has(attachParentId)) return allNodes;

    const sourceRoot = allNodes.find((n) => n.id === activeNodeId);
    if (!sourceRoot) return allNodes;

    const oldRootFraction = Math.max(sourceRoot.fraction || 0, FRACTION_EPSILON);
    const newRootFraction = clampFraction(calcShare);
    const scaleFactor = newRootFraction / oldRootFraction;

    return allNodes.map((n) => {
      if (n.id === attachParentId) {
        return { ...n, fraction: clampFraction((n.fraction || 0) - newRootFraction) };
      }
      if (n.id === activeNodeId) {
        return {
          ...n,
          ...form,
          parentId: attachParentId,
          type: 'conveyance',
          fraction: newRootFraction,
          initialFraction: newRootFraction,
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

  function validateOwnershipGraph(nodes) {
    const issues = [];
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    const byId = new Map();

    safeNodes.forEach((node) => {
      if (!node || !node.id) {
        issues.push({ code: 'invalid_node', message: 'Node missing id' });
        return;
      }
      if (byId.has(node.id)) {
        issues.push({ code: 'duplicate_id', nodeId: node.id, message: `Duplicate node id ${node.id}` });
      }
      byId.set(node.id, node);

      const fraction = Number(node.fraction || 0);
      const initialFraction = Number(node.initialFraction || 0);
      if (!Number.isFinite(fraction)) issues.push({ code: 'non_finite_fraction', nodeId: node.id, message: `Non-finite fraction at ${node.id}` });
      if (!Number.isFinite(initialFraction)) issues.push({ code: 'non_finite_initial_fraction', nodeId: node.id, message: `Non-finite initialFraction at ${node.id}` });
      if (fraction < -FRACTION_EPSILON) issues.push({ code: 'negative_fraction', nodeId: node.id, message: `Negative fraction at ${node.id}` });
      if (initialFraction < -FRACTION_EPSILON) issues.push({ code: 'negative_initial_fraction', nodeId: node.id, message: `Negative initialFraction at ${node.id}` });
    });

    safeNodes.forEach((node) => {
      if (!node || !node.id) return;
      if (node.parentId === null || node.parentId === 'unlinked') return;
      if (!byId.has(node.parentId)) {
        issues.push({ code: 'missing_parent', nodeId: node.id, parentId: node.parentId, message: `Missing parent ${node.parentId} for ${node.id}` });
      }
      if (node.parentId === node.id) {
        issues.push({ code: 'self_parent', nodeId: node.id, message: `Self-parent cycle at ${node.id}` });
      }
    });

    safeNodes.forEach((node) => {
      if (!node || !node.id) return;
      const visited = new Set([node.id]);
      let cursor = node;
      while (cursor && cursor.parentId !== null && cursor.parentId !== 'unlinked') {
        const next = byId.get(cursor.parentId);
        if (!next) break;
        if (visited.has(next.id)) {
          issues.push({ code: 'cycle_detected', nodeId: node.id, cycleNodeId: next.id, message: `Cycle detected involving ${next.id}` });
          break;
        }
        visited.add(next.id);
        cursor = next;
      }
    });

    safeNodes.forEach((node) => {
      if (!node || !node.id || node.type === 'related') return;
      const initial = clampFraction(node.initialFraction ?? node.fraction);
      const remaining = clampFraction(node.fraction);
      const childInitialTotal = safeNodes.reduce((sum, child) => {
        if (!child || child.type === 'related' || child.parentId !== node.id) return sum;
        return sum + clampFraction(child.initialFraction ?? child.fraction);
      }, 0);
      const allocated = remaining + childInitialTotal;
      if (allocated - initial > FRACTION_EPSILON) {
        issues.push({
          code: 'over_allocated_branch',
          nodeId: node.id,
          message: `Allocated branch interest exceeds initial grant at ${node.id}`,
          details: { initial, remaining, childInitialTotal, allocated },
        });
      }
    });

    return {
      valid: issues.length === 0,
      issues,
    };
  }


  function clampUnitInterval(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return 0;
    if (numeric < 0 && numeric > -FRACTION_EPSILON) return 0;
    return Math.min(1, Math.max(0, numeric));
  }

  function normalizeInterestRecords(records = []) {
    return (records || []).map((record) => {
      const type = String(record?.interestType || 'MI').toUpperCase();
      return {
        ...record,
        interestType: type,
        interestValue: clampUnitInterval(record?.interestValue),
        leaseBurdenDecimal: clampUnitInterval(record?.leaseBurdenDecimal),
        royaltyDecimal: clampUnitInterval(record?.royaltyDecimal),
      };
    });
  }

  function computeTractMetrics({ tracts = [], ownershipInterests = [] }) {
    const tractById = Object.fromEntries((tracts || []).map((tract) => [tract.id, tract]));
    const normalizedInterests = normalizeInterestRecords(ownershipInterests);

    const byTract = {};
    normalizedInterests.forEach((interest) => {
      const tract = tractById[interest.tractId];
      if (!tract) return;
      const acres = Math.max(0, Number(tract.acres || 0));
      if (!byTract[tract.id]) {
        byTract[tract.id] = {
          tractId: tract.id,
          tractCode: tract.code || '',
          tractName: tract.name || '',
          acres,
          totalMI: 0,
          totalRI: 0,
          totalNRI: 0,
          totalORRI: 0,
          totalNetMineralAcres: 0,
          totalDecimalInterest: 0,
          lineItems: [],
        };
      }

      const value = clampUnitInterval(interest.interestValue);
      const leaseBurden = clampUnitInterval(interest.leaseBurdenDecimal);
      const royaltyDecimal = clampUnitInterval(interest.royaltyDecimal);
      const netMineralAcres = interest.interestType === 'MI' ? value * acres : 0;

      let decimalInterest = value;
      if (interest.interestType === 'MI' && leaseBurden > 0) {
        decimalInterest = value * (1 - leaseBurden);
      } else if ((interest.interestType === 'RI' || interest.interestType === 'ORRI') && royaltyDecimal > 0) {
        decimalInterest = value * royaltyDecimal;
      }

      const tractRow = byTract[tract.id];
      if (interest.interestType === 'MI') tractRow.totalMI += value;
      if (interest.interestType === 'RI') tractRow.totalRI += value;
      if (interest.interestType === 'NRI') tractRow.totalNRI += value;
      if (interest.interestType === 'ORRI') tractRow.totalORRI += value;

      tractRow.totalNetMineralAcres += netMineralAcres;
      tractRow.totalDecimalInterest += decimalInterest;
      tractRow.lineItems.push({
        id: interest.id,
        contactId: interest.contactId,
        interestType: interest.interestType,
        inputDecimal: value,
        leaseBurdenDecimal: leaseBurden,
        royaltyDecimal,
        netMineralAcres,
        decimalInterest,
      });
    });

    return Object.values(byTract).map((row) => ({
      ...row,
      totalMI: clampFraction(row.totalMI),
      totalRI: clampFraction(row.totalRI),
      totalNRI: clampFraction(row.totalNRI),
      totalORRI: clampFraction(row.totalORRI),
      totalNetMineralAcres: Math.max(0, row.totalNetMineralAcres),
      totalDecimalInterest: clampFraction(row.totalDecimalInterest),
    }));
  }

  function aggregatePortfolioMetrics({ tracts = [], ownershipInterests = [] }) {
    const tractSummaries = computeTractMetrics({ tracts, ownershipInterests });
    return tractSummaries.reduce((acc, tractSummary) => {
      acc.totalTracts += 1;
      acc.totalAcres += Number(tractSummary.acres || 0);
      acc.totalMI += Number(tractSummary.totalMI || 0);
      acc.totalRI += Number(tractSummary.totalRI || 0);
      acc.totalNRI += Number(tractSummary.totalNRI || 0);
      acc.totalORRI += Number(tractSummary.totalORRI || 0);
      acc.totalNetMineralAcres += Number(tractSummary.totalNetMineralAcres || 0);
      acc.totalDecimalInterest += Number(tractSummary.totalDecimalInterest || 0);
      return acc;
    }, {
      totalTracts: 0,
      totalAcres: 0,
      totalMI: 0,
      totalRI: 0,
      totalNRI: 0,
      totalORRI: 0,
      totalNetMineralAcres: 0,
      totalDecimalInterest: 0,
    });
  }


  function resultOk(data, audit) {
    return { ok: true, data, audit: audit || null };
  }

  function resultErr(code, message, details) {
    return { ok: false, error: { code, message, details: details || null } };
  }

  function ensureArrayNodes(allNodes) {
    if (!Array.isArray(allNodes)) return resultErr('invalid_input', 'allNodes must be an array');
    return null;
  }

  function findNodeById(allNodes, nodeId) {
    if (!nodeId) return null;
    return allNodes.find((node) => node.id === nodeId) || null;
  }

  function executeConveyance(params) {
    const { allNodes, parentId, newNodeId, share } = params || {};
    const nodesErr = ensureArrayNodes(allNodes);
    if (nodesErr) return nodesErr;
    if (!parentId || !newNodeId) return resultErr('invalid_input', 'parentId and newNodeId are required');
    if (findNodeById(allNodes, newNodeId)) return resultErr('conflicting_structure', `newNodeId ${newNodeId} already exists`);
    const parentNode = findNodeById(allNodes, parentId);
    if (!parentNode) return resultErr('missing_node', `parentId ${parentId} was not found`);
    const normalizedShare = clampFraction(share);
    if (!Number.isFinite(Number(share || 0))) return resultErr('invalid_input', 'share must be a finite number');
    if (normalizedShare - clampFraction(parentNode.fraction) > FRACTION_EPSILON) {
      return resultErr('invalid_input', 'share exceeds parent remaining fraction', {
        parentId,
        parentFraction: clampFraction(parentNode.fraction),
        requestedShare: normalizedShare,
      });
    }
    const updatedNodes = applyConveyanceUpdate(params);
    const validation = validateOwnershipGraph(updatedNodes);
    if (!validation.valid) return resultErr('invalid_graph', 'Conveyance would produce invalid ownership graph', validation.issues);
    return resultOk(updatedNodes, { action: 'convey', affectedCount: 2 });
  }

  function executeRebalance(params) {
    const { allNodes, nodeId, parentId } = params || {};
    const nodesErr = ensureArrayNodes(allNodes);
    if (nodesErr) return nodesErr;
    if (!nodeId) return resultErr('invalid_input', 'nodeId is required');
    const node = findNodeById(allNodes, nodeId);
    if (!node) return resultErr('missing_node', 'Unable to rebalance missing node');
    const effectiveParentId = node.parentId;
    const resolvedParentId = effectiveParentId ?? parentId ?? null;
    const result = applyRebalanceUpdate({ ...(params || {}), parentId: resolvedParentId });
    if (!result) return resultErr('missing_node', 'Unable to rebalance missing node');
    const validation = validateOwnershipGraph(result.updatedNodes);
    if (!validation.valid) return resultErr('invalid_graph', 'Rebalance would produce invalid ownership graph', validation.issues);
    return resultOk(result.updatedNodes, {
      action: 'rebalance',
      oldInitialFraction: result.oldInitialFraction,
      newInitialFraction: result.newInitialFraction,
      scaleFactor: result.scaleFactor,
      affectedCount: result.affectedCount,
    });
  }

  function executePredecessorInsert(params) {
    const { allNodes, activeNodeId, activeNodeParentId, newPredecessorId } = params || {};
    const nodesErr = ensureArrayNodes(allNodes);
    if (nodesErr) return nodesErr;
    if (!activeNodeId || !newPredecessorId) return resultErr('invalid_input', 'activeNodeId and newPredecessorId are required');
    const activeNode = findNodeById(allNodes, activeNodeId);
    if (!activeNode) return resultErr('missing_node', 'Unable to insert predecessor for missing node');
    if (findNodeById(allNodes, newPredecessorId)) return resultErr('conflicting_structure', `newPredecessorId ${newPredecessorId} already exists`);
    if (newPredecessorId === activeNodeId) return resultErr('conflicting_structure', 'newPredecessorId cannot equal activeNodeId');
    const result = applyPredecessorInsertUpdate(params || {});
    if (!result) return resultErr('missing_node', 'Unable to insert predecessor for missing node');
    const validation = validateOwnershipGraph(result.updatedNodes);
    if (!validation.valid) return resultErr('invalid_graph', 'Predecessor insert would produce invalid ownership graph', validation.issues);
    return resultOk(result.updatedNodes, {
      action: 'precede',
      oldInitialFraction: result.oldInitialFraction,
      newInitialFraction: result.newInitialFraction,
      scaleFactor: result.scaleFactor,
      affectedCount: result.affectedCount,
    });
  }

  function executeAttachConveyance(params) {
    const { allNodes, activeNodeId, attachParentId, calcShare } = params || {};
    const nodesErr = ensureArrayNodes(allNodes);
    if (nodesErr) return nodesErr;
    if (!activeNodeId || !attachParentId) return resultErr('invalid_input', 'activeNodeId and attachParentId are required');
    const sourceRoot = findNodeById(allNodes, activeNodeId);
    if (!sourceRoot) return resultErr('missing_node', `activeNodeId ${activeNodeId} was not found`);
    const destination = findNodeById(allNodes, attachParentId);
    if (!destination) return resultErr('missing_node', `attachParentId ${attachParentId} was not found`);
    const descendants = collectDescendantIds(allNodes, activeNodeId);
    if (attachParentId === activeNodeId || descendants.has(attachParentId)) {
      return resultErr('conflicting_structure', 'Cannot attach to self or descendant');
    }
    const normalizedShare = clampFraction(calcShare);
    if (!Number.isFinite(Number(calcShare || 0))) return resultErr('invalid_input', 'calcShare must be a finite number');
    if (normalizedShare - clampFraction(destination.fraction) > FRACTION_EPSILON) {
      return resultErr('invalid_input', 'calcShare exceeds destination remaining fraction', {
        attachParentId,
        destinationFraction: clampFraction(destination.fraction),
        requestedShare: normalizedShare,
      });
    }
    const updatedNodes = applyAttachConveyanceUpdate(params || {});
    const validation = validateOwnershipGraph(updatedNodes);
    if (!validation.valid) return resultErr('invalid_graph', 'Attach would produce invalid ownership graph', validation.issues);
    return resultOk(updatedNodes, {
      action: 'attach_conveyance',
      oldRootFraction: clampFraction(sourceRoot.fraction),
      newRootFraction: normalizedShare,
      scaleFactor: clampFraction(sourceRoot.fraction) > FRACTION_EPSILON ? normalizedShare / clampFraction(sourceRoot.fraction) : 0,
      affectedCount: descendants.size + 1,
    });
  }

  function rootOwnershipTotal(nodes) {
    return (nodes || []).reduce((sum, node) => {
      if (node.type === 'related' || node.parentId === 'unlinked') return sum;
      return sum + clampFraction(node.fraction);
    }, 0);
  }

  function formatAsFraction(value, maxDenominator = 1000000) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= FRACTION_EPSILON) return '0/1';
    const clamped = Math.max(0, numeric);
    const whole = Math.floor(clamped);
    const fractional = clamped - whole;

    if (fractional <= FRACTION_EPSILON) return `${whole}/1`;

    let denominator = Math.min(maxDenominator, 1000000);
    let numerator = Math.round(fractional * denominator);

    function gcd(a, b) {
      let x = Math.abs(a);
      let y = Math.abs(b);
      while (y) {
        const t = y;
        y = x % y;
        x = t;
      }
      return x || 1;
    }

    const factor = gcd(numerator, denominator);
    numerator /= factor;
    denominator /= factor;

    numerator += whole * denominator;
    return `${numerator}/${denominator}`;
  }

  return {
    FRACTION_EPSILON,
    OWNERSHIP_TOTAL_TOLERANCE,
    clampFraction,
    collectDescendantIds,
    applyBranchScale,
    calculateShare,
    clampUnitInterval,
    normalizeInterestRecords,
    computeTractMetrics,
    aggregatePortfolioMetrics,
    applyConveyanceUpdate,
    applyRebalanceUpdate,
    applyPredecessorInsertUpdate,
    applyAttachConveyanceUpdate,
    executeConveyance,
    executeRebalance,
    executePredecessorInsert,
    executeAttachConveyance,
    validateOwnershipGraph,
    rootOwnershipTotal,
    formatAsFraction,
  };
});
