import { d } from '../engine/decimal';
import { formatAsFraction } from '../engine/fraction-display';
import {
  buildLeaseScopeIndex,
  calculateDeskMapCoverageSummary,
  getActiveLeases,
  getLeasesForOwnerNode,
} from '../components/deskmap/deskmap-coverage';
import { isLeaseNode } from '../components/deskmap/deskmap-lease-node';
import { useOwnerStore } from '../store/owner-store';
import { useUIStore, type ViewMode } from '../store/ui-store';
import { useWorkspaceStore } from '../store/workspace-store';
import { isNpriNode, type OwnershipNode } from '../types/node';
import type { Lease } from '../types/owner';
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

  return [
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
  ].join('\n');
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
