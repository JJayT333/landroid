import { d } from '../engine/decimal';
import { formatAsFraction } from '../engine/fraction-display';
import {
  buildLeaseScopeIndex,
  calculateDeskMapCoverageSummary,
  getActiveLeases,
  getLeasesForOwnerNode,
} from '../title-math';
import { isLeaseNode } from '../components/deskmap/deskmap-lease-node';
import {
  buildLeaseholdUnitSummary,
  type LeaseholdUnitSummary,
} from '../title-math';
import { useOwnerStore } from '../store/owner-store';
import { useUIStore, type ViewMode } from '../store/ui-store';
import { useWorkspaceStore } from '../store/workspace-store';
import type {
  LeaseholdAssignment,
  LeaseholdOrri,
  LeaseholdTransferOrderEntry,
} from '../types/leasehold';
import { isNpriNode, type DeskMap, type OwnershipNode } from '../types/node';
import type { Lease, Owner } from '../types/owner';
import {
  findUnitOption,
  makeUnitOptionLabel,
  resolveActiveUnitCode,
} from '../utils/desk-map-units';

const MAX_CONTEXT_NODES = 40;
export type AIAppContextMode = 'minimal' | 'full';

const VIEW_LABELS: Record<ViewMode, string> = {
  chart: 'Desk Map',
  leasehold: 'Leasehold',
  master: 'Runsheet',
  documents: 'Documents',
  flowchart: 'Flowchart',
  owners: 'Owners',
  curative: 'Curative',
  maps: 'Maps',
  federalLeasing: 'Federal Leasing',
  research: 'Research',
  pitch: 'Sales Deck',
};

export function buildAIAppContext(mode: AIAppContextMode = 'full'): string {
  if (mode === 'minimal') {
    return buildMinimalAIAppContext();
  }

  const ui = useUIStore.getState();
  const workspace = useWorkspaceStore.getState();
  const ownerState = useOwnerStore.getState();
  const activeDeskMap =
    workspace.deskMaps.find((deskMap) => deskMap.id === workspace.activeDeskMapId) ??
    workspace.deskMaps[0] ??
    null;
  const activeUnitCode = resolveActiveUnitCode(
    workspace.deskMaps,
    workspace.activeUnitCode,
    activeDeskMap?.id ?? null
  );
  const activeUnit = findUnitOption(workspace.deskMaps, activeUnitCode);
  const activeNodes = activeDeskMap
    ? activeDeskMap.nodeIds
        .map((id) => workspace.nodes.find((node) => node.id === id))
        .filter((node): node is OwnershipNode => Boolean(node))
    : [];
  const unitNodeIds = new Set(
    workspace.deskMaps
      .filter((deskMap) => !activeUnitCode || deskMap.unitCode === activeUnitCode)
      .flatMap((deskMap) => deskMap.nodeIds)
  );
  const unitNodes = workspace.nodes.filter((node) => unitNodeIds.has(node.id));
  const activeLeasesByOwnerId = groupActiveLeasesByOwnerId(ownerState.leases);
  const contextLines = [
    '# Read-only LANDroid app context',
    'This packet is generated from the current LANDroid client state. Use it as read-only context for the user-visible app/workspace; do not claim broader access or mutate state from it.',
    '',
    `Active view: ${VIEW_LABELS[ui.view]}`,
    `Project: ${cleanText(workspace.projectName) || 'Untitled project'}`,
  ];

  appendWholeProjectSummary(contextLines, {
    mode: 'full',
    deskMaps: workspace.deskMaps,
    nodes: workspace.nodes,
    owners: ownerState.owners,
    leases: ownerState.leases,
    leaseholdAssignments: workspace.leaseholdAssignments,
    leaseholdOrris: workspace.leaseholdOrris,
    leaseholdTransferOrderEntries: workspace.leaseholdTransferOrderEntries,
    activeLeasesByOwnerId,
  });

  if (activeUnit) {
    contextLines.push(
      `Active unit: ${makeUnitOptionLabel(activeUnit)} (${activeUnit.tractCount} tract${activeUnit.tractCount === 1 ? '' : 's'})`
    );
  } else if (activeUnitCode) {
    contextLines.push(`Active unit: ${cleanText(activeUnitCode)}`);
  } else {
    contextLines.push('Active unit: none selected');
  }

  if (!activeDeskMap) {
    contextLines.push('', 'Desk Map: no tract map is loaded.');
    return contextLines.join('\n');
  }

  contextLines.push(
    `Active tract: ${cleanText(activeDeskMap.code)} - ${cleanText(activeDeskMap.name)}`,
    `Visible Desk Map cards: ${activeNodes.length}`
  );

  appendDeskMapCoverage(contextLines, activeNodes, unitNodes, activeLeasesByOwnerId);
  appendVisibleDeskMapCards(contextLines, activeNodes, activeLeasesByOwnerId, unitNodes);

  return contextLines.join('\n');
}

function buildMinimalAIAppContext(): string {
  const ui = useUIStore.getState();
  const workspace = useWorkspaceStore.getState();
  const ownerState = useOwnerStore.getState();
  const activeDeskMap =
    workspace.deskMaps.find((deskMap) => deskMap.id === workspace.activeDeskMapId) ??
    workspace.deskMaps[0] ??
    null;
  const activeUnitCode = resolveActiveUnitCode(
    workspace.deskMaps,
    workspace.activeUnitCode,
    activeDeskMap?.id ?? null
  );
  const activeNodes = activeDeskMap
    ? activeDeskMap.nodeIds
        .map((id) => workspace.nodes.find((node) => node.id === id))
        .filter((node): node is OwnershipNode => Boolean(node))
    : [];
  const unitNodeIds = new Set(
    workspace.deskMaps
      .filter((deskMap) => !activeUnitCode || deskMap.unitCode === activeUnitCode)
      .flatMap((deskMap) => deskMap.nodeIds)
  );
  const unitNodes = workspace.nodes.filter((node) => unitNodeIds.has(node.id));

  const conveyanceCount = activeNodes.filter(
    (node) => node.type !== 'related' && !isNpriNode(node)
  ).length;
  const npriCount = activeNodes.filter((node) => isNpriNode(node)).length;
  const relatedLeaseCount = activeNodes.filter((node) => isLeaseNode(node)).length;
  const relatedDocumentCount = activeNodes.filter(
    (node) => node.type === 'related' && node.relatedKind === 'document'
  ).length;
  const activeLeasesByOwnerId = groupActiveLeasesByOwnerId(ownerState.leases);
  const coverage = activeDeskMap
    ? calculateDeskMapCoverageSummary(
        activeNodes,
        activeLeasesByOwnerId,
        unitNodes.length > 0 ? unitNodes : activeNodes
      )
    : null;

  const contextLines = [
    '# Read-only LANDroid app context (minimal)',
    'Hosted minimal context includes counts and structure only. It intentionally omits project names, party names, fractions, lease economics, remarks, document references, and identifiers.',
    '',
    `Active view: ${VIEW_LABELS[ui.view]}`,
    `Workspace counts: ${workspace.deskMaps.length} tract map${workspace.deskMaps.length === 1 ? '' : 's'}, ${workspace.nodes.length} title card${workspace.nodes.length === 1 ? '' : 's'}, ${ownerState.owners.length} owner record${ownerState.owners.length === 1 ? '' : 's'}, ${ownerState.leases.length} lease record${ownerState.leases.length === 1 ? '' : 's'}.`,
    `Active focus loaded: ${activeDeskMap ? 'yes' : 'no'}`,
    `Active unit selected: ${activeUnitCode ? 'yes' : 'no'}`,
    `Visible card counts: ${activeNodes.length} total, ${conveyanceCount} conveyance, ${npriCount} NPRI, ${relatedLeaseCount} related lease, ${relatedDocumentCount} related document.`,
    coverage
      ? `Coverage structure: ${coverage.currentOwnerCount} current owner card${coverage.currentOwnerCount === 1 ? '' : 's'}, ${coverage.linkedOwnerCount} linked owner card${coverage.linkedOwnerCount === 1 ? '' : 's'}, ${coverage.leasedOwnerCount} leased owner card${coverage.leasedOwnerCount === 1 ? '' : 's'}, ${coverage.leaseOverlaps.length} lease coverage warning${coverage.leaseOverlaps.length === 1 ? '' : 's'}.`
      : 'Coverage structure: no active Desk Map loaded.',
  ];

  appendWholeProjectSummary(contextLines, {
    mode: 'minimal',
    deskMaps: workspace.deskMaps,
    nodes: workspace.nodes,
    owners: ownerState.owners,
    leases: ownerState.leases,
    leaseholdAssignments: workspace.leaseholdAssignments,
    leaseholdOrris: workspace.leaseholdOrris,
    leaseholdTransferOrderEntries: workspace.leaseholdTransferOrderEntries,
    activeLeasesByOwnerId,
  });

  return contextLines.join('\n');
}

type ProjectSummaryMode = AIAppContextMode;

interface WholeProjectSummaryInput {
  mode: ProjectSummaryMode;
  deskMaps: DeskMap[];
  nodes: OwnershipNode[];
  owners: Owner[];
  leases: Lease[];
  leaseholdAssignments: LeaseholdAssignment[];
  leaseholdOrris: LeaseholdOrri[];
  leaseholdTransferOrderEntries: LeaseholdTransferOrderEntry[];
  activeLeasesByOwnerId: Map<string, Lease[]>;
}

interface NodeKindCounts {
  conveyanceCount: number;
  npriCount: number;
  relatedLeaseCount: number;
  relatedDocumentCount: number;
}

function appendWholeProjectSummary(
  lines: string[],
  input: WholeProjectSummaryInput
): void {
  const activeLeaseCount = getActiveLeases(input.leases).length;
  const codedUnitCodes = new Set(
    input.deskMaps
      .map((deskMap) => cleanText(deskMap.unitCode ?? ''))
      .filter(Boolean)
  );
  const uncodedTractCount = input.deskMaps.filter(
    (deskMap) => !cleanText(deskMap.unitCode ?? '')
  ).length;

  lines.push(
    '',
    input.mode === 'minimal'
      ? 'Whole-project structure (counts only):'
      : 'Whole-project structured summary:',
    `- Tract maps: ${input.deskMaps.length}; title cards: ${input.nodes.length}; owner records: ${input.owners.length}; lease records: ${input.leases.length}; active Texas leases: ${activeLeaseCount}.`,
    `- Unit structure: ${codedUnitCodes.size} coded unit group${codedUnitCodes.size === 1 ? '' : 's'}, ${uncodedTractCount} tract${uncodedTractCount === 1 ? '' : 's'} outside coded units.`,
    `- Leasehold records: ${input.leaseholdAssignments.length} WI assignment${input.leaseholdAssignments.length === 1 ? '' : 's'}, ${input.leaseholdOrris.length} ORRI burden${input.leaseholdOrris.length === 1 ? '' : 's'}, ${input.leaseholdTransferOrderEntries.length} transfer-order row${input.leaseholdTransferOrderEntries.length === 1 ? '' : 's'}.`
  );

  if (input.mode === 'full') {
    const unitSummary = buildProjectLeaseholdUnitSummary(input);
    appendFullLeaseholdTotals(lines, unitSummary);
    appendFullTractRollups(lines, input, unitSummary);
    return;
  }

  appendMinimalTractStructure(lines, input);
}

function appendFullLeaseholdTotals(
  lines: string[],
  unitSummary: LeaseholdUnitSummary
): void {
  lines.push(
    `- Unit totals: gross acres ${unitSummary.totalGrossAcres}; pooled acres ${unitSummary.totalPooledAcres}; royalty decimal ${unitSummary.totalRoyaltyDecimal}; NPRI decimal ${unitSummary.totalNpriDecimal}; ORRI decimal ${unitSummary.totalOrriDecimal}; retained WI ${unitSummary.retainedWorkingInterestDecimal}.`,
    `- Unit warnings: ${unitSummary.overAssignedTractCount} over-assigned tract${unitSummary.overAssignedTractCount === 1 ? '' : 's'}, ${unitSummary.overBurdenedTractCount} over-burdened tract${unitSummary.overBurdenedTractCount === 1 ? '' : 's'}, ${unitSummary.leaseOverlapWarningCount} lease-overlap warning${unitSummary.leaseOverlapWarningCount === 1 ? '' : 's'}, ${unitSummary.inputWarningCount} input warning${unitSummary.inputWarningCount === 1 ? '' : 's'}, ${unitSummary.unitAssignmentWarningCount} unit-assignment warning${unitSummary.unitAssignmentWarningCount === 1 ? '' : 's'}.`
  );
}

function appendFullTractRollups(
  lines: string[],
  input: WholeProjectSummaryInput,
  unitSummary: LeaseholdUnitSummary
): void {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const leaseholdTractByDeskMapId = new Map(
    unitSummary.tracts.map((tract) => [tract.deskMapId, tract])
  );

  lines.push('', 'All-tract rollups:');
  if (input.deskMaps.length === 0) {
    lines.push('- No tract maps loaded.');
    return;
  }

  input.deskMaps.forEach((deskMap) => {
    const tractNodes = nodesForDeskMap(deskMap, nodeById);
    const leaseScopeNodes = leaseScopeNodesForDeskMap(deskMap, input.deskMaps, nodeById);
    const counts = countNodeKinds(tractNodes);
    const coverage = calculateDeskMapCoverageSummary(
      tractNodes,
      input.activeLeasesByOwnerId,
      leaseScopeNodes
    );
    const leaseholdTract = leaseholdTractByDeskMapId.get(deskMap.id);
    const unitLabel = cleanText(deskMap.unitName ?? deskMap.unitCode ?? '');
    const parts = [
      `${cleanText(deskMap.code) || 'Uncoded'} - ${cleanText(deskMap.name) || 'Unnamed tract'}`,
      `${tractNodes.length} card${tractNodes.length === 1 ? '' : 's'}`,
      `${counts.conveyanceCount} conveyance`,
      `${counts.npriCount} NPRI`,
      `${counts.relatedLeaseCount} lease link`,
      `${counts.relatedDocumentCount} document link`,
      `owners current/linked/leased ${coverage.currentOwnerCount}/${coverage.linkedOwnerCount}/${coverage.leasedOwnerCount}`,
      `coverage found ${formatFractionPercent(coverage.currentOwnership)}, linked ${formatFractionPercent(coverage.linkedOwnership)}, leased ${formatFractionPercent(coverage.leasedOwnership)}`,
      `lease warnings ${coverage.leaseOverlaps.length}`,
    ];
    if (unitLabel) parts.push(`unit ${unitLabel}`);
    if (leaseholdTract) {
      parts.push(
        `unit royalty ${leaseholdTract.unitRoyaltyDecimal}`,
        `NRI before ORRI ${leaseholdTract.nriBeforeOrriRate}`,
        `ORRI burden ${leaseholdTract.totalOrriBurdenRate}`,
        `retained WI ${leaseholdTract.retainedWorkingInterestDecimal}`,
        `lessees ${formatNameList(leaseholdTract.uniqueLessees)}`
      );
    }
    lines.push(`- ${parts.join('; ')}`);
  });
}

function buildProjectLeaseholdUnitSummary(
  input: WholeProjectSummaryInput
): LeaseholdUnitSummary {
  return buildLeaseholdUnitSummary({
    deskMaps: input.deskMaps,
    nodes: input.nodes,
    owners: input.owners,
    leases: input.leases,
    leaseholdAssignments: input.leaseholdAssignments,
    leaseholdOrris: input.leaseholdOrris,
  });
}

function appendMinimalTractStructure(
  lines: string[],
  input: WholeProjectSummaryInput
): void {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  lines.push('', 'All-tract structure (counts only):');
  if (input.deskMaps.length === 0) {
    lines.push('- No tract maps loaded.');
    return;
  }

  input.deskMaps.forEach((deskMap, index) => {
    const tractNodes = nodesForDeskMap(deskMap, nodeById);
    const leaseScopeNodes = leaseScopeNodesForDeskMap(deskMap, input.deskMaps, nodeById);
    const counts = countNodeKinds(tractNodes);
    const coverage = calculateDeskMapCoverageSummary(
      tractNodes,
      input.activeLeasesByOwnerId,
      leaseScopeNodes
    );
    lines.push(
      `- Tract ${index + 1}: ${tractNodes.length} title card${tractNodes.length === 1 ? '' : 's'}; ${counts.conveyanceCount} conveyance; ${counts.npriCount} NPRI; ${counts.relatedLeaseCount} related lease; ${counts.relatedDocumentCount} related document; ${coverage.currentOwnerCount} current owner card${coverage.currentOwnerCount === 1 ? '' : 's'}; ${coverage.linkedOwnerCount} linked owner card${coverage.linkedOwnerCount === 1 ? '' : 's'}; ${coverage.leasedOwnerCount} leased owner card${coverage.leasedOwnerCount === 1 ? '' : 's'}; ${coverage.leaseOverlaps.length} lease coverage warning${coverage.leaseOverlaps.length === 1 ? '' : 's'}; coded unit: ${cleanText(deskMap.unitCode ?? '') ? 'yes' : 'no'}.`
    );
  });
}

function nodesForDeskMap(
  deskMap: DeskMap,
  nodeById: Map<string, OwnershipNode>
): OwnershipNode[] {
  return deskMap.nodeIds
    .map((id) => nodeById.get(id))
    .filter((node): node is OwnershipNode => Boolean(node));
}

function leaseScopeNodesForDeskMap(
  deskMap: DeskMap,
  deskMaps: DeskMap[],
  nodeById: Map<string, OwnershipNode>
): OwnershipNode[] {
  const unitCode = cleanText(deskMap.unitCode ?? '');
  if (!unitCode) return nodesForDeskMap(deskMap, nodeById);
  return deskMaps
    .filter((candidate) => cleanText(candidate.unitCode ?? '') === unitCode)
    .flatMap((candidate) => nodesForDeskMap(candidate, nodeById));
}

function countNodeKinds(nodes: OwnershipNode[]): NodeKindCounts {
  return {
    conveyanceCount: nodes.filter(
      (node) => node.type !== 'related' && !isNpriNode(node)
    ).length,
    npriCount: nodes.filter((node) => isNpriNode(node)).length,
    relatedLeaseCount: nodes.filter((node) => isLeaseNode(node)).length,
    relatedDocumentCount: nodes.filter(
      (node) => node.type === 'related' && node.relatedKind === 'document'
    ).length,
  };
}

function formatNameList(values: string[]): string {
  const cleaned = [...new Set(values.map(cleanText).filter(Boolean))];
  if (cleaned.length === 0) return 'none';
  const visible = cleaned.slice(0, 6);
  const hiddenCount = cleaned.length - visible.length;
  return hiddenCount > 0
    ? `${visible.join(', ')} (+${hiddenCount} more)`
    : visible.join(', ');
}

function groupActiveLeasesByOwnerId(leases: Lease[]): Map<string, Lease[]> {
  const activeLeasesByOwnerId = new Map<string, Lease[]>();
  for (const lease of getActiveLeases(leases)) {
    const ownerLeases = activeLeasesByOwnerId.get(lease.ownerId) ?? [];
    ownerLeases.push(lease);
    activeLeasesByOwnerId.set(lease.ownerId, ownerLeases);
  }
  return activeLeasesByOwnerId;
}

function appendDeskMapCoverage(
  lines: string[],
  activeNodes: OwnershipNode[],
  unitNodes: OwnershipNode[],
  activeLeasesByOwnerId: Map<string, Lease[]>
) {
  const summary = calculateDeskMapCoverageSummary(
    activeNodes,
    activeLeasesByOwnerId,
    unitNodes.length > 0 ? unitNodes : activeNodes
  );

  lines.push(
    '',
    'Mineral coverage:',
    `- Found in chain: ${formatFractionPercent(summary.currentOwnership)} across ${summary.currentOwnerCount} owner card${summary.currentOwnerCount === 1 ? '' : 's'}`,
    `- Linked owners: ${formatFractionPercent(summary.linkedOwnership)} across ${summary.linkedOwnerCount} owner card${summary.linkedOwnerCount === 1 ? '' : 's'}`,
    `- Leased: ${formatFractionPercent(summary.leasedOwnership)} across ${summary.leasedOwnerCount} owner card${summary.leasedOwnerCount === 1 ? '' : 's'}`
  );

  if (summary.leaseOverlaps.length > 0) {
    lines.push(
      `- Lease coverage warnings: ${summary.leaseOverlaps.length} overlap/clipped allocation warning${summary.leaseOverlaps.length === 1 ? '' : 's'}`
    );
  }
}

function appendVisibleDeskMapCards(
  lines: string[],
  activeNodes: OwnershipNode[],
  activeLeasesByOwnerId: Map<string, Lease[]>,
  unitNodes: OwnershipNode[]
) {
  const leaseScopeIndex = buildLeaseScopeIndex(unitNodes.length > 0 ? unitNodes : activeNodes);
  const visibleNodes = activeNodes.slice(0, MAX_CONTEXT_NODES);

  lines.push('', 'Visible Desk Map cards:');
  for (const node of visibleNodes) {
    const cardParts = [
      `${nodeLabel(node)}: ${cleanText(node.grantor) || 'Unknown grantor'} -> ${cleanText(node.grantee) || 'Unknown grantee'}`,
      `instrument ${cleanText(node.instrument) || 'Unknown'}`,
      `fraction ${formatFractionPercent(node.fraction)}`,
    ];
    if (node.docNo.trim()) cardParts.push(`doc ${cleanText(node.docNo)}`);
    if (node.parentId) cardParts.push(`parent ${node.parentId}`);
    if (node.linkedOwnerId) {
      const scopedLeases = getLeasesForOwnerNode(
        activeLeasesByOwnerId.get(node.linkedOwnerId) ?? [],
        node,
        leaseScopeIndex
      );
      cardParts.push(`linked owner ${node.linkedOwnerId}`);
      if (scopedLeases.length > 0) {
        cardParts.push(`active lease(s) ${scopedLeases.map(formatLease).join('; ')}`);
      }
    }
    if (node.linkedLeaseId) cardParts.push(`linked lease ${node.linkedLeaseId}`);
    if (node.remarks.trim()) cardParts.push(`remarks ${cleanText(node.remarks)}`);
    lines.push(`- ${cardParts.join('; ')}`);
  }

  const hiddenCount = activeNodes.length - visibleNodes.length;
  if (hiddenCount > 0) {
    lines.push(`- ${hiddenCount} additional card${hiddenCount === 1 ? '' : 's'} omitted from this compact context packet.`);
  }
}

function nodeLabel(node: OwnershipNode): string {
  if (isLeaseNode(node)) return 'Lease';
  if (isNpriNode(node)) return `NPRI ${node.royaltyKind ?? 'unclassified'}`;
  if (node.type === 'related') return node.relatedKind === 'lease' ? 'Related lease' : 'Related document';
  return 'Conveyance';
}

function formatLease(lease: Lease): string {
  const name = cleanText(lease.leaseName) || 'Unnamed lease';
  const lessee = cleanText(lease.lessee) || 'Unknown lessee';
  const interest = cleanText(lease.leasedInterest);
  const royalty = cleanText(lease.royaltyRate);
  return [
    `${name} to ${lessee}`,
    interest ? `leased ${interest}` : '',
    royalty ? `royalty ${royalty}` : '',
  ].filter(Boolean).join(', ');
}

function formatFractionPercent(value: string): string {
  const decimal = d(value);
  return `${formatAsFraction(decimal)} (${decimal.times(100).toFixed(2)}%)`;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
