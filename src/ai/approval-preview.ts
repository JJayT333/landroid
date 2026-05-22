import { buildLeaseNode } from '../components/deskmap/deskmap-lease-node';
import {
  executeAttachConveyance,
  executeConveyance,
  executeCreateNpri,
  executeCreateRootNode,
  executeDeleteBranch,
  executePredecessorInsert,
  validateOwnershipGraph,
  type ValidationIssue,
} from '../engine/math-engine';
import { useOwnerStore } from '../store/owner-store';
import { useWorkspaceStore } from '../store/workspace-store';
import {
  normalizeOwnershipNode,
  type FixedRoyaltyBasis,
  type InterestClass,
  type OwnershipNode,
  type RoyaltyKind,
} from '../types/node';
import {
  isTexasMathLeaseJurisdiction,
  isTexasMathLease,
} from '../types/owner';
import type { Result } from '../types/result';
import { parseStrictInterestString } from '../utils/interest-string';

export type AIApprovalPreviewTone = 'default' | 'warning' | 'danger';

export interface AIApprovalPreviewChange {
  label: string;
  before: string;
  after: string;
  tone?: AIApprovalPreviewTone;
}

export interface AIApprovalPreviewIssue {
  code: string;
  nodeId: string | null;
  message: string;
}

export type AIApprovalPreviewValidationStatus =
  | 'valid'
  | 'issues'
  | 'blocked'
  | 'not_applicable';

export interface AIApprovalPreviewValidation {
  status: AIApprovalPreviewValidationStatus;
  message: string;
  issueCount: number;
  issues: AIApprovalPreviewIssue[];
}

export interface AIApprovalPreview {
  title: string;
  target: string;
  changes: AIApprovalPreviewChange[];
  warnings: string[];
  validation: AIApprovalPreviewValidation;
  canApprove: boolean;
}

const PREVIEW_NODE_ID = '__ai_preview_node__';
const PREVIEW_LEASE_NODE_ID = '__ai_preview_lease_node__';

export function buildAIApprovalPreview(
  toolName: string,
  input: unknown
): AIApprovalPreview {
  try {
    switch (toolName) {
      case 'createRootNode':
        return previewCreateRootNode(input);
      case 'convey':
        return previewConvey(input);
      case 'createNpri':
        return previewCreateNpri(input);
      case 'precede':
        return previewPrecede(input);
      case 'graftToParent':
        return previewGraftToParent(input);
      case 'deleteNode':
        return previewDeleteNode(input);
      case 'attachLease':
        return previewAttachLease(input);
      case 'createOwner':
        return previewCreateOwner(input);
      case 'createLease':
        return previewCreateLease(input);
      case 'createDeskMap':
        return previewCreateDeskMap(input);
      case 'setActiveDeskMap':
        return previewSetActiveDeskMap(input);
      default:
        return basePreview({
          title: `Preview ${toolName}`,
          target: toolName,
          validation: notApplicableValidation('No typed preview is available for this proposal yet.'),
        });
    }
  } catch (err) {
    return basePreview({
      title: `Preview ${toolName}`,
      target: toolName,
      validation: blockedValidation(
        err instanceof Error ? err.message : String(err)
      ),
    });
  }
}

export function assertAIApprovalPreviewCanApply(
  proposalId: string,
  toolName: string,
  input: unknown
): AIApprovalPreview {
  const preview = buildAIApprovalPreview(toolName, input);
  if (!preview.canApprove) {
    throw new Error(
      `AI proposal ${proposalId} cannot be approved: ${preview.validation.message}`
    );
  }
  return preview;
}

function previewCreateRootNode(input: unknown): AIApprovalPreview {
  const data = asRecord(input);
  const state = useWorkspaceStore.getState();
  const kind = enumValue<InterestClass>(data.kind, ['mineral', 'npri']) ?? 'mineral';
  const royaltyKind =
    kind === 'npri'
      ? enumValue<Exclude<RoyaltyKind, null>>(data.royaltyKind, ['fixed', 'floating']) ?? 'fixed'
      : null;
  const fixedRoyaltyBasis =
    kind === 'npri' && royaltyKind === 'fixed'
      ? enumValue<Exclude<FixedRoyaltyBasis, null>>(data.fixedRoyaltyBasis, [
          'burdened_branch',
          'whole_tract',
        ]) ?? 'burdened_branch'
      : null;
  const initialFraction = text(data.initialFraction);
  const explicitDeskMapId = optionalText(data.deskMapId);
  if (explicitDeskMapId && !state.deskMaps.some((dm) => dm.id === explicitDeskMapId)) {
    return blockedPreview(
      'Create root node',
      explicitDeskMapId,
      `Desk map not found: ${explicitDeskMapId}`,
      [
        change('Node count', state.nodes.length, state.nodes.length),
        change('Target desk map', 'missing', explicitDeskMapId, 'danger'),
      ]
    );
  }

  const targetDeskMap = resolveTargetDeskMap(explicitDeskMapId);
  const form = {
    ...formToPartialNode(data.form),
    interestClass: kind,
    royaltyKind,
    fixedRoyaltyBasis,
    linkedOwnerId: optionalText(data.linkedOwnerId) ?? null,
  };
  const result = executeCreateRootNode({
    allNodes: state.nodes,
    newNodeId: PREVIEW_NODE_ID,
    initialFraction,
    form,
  });
  return previewFromNodeResult({
    title: 'Create root node',
    target: targetDeskMap
      ? `${targetDeskMap.name} (${targetDeskMap.code || targetDeskMap.id})`
      : 'Workspace graph',
    result,
    changes: [
      change('Node count', state.nodes.length, result.ok ? result.data.length : state.nodes.length),
      change('Interest class', 'none', kind),
      change('Initial fraction', 'none', initialFraction),
      change('Target desk map', 'none', targetDeskMap?.name ?? 'No active desk map'),
    ],
  });
}

function previewConvey(input: unknown): AIApprovalPreview {
  const data = asRecord(input);
  const state = useWorkspaceStore.getState();
  const parentNodeId = text(data.parentNodeId);
  const share = text(data.share);
  const parent = state.nodes.find((node) => node.id === parentNodeId) ?? null;
  const result = executeConveyance({
    allNodes: state.nodes,
    parentId: parentNodeId,
    newNodeId: PREVIEW_NODE_ID,
    share,
    form: formToPartialNode(data.form),
  });
  const nextParent = result.ok
    ? result.data.find((node) => node.id === parentNodeId) ?? null
    : null;
  return previewFromNodeResult({
    title: 'Convey interest',
    target: labelNode(parent, parentNodeId),
    result,
    changes: [
      change('Parent remaining', parent?.fraction ?? 'unknown', nextParent?.fraction ?? 'blocked'),
      change('New child initial', 'none', share),
      change('Node count', state.nodes.length, result.ok ? result.data.length : state.nodes.length),
    ],
  });
}

function previewCreateNpri(input: unknown): AIApprovalPreview {
  const data = asRecord(input);
  const state = useWorkspaceStore.getState();
  const parentNodeId = text(data.parentNodeId);
  const share = text(data.share);
  const royaltyKind =
    enumValue<Exclude<RoyaltyKind, null>>(data.royaltyKind, ['fixed', 'floating'])
    ?? 'fixed';
  const fixedRoyaltyBasis =
    royaltyKind === 'fixed'
      ? enumValue<Exclude<FixedRoyaltyBasis, null>>(data.fixedRoyaltyBasis, [
          'burdened_branch',
          'whole_tract',
        ]) ?? 'burdened_branch'
      : null;
  const parent = state.nodes.find((node) => node.id === parentNodeId) ?? null;
  const result = executeCreateNpri({
    allNodes: state.nodes,
    parentId: parentNodeId,
    newNodeId: PREVIEW_NODE_ID,
    share,
    form: {
      ...formToPartialNode(data.form),
      royaltyKind,
      fixedRoyaltyBasis,
    },
  });
  return previewFromNodeResult({
    title: 'Create NPRI branch',
    target: labelNode(parent, parentNodeId),
    result,
    changes: [
      change('NPRI share', 'none', share),
      change('Royalty kind', 'none', royaltyKind),
      change('Fixed basis', 'none', fixedRoyaltyBasis ?? 'not applicable'),
      change('Node count', state.nodes.length, result.ok ? result.data.length : state.nodes.length),
    ],
    warnings:
      royaltyKind === 'fixed' && !optionalText(data.fixedRoyaltyBasis)
        ? ['Fixed NPRI basis was not explicit; LANDroid will use burdened_branch if approved.']
        : [],
  });
}

function previewPrecede(input: unknown): AIApprovalPreview {
  const data = asRecord(input);
  const state = useWorkspaceStore.getState();
  const nodeId = text(data.nodeId);
  const target = state.nodes.find((node) => node.id === nodeId) ?? null;
  const newInitialFraction = text(data.newInitialFraction);
  const result = executePredecessorInsert({
    allNodes: state.nodes,
    activeNodeId: nodeId,
    activeNodeParentId: target?.parentId ?? null,
    newPredecessorId: PREVIEW_NODE_ID,
    newInitialFraction,
    form: formToPartialNode(data.form),
  });
  const movedTarget = result.ok
    ? result.data.find((node) => node.id === nodeId) ?? null
    : null;
  return previewFromNodeResult({
    title: 'Insert predecessor',
    target: labelNode(target, nodeId),
    result,
    changes: [
      change('Existing parent', target?.parentId ?? 'root', movedTarget?.parentId ?? 'blocked'),
      change('Predecessor initial', 'none', newInitialFraction),
      change('Affected nodes', 0, result.ok ? result.audit.affectedCount : 0),
    ],
  });
}

function previewGraftToParent(input: unknown): AIApprovalPreview {
  const data = asRecord(input);
  const state = useWorkspaceStore.getState();
  const parentNodeId = text(data.parentNodeId);
  const orphanNodeIds = stringArray(data.orphanNodeIds);
  const calcShares = data.calcShares === undefined
    ? null
    : stringArray(data.calcShares);
  if (calcShares && calcShares.length !== orphanNodeIds.length) {
    return blockedPreview(
      'Graft orphan roots',
      parentNodeId,
      'calcShares length must match orphanNodeIds length',
      [change('Orphan roots', orphanNodeIds.length, orphanNodeIds.length, 'danger')]
    );
  }

  const missing = orphanNodeIds.filter(
    (nodeId) => !state.nodes.some((node) => node.id === nodeId)
  );
  if (missing.length > 0) {
    return blockedPreview(
      'Graft orphan roots',
      parentNodeId,
      `Missing orphan node(s): ${missing.join(', ')}`,
      [change('Missing roots', 0, missing.length, 'danger')]
    );
  }

  let candidate = state.nodes;
  let affectedCount = 0;
  for (let index = 0; index < orphanNodeIds.length; index += 1) {
    const orphanNodeId = orphanNodeIds[index];
    const orphan = candidate.find((node) => node.id === orphanNodeId);
    const result = executeAttachConveyance({
      allNodes: candidate,
      activeNodeId: orphanNodeId,
      attachParentId: parentNodeId,
      calcShare: calcShares?.[index] ?? orphan?.initialFraction ?? '',
      form: {},
    });
    if (!result.ok) {
      return blockedPreview(
        'Graft orphan roots',
        parentNodeId,
        `${orphanNodeId}: ${result.error.message}`,
        [
          change('Roots requested', orphanNodeIds.length, orphanNodeIds.length),
          change('Roots attachable', index, index, 'danger'),
        ]
      );
    }
    candidate = result.data.map((node) => normalizeOwnershipNode(node));
    affectedCount += result.audit.affectedCount;
  }

  return basePreview({
    title: 'Graft orphan roots',
    target: parentNodeId,
    changes: [
      change('Roots attached', 0, orphanNodeIds.length),
      change('Affected nodes', 0, affectedCount),
    ],
    validation: validationFromNodes(candidate),
  });
}

function previewDeleteNode(input: unknown): AIApprovalPreview {
  const data = asRecord(input);
  const state = useWorkspaceStore.getState();
  const nodeId = text(data.nodeId);
  const target = state.nodes.find((node) => node.id === nodeId) ?? null;
  if (!target) {
    return blockedPreview(
      'Delete node',
      nodeId,
      `No node with id ${nodeId}`,
      [change('Node count', state.nodes.length, state.nodes.length, 'danger')]
    );
  }

  const descendants = collectDescendantIds(state.nodes, nodeId);
  if (descendants.size > 0) {
    return blockedPreview(
      'Delete node',
      labelNode(target, nodeId),
      `AI delete is limited to leaves; this node has ${descendants.size} descendant(s).`,
      [
        change('Descendants', descendants.size, descendants.size, 'danger'),
        change('Nodes removed', 0, descendants.size + 1, 'danger'),
      ],
      ['Delete this branch from the Desk Map UI so the cascade blast radius is approved in person.']
    );
  }

  const result = executeDeleteBranch({ allNodes: state.nodes, nodeId });
  return previewFromNodeResult({
    title: 'Delete leaf node',
    target: labelNode(target, nodeId),
    result,
    changes: [
      change('Node count', state.nodes.length, result.ok ? result.data.length : state.nodes.length, 'danger'),
      change('Removed node', target.id, 'deleted', 'danger'),
      change('Linked attachments', target.attachments.length, 'detached/deleted if unshared', target.attachments.length > 0 ? 'warning' : undefined),
    ],
  });
}

function previewAttachLease(input: unknown): AIApprovalPreview {
  const data = asRecord(input);
  const state = useWorkspaceStore.getState();
  const owners = useOwnerStore.getState();
  const mineralNodeId = text(data.mineralNodeId);
  const leaseId = text(data.leaseId);
  const parent = state.nodes.find((node) => node.id === mineralNodeId) ?? null;
  const lease = owners.leases.find((candidate) => candidate.id === leaseId) ?? null;
  if (!parent) {
    return blockedPreview('Attach lease', mineralNodeId, `Mineral node ${mineralNodeId} not found.`);
  }
  if (!lease) {
    return blockedPreview('Attach lease', mineralNodeId, `Lease ${leaseId} not found.`);
  }
  if (parent.type === 'related') {
    return blockedPreview('Attach lease', labelNode(parent, mineralNodeId), 'Leases must attach to title-interest nodes.');
  }
  if (parent.interestClass !== 'mineral') {
    return blockedPreview('Attach lease', labelNode(parent, mineralNodeId), 'Leases can only attach to mineral nodes, never NPRI.');
  }
  if (!isTexasMathLease(lease)) {
    return blockedPreview(
      'Attach lease',
      labelNode(parent, mineralNodeId),
      'Only Texas fee/state leases can attach to Desk Map math.'
    );
  }
  if (parent.linkedOwnerId && lease.ownerId !== parent.linkedOwnerId) {
    return blockedPreview(
      'Attach lease',
      labelNode(parent, mineralNodeId),
      'Lease owner does not match the mineral node linked owner.'
    );
  }

  const leaseNode = normalizeOwnershipNode(
    buildLeaseNode({ id: PREVIEW_LEASE_NODE_ID, parentNode: parent, lease })
  );
  const candidate = [...state.nodes, leaseNode];
  return basePreview({
    title: 'Attach lease',
    target: labelNode(parent, mineralNodeId),
    changes: [
      change('Node count', state.nodes.length, candidate.length),
      change('Lease node', 'none', lease.leaseName || lease.id),
    ],
    validation: validationFromNodes(candidate),
  });
}

function previewCreateOwner(input: unknown): AIApprovalPreview {
  const data = asRecord(input);
  const workspaceId = useWorkspaceStore.getState().workspaceId;
  const owners = useOwnerStore.getState().owners;
  const name = text(data.name);
  if (!workspaceId) {
    return blockedPreview('Create owner', name || 'Owner', 'No active workspace.');
  }
  if (!name) {
    return blockedPreview('Create owner', 'Owner', 'Owner name is required.');
  }
  return basePreview({
    title: 'Create owner',
    target: name,
    changes: [
      change('Owner count', owners.length, owners.length + 1),
      change('Entity type', 'none', optionalText(data.entityType) ?? 'Individual'),
      change('County', 'none', optionalText(data.county) ?? 'blank'),
    ],
    validation: notApplicableValidation('Owner records do not change ownership graph math.'),
  });
}

function previewCreateLease(input: unknown): AIApprovalPreview {
  const data = asRecord(input);
  const workspaceId = useWorkspaceStore.getState().workspaceId;
  const ownerState = useOwnerStore.getState();
  const ownerId = text(data.ownerId);
  const owner = ownerState.owners.find((candidate) => candidate.id === ownerId) ?? null;
  if (!workspaceId) {
    return blockedPreview('Create lease', ownerId, 'No active workspace.');
  }
  if (!owner) {
    return blockedPreview('Create lease', ownerId, `Owner ${ownerId} not found.`);
  }
  const royaltyRate = optionalText(data.royaltyRate);
  const leasedInterest = optionalText(data.leasedInterest);
  if (data.royaltyRate === '') {
    return blockedPreview('Create lease', owner.name, 'royaltyRate cannot be an empty string.');
  }
  if (data.leasedInterest === '') {
    return blockedPreview('Create lease', owner.name, 'leasedInterest cannot be an empty string.');
  }
  if (royaltyRate && parseStrictInterestString(royaltyRate) === null) {
    return blockedPreview('Create lease', owner.name, 'Royalty rate must be a fraction or decimal.');
  }
  if (leasedInterest && parseStrictInterestString(leasedInterest) === null) {
    return blockedPreview('Create lease', owner.name, 'Leased interest must be a fraction or decimal.');
  }
  const jurisdiction = optionalText(data.jurisdiction);
  if (jurisdiction && !isTexasMathLeaseJurisdiction(jurisdiction)) {
    return blockedPreview(
      'Create lease',
      owner.name,
      'Only Texas fee/state leases can be created from active Desk Map AI tools.'
    );
  }
  return basePreview({
    title: 'Create lease',
    target: owner.name,
    changes: [
      change('Lease count', ownerState.leases.length, ownerState.leases.length + 1),
      change('Royalty rate', 'none', royaltyRate ?? 'blank'),
      change('Leased interest', 'none', leasedInterest ?? 'blank'),
      change('Jurisdiction', 'none', jurisdiction ?? 'tx_fee'),
    ],
    validation: notApplicableValidation('Lease records do not change ownership graph math until attached to a mineral node.'),
  });
}

function previewCreateDeskMap(input: unknown): AIApprovalPreview {
  const data = asRecord(input);
  const state = useWorkspaceStore.getState();
  const name = text(data.name);
  const code = text(data.code);
  const existing = state.deskMaps.find(
    (deskMap) => deskMap.code.trim().toLowerCase() === code.trim().toLowerCase()
  );
  if (!name) {
    return blockedPreview('Create desk map', code || 'Desk map', 'Desk map name is required.');
  }
  if (!code) {
    return blockedPreview('Create desk map', name, 'Desk map code is required.');
  }
  if (existing) {
    return blockedPreview(
      'Create desk map',
      name,
      `Desk map with code "${code}" already exists (id: ${existing.id}).`
    );
  }
  return basePreview({
    title: 'Create desk map',
    target: `${name} (${code})`,
    changes: [
      change('Desk map count', state.deskMaps.length, state.deskMaps.length + 1),
      change('Active desk map', state.activeDeskMapId ?? 'none', name),
      change('Gross acres', 'none', optionalText(data.grossAcres) ?? 'blank'),
      change('Pooled acres', 'none', optionalText(data.pooledAcres) ?? 'blank'),
    ],
    validation: notApplicableValidation('Desk map records do not change ownership graph math.'),
  });
}

function previewSetActiveDeskMap(input: unknown): AIApprovalPreview {
  const data = asRecord(input);
  const state = useWorkspaceStore.getState();
  const deskMapId = text(data.deskMapId);
  const target = state.deskMaps.find((deskMap) => deskMap.id === deskMapId) ?? null;
  if (!target) {
    return blockedPreview('Switch active desk map', deskMapId, `No desk map with id ${deskMapId}.`);
  }
  const current = state.deskMaps.find((deskMap) => deskMap.id === state.activeDeskMapId) ?? null;
  return basePreview({
    title: 'Switch active desk map',
    target: target.name,
    changes: [
      change('Active desk map', current?.name ?? 'none', target.name),
      change('Active code', current?.code ?? 'none', target.code),
    ],
    validation: notApplicableValidation('Changing focus does not change ownership graph math.'),
  });
}

function previewFromNodeResult({
  title,
  target,
  result,
  changes,
  warnings = [],
}: {
  title: string;
  target: string;
  result: Result<OwnershipNode[]>;
  changes: AIApprovalPreviewChange[];
  warnings?: string[];
}): AIApprovalPreview {
  if (!result.ok) {
    return basePreview({
      title,
      target,
      changes,
      warnings,
      validation: blockedValidation(result.error.message, result.error.details),
    });
  }
  return basePreview({
    title,
    target,
    changes,
    warnings,
    validation: validationFromNodes(result.data),
  });
}

function blockedPreview(
  title: string,
  target: string,
  message: string,
  changes: AIApprovalPreviewChange[] = [],
  warnings: string[] = []
): AIApprovalPreview {
  return basePreview({
    title,
    target,
    changes,
    warnings,
    validation: blockedValidation(message),
  });
}

function basePreview({
  title,
  target,
  changes = [],
  warnings = [],
  validation,
}: {
  title: string;
  target: string;
  changes?: AIApprovalPreviewChange[];
  warnings?: string[];
  validation: AIApprovalPreviewValidation;
}): AIApprovalPreview {
  return {
    title,
    target,
    changes,
    warnings,
    validation,
    canApprove: validation.status !== 'blocked',
  };
}

function validationFromNodes(nodes: OwnershipNode[]): AIApprovalPreviewValidation {
  const validation = validateOwnershipGraph(nodes);
  if (validation.valid) {
    return {
      status: 'valid',
      message: 'Graph validation preview passes.',
      issueCount: 0,
      issues: [],
    };
  }
  return {
    status: 'issues',
    message: `Graph validation preview has ${validation.issues.length} issue(s).`,
    issueCount: validation.issues.length,
    issues: validation.issues.slice(0, 6).map(normalizeIssue),
  };
}

function blockedValidation(
  message: string,
  details?: unknown
): AIApprovalPreviewValidation {
  const issues = Array.isArray(details)
    ? details.slice(0, 6).flatMap((item) => {
        const issue = item as Partial<ValidationIssue>;
        return typeof issue.code === 'string' && typeof issue.message === 'string'
          ? [normalizeIssue(issue as ValidationIssue)]
          : [];
      })
    : [];
  return {
    status: 'blocked',
    message,
    issueCount: issues.length,
    issues,
  };
}

function notApplicableValidation(message: string): AIApprovalPreviewValidation {
  return {
    status: 'not_applicable',
    message,
    issueCount: 0,
    issues: [],
  };
}

function normalizeIssue(issue: ValidationIssue): AIApprovalPreviewIssue {
  return {
    code: issue.code,
    nodeId: issue.nodeId ?? null,
    message: issue.message,
  };
}

function change(
  label: string,
  before: unknown,
  after: unknown,
  tone?: AIApprovalPreviewTone
): AIApprovalPreviewChange {
  return tone
    ? { label, before: valueToText(before), after: valueToText(after), tone }
    : { label, before: valueToText(before), after: valueToText(after) };
}

function collectDescendantIds(nodes: OwnershipNode[], rootId: string): Set<string> {
  const descendants = new Set<string>();
  const stack = nodes
    .filter((node) => node.parentId === rootId)
    .map((node) => node.id);
  while (stack.length > 0) {
    const nextId = stack.pop()!;
    if (descendants.has(nextId)) continue;
    descendants.add(nextId);
    for (const node of nodes) {
      if (node.parentId === nextId) stack.push(node.id);
    }
  }
  return descendants;
}

function resolveTargetDeskMap(deskMapId: string | null) {
  const state = useWorkspaceStore.getState();
  if (deskMapId) {
    return state.deskMaps.find((deskMap) => deskMap.id === deskMapId) ?? null;
  }
  return state.deskMaps.find((deskMap) => deskMap.id === state.activeDeskMapId) ?? null;
}

function labelNode(node: OwnershipNode | null, fallbackId: string): string {
  if (!node) return fallbackId || 'Unknown node';
  const name = node.grantee || node.grantor || node.id;
  return `${name} (${node.id})`;
}

function formToPartialNode(value: unknown): Partial<OwnershipNode> {
  const form = asRecord(value);
  return Object.fromEntries(
    Object.entries(form).filter(([, item]) => item !== undefined && item !== '')
  ) as Partial<OwnershipNode>;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const normalized = text(item);
        return normalized ? [normalized] : [];
      })
    : [];
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T
    : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function optionalText(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function valueToText(value: unknown): string {
  const normalized = text(value);
  return normalized || 'none';
}
