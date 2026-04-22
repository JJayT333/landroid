/**
 * Tools the AI assistant can invoke.
 *
 * Two kinds:
 *   - Read-only: plain TS wrappers over Zustand stores returning compact,
 *     citation-friendly summaries. Deterministic — same state must produce
 *     the same output.
 *   - Mutating: thin wrappers over workspace-store actions that change
 *     project data. Each returns { ok, ...ids, validation } so the model
 *     can see whether the move broke the ownership graph and self-correct.
 *     Every mutating tool name MUST also be listed in MUTATING_TOOL_NAMES
 *     (bottom of file) so runChat.ts can commit an undo snapshot.
 */
import { tool } from 'ai';
import { z } from 'zod';
import { useWorkspaceStore } from '../store/workspace-store';
import { useOwnerStore } from '../store/owner-store';
import { useCurativeStore } from '../store/curative-store';
import type { OwnershipNode } from '../types/node';
import { validateOwnershipGraph } from '../engine/math-engine';
import {
  createBlankLease,
  createBlankOwner,
  isTexasMathLeaseJurisdiction,
} from '../types/owner';
import { parseStrictInterestString } from '../utils/interest-string';

function truncate(text: string, max = 140): string {
  const trimmed = (text ?? '').trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1) + '…';
}

function summariseProject() {
  const ws = useWorkspaceStore.getState();
  const owners = useOwnerStore.getState().owners;
  const leases = useOwnerStore.getState().leases;
  const curative = useCurativeStore.getState();

  const activeDeskMap = ws.deskMaps.find((d) => d.id === ws.activeDeskMapId);
  const nodeCounts = ws.nodes.reduce(
    (acc, n) => {
      acc[n.interestClass] = (acc[n.interestClass] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    projectName: ws.projectName,
    deskMapCount: ws.deskMaps.length,
    activeDeskMap: activeDeskMap
      ? { id: activeDeskMap.id, name: activeDeskMap.name, code: activeDeskMap.code }
      : null,
    totalNodes: ws.nodes.length,
    nodeCountsByInterestClass: nodeCounts,
    ownerCount: owners.length,
    leaseCount: leases.length,
    leaseholdAssignmentCount: ws.leaseholdAssignments.length,
    leaseholdOrriCount: ws.leaseholdOrris.length,
    titleIssueCount: curative.titleIssues.length,
  };
}

function listDeskMaps() {
  const { deskMaps, nodes } = useWorkspaceStore.getState();
  return deskMaps.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    grossAcres: d.grossAcres,
    pooledAcres: d.pooledAcres,
    unitName: d.unitName ?? null,
    nodeCount: nodes.filter((n) => (d.nodeIds ?? []).includes(n.id)).length,
  }));
}

function getLessorRoster() {
  const owners = useOwnerStore.getState().owners;
  const leases = useOwnerStore.getState().leases;
  const byOwner = new Map<string, typeof leases>();
  for (const l of leases) {
    const arr = byOwner.get(l.ownerId) ?? [];
    arr.push(l);
    byOwner.set(l.ownerId, arr);
  }
  return owners
    .map((o) => {
      const ownerLeases = byOwner.get(o.id) ?? [];
      return {
        ownerId: o.id,
        name: o.name,
        entityType: o.entityType,
        county: o.county,
        leaseCount: ownerLeases.length,
        leases: ownerLeases.map((l) => ({
          id: l.id,
          leaseName: l.leaseName,
          lessee: l.lessee,
          royaltyRate: l.royaltyRate,
          status: l.status,
          effectiveDate: l.effectiveDate,
          expirationDate: l.expirationDate,
          jurisdiction: l.jurisdiction,
        })),
      };
    })
    .sort((a, b) => b.leaseCount - a.leaseCount || a.name.localeCompare(b.name));
}

function searchInstruments(query: string, limit: number) {
  const { nodes } = useWorkspaceStore.getState();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = nodes.filter((n) => {
    return (
      n.grantor.toLowerCase().includes(q)
      || n.grantee.toLowerCase().includes(q)
      || n.instrument.toLowerCase().includes(q)
      || n.docNo.toLowerCase().includes(q)
      || n.landDesc.toLowerCase().includes(q)
    );
  });
  return matches.slice(0, Math.max(1, Math.min(limit, 50))).map((n) => ({
    nodeId: n.id,
    instrument: n.instrument,
    grantor: n.grantor,
    grantee: n.grantee,
    docNo: n.docNo,
    date: n.date,
    fileDate: n.fileDate,
    interestClass: n.interestClass,
    royaltyKind: n.royaltyKind,
    fraction: n.fraction,
    landDesc: truncate(n.landDesc, 100),
    remarks: truncate(n.remarks, 100),
  }));
}

function getLeaseholdSummary() {
  const ws = useWorkspaceStore.getState();
  return {
    unit: {
      name: ws.leaseholdUnit.name,
      operator: ws.leaseholdUnit.operator,
      effectiveDate: ws.leaseholdUnit.effectiveDate,
      jurisdiction: ws.leaseholdUnit.jurisdiction,
      description: truncate(ws.leaseholdUnit.description, 200),
    },
    assignments: ws.leaseholdAssignments.map((a) => ({
      id: a.id,
      assignor: a.assignor,
      assignee: a.assignee,
      scope: a.scope,
      deskMapId: a.deskMapId,
      workingInterestFraction: a.workingInterestFraction,
      effectiveDate: a.effectiveDate,
      sourceDocNo: a.sourceDocNo,
    })),
    orris: ws.leaseholdOrris.map((o) => ({
      id: o.id,
      payee: o.payee,
      scope: o.scope,
      deskMapId: o.deskMapId,
      burdenFraction: o.burdenFraction,
      burdenBasis: o.burdenBasis,
      effectiveDate: o.effectiveDate,
      sourceDocNo: o.sourceDocNo,
    })),
    transferOrderEntries: ws.leaseholdTransferOrderEntries.length,
  };
}

function explainNode(nodeId: string) {
  const { nodes, deskMaps } = useWorkspaceStore.getState();
  const target = nodes.find((n) => n.id === nodeId);
  if (!target) return { error: `No node with id ${nodeId}` };

  // Walk up parent chain for derivation context.
  const chain: OwnershipNode[] = [];
  let cursor: OwnershipNode | undefined = target;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.push(cursor);
    cursor = cursor.parentId
      ? nodes.find((n) => n.id === cursor!.parentId)
      : undefined;
  }

  const hostingDeskMap = deskMaps.find((d) =>
    (d.nodeIds ?? []).includes(target.id)
  );

  return {
    nodeId: target.id,
    grantor: target.grantor,
    grantee: target.grantee,
    instrument: target.instrument,
    docNo: target.docNo,
    interestClass: target.interestClass,
    royaltyKind: target.royaltyKind,
    currentFraction: target.fraction,
    initialFraction: target.initialFraction,
    conveyanceMode: target.conveyanceMode,
    splitBasis: target.splitBasis,
    landDesc: truncate(target.landDesc, 200),
    remarks: truncate(target.remarks, 200),
    hostingDeskMap: hostingDeskMap
      ? { id: hostingDeskMap.id, name: hostingDeskMap.name, code: hostingDeskMap.code }
      : null,
    parentChain: chain.slice(1).map((n) => ({
      nodeId: n.id,
      grantor: n.grantor,
      grantee: n.grantee,
      instrument: n.instrument,
      interestClass: n.interestClass,
      fraction: n.fraction,
      initialFraction: n.initialFraction,
    })),
  };
}

// ---------------------------------------------------------------------------
// Mutating-tool helpers
// ---------------------------------------------------------------------------

function newNodeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Shared shape for deed / instrument metadata the model can set on any new
 * title-interest node. Every field is optional — the model may provide only
 * what it knows from the conversation so far. `interestClass`, `royaltyKind`,
 * and `fixedRoyaltyBasis` are set by the specific tool, not the form.
 */
const nodeFormSchema = z
  .object({
    grantor: z.string().optional(),
    grantee: z.string().optional(),
    instrument: z.string().optional(),
    docNo: z.string().optional(),
    vol: z.string().optional(),
    page: z.string().optional(),
    date: z.string().optional().describe('Instrument date, any parseable string.'),
    fileDate: z.string().optional(),
    landDesc: z.string().optional(),
    remarks: z.string().optional(),
  })
  .describe('Deed metadata. Any field may be omitted.');

function formToPartialNode(
  form: z.infer<typeof nodeFormSchema> | undefined
): Partial<OwnershipNode> {
  if (!form) return {};
  return Object.fromEntries(
    Object.entries(form).filter(([, v]) => v !== undefined && v !== '')
  ) as Partial<OwnershipNode>;
}

/** Compact validation summary returned to the model after any mutation. */
function summariseValidation() {
  const { nodes } = useWorkspaceStore.getState();
  const v = validateOwnershipGraph(nodes);
  if (v.valid) return { valid: true, issueCount: 0, issues: [] };
  return {
    valid: false,
    issueCount: v.issues.length,
    issues: v.issues.slice(0, 10).map((i) => ({
      code: i.code,
      nodeId: i.nodeId ?? null,
      message: i.message,
    })),
  };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const landroidTools = {
  getProjectSummary: tool({
    description:
      'Return a high-level summary of the current LANDroid workspace: project name, desk-map count, active desk map, node counts by interest class, owner and lease counts, title-issue count. Use this first whenever the user asks about what is in the project.',
    inputSchema: z.object({}),
    execute: async () => summariseProject(),
  }),

  listDeskMaps: tool({
    description:
      'List every desk map (tract) in the current workspace with its code, gross acres, pooled acres, unit name if any, and node count.',
    inputSchema: z.object({}),
    execute: async () => listDeskMaps(),
  }),

  getLessorRoster: tool({
    description:
      'List every owner (lessor) with their linked lease records (lessee, royalty rate, status, effective/expiration dates, jurisdiction). Use when the user asks about lessors, lease status, or royalty rates across the project. Sorted by lease count then name.',
    inputSchema: z.object({}),
    execute: async () => getLessorRoster(),
  }),

  searchInstruments: tool({
    description:
      'Search chain-of-title ownership nodes by substring. Matches grantor, grantee, instrument type, doc number, or land description. Use when the user asks "who conveyed X?", "find the deed from A to B", or mentions a specific document number. Returns up to `limit` matches.',
    inputSchema: z.object({
      query: z.string().min(1).describe('Case-insensitive substring to match.'),
      limit: z.number().int().min(1).max(50).default(10),
    }),
    execute: async ({ query, limit }) => searchInstruments(query, limit),
  }),

  getLeaseholdSummary: tool({
    description:
      'Return the current leasehold unit header, every WI assignment, every ORRI, and the transfer-order entry count. Use for leasehold-side questions (WI splits, overriding royalties, unit operator).',
    inputSchema: z.object({}),
    execute: async () => getLeaseholdSummary(),
  }),

  explainNode: tool({
    description:
      'Return a specific ownership node plus its parent chain, used to explain how a given fraction was derived. Use when the user asks "why is this X?", "explain this branch", or "where did this NPRI come from?". nodeId comes from prior tool results — do not invent IDs.',
    inputSchema: z.object({
      nodeId: z.string().min(1),
    }),
    execute: async ({ nodeId }) => explainNode(nodeId),
  }),

  listOwners: tool({
    description:
      'List every owner record with id, name, entity type, county, and lease count. Use before attachLease so you can pick an existing lessor (mineral owner) rather than inventing one.',
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe('Case-insensitive substring to filter by name; omit for all.'),
    }),
    execute: async ({ query }) => {
      const owners = useOwnerStore.getState().owners;
      const leases = useOwnerStore.getState().leases;
      const q = (query ?? '').trim().toLowerCase();
      const filtered = q
        ? owners.filter((o) => o.name.toLowerCase().includes(q))
        : owners;
      return filtered.map((o) => ({
        ownerId: o.id,
        name: o.name,
        entityType: o.entityType,
        county: o.county,
        leaseCount: leases.filter((l) => l.ownerId === o.id).length,
      }));
    },
  }),

  // -----------------------------------------------------------------------
  // MUTATING TOOLS — every call changes workspace state.
  // Each returns { ok, ... , validation } so the model can self-correct.
  // -----------------------------------------------------------------------

  createRootNode: tool({
    description:
      'Create a standalone tree root — a new mineral (or NPRI) node with no parent. Use when importing an owner whose common grantor is not yet known; the tree can be grafted later with graftToParent. Mineral is the default; set kind="npri" for a non-participating royalty root. Rejects lease nodes — use attachLease instead. Pass `deskMapId` to land the node in a specific tract (get ids from listDeskMaps); omit to use the active desk map. Pass `linkedOwnerId` to link to an existing owner record (from listOwners or createOwner) so later attachLease calls work.',
    inputSchema: z.object({
      kind: z.enum(['mineral', 'npri']).default('mineral'),
      initialFraction: z
        .string()
        .min(1)
        .describe('Starting fraction as a decimal (e.g. "0.125") or quotient string.'),
      royaltyKind: z
        .enum(['fixed', 'floating'])
        .optional()
        .describe('Only used when kind="npri". Defaults to "fixed".'),
      fixedRoyaltyBasis: z
        .enum(['burdened_branch', 'whole_tract'])
        .optional()
        .describe('For a fixed NPRI: whose share the fraction is taken of.'),
      deskMapId: z
        .string()
        .optional()
        .describe('Target tract (desk map) id. Omit to use the active desk map.'),
      linkedOwnerId: z
        .string()
        .optional()
        .describe('Owner-record id to link this node to. Required if you later want to attach a lease to this person.'),
      form: nodeFormSchema.optional(),
    }),
    execute: async ({ kind, initialFraction, royaltyKind, fixedRoyaltyBasis, deskMapId, linkedOwnerId, form }) => {
      const id = newNodeId('node');
      const store = useWorkspaceStore.getState();
      const okFlag = store.createRootNode(
        id,
        initialFraction,
        {
          ...formToPartialNode(form),
          interestClass: kind,
          royaltyKind: kind === 'npri' ? royaltyKind ?? 'fixed' : null,
          fixedRoyaltyBasis:
            kind === 'npri' && (royaltyKind ?? 'fixed') === 'fixed'
              ? fixedRoyaltyBasis ?? 'burdened_branch'
              : null,
          linkedOwnerId: linkedOwnerId ?? null,
        },
        deskMapId
      );
      if (!okFlag) {
        return {
          ok: false,
          error: useWorkspaceStore.getState().lastError,
          validation: summariseValidation(),
        };
      }
      return { ok: true, nodeId: id, validation: summariseValidation() };
    },
  }),

  convey: tool({
    description:
      'Convey a share from an existing mineral or NPRI node to a new child of the same interest class. Use for deeds that transfer a fraction forward in the chain of title. `share` is the fraction the child receives. Interest class follows the parent; to split off an NPRI, use createNpri instead.',
    inputSchema: z.object({
      parentNodeId: z.string().min(1),
      share: z.string().min(1).describe('Fraction the child receives (e.g. "0.25", "1/8").'),
      form: nodeFormSchema.optional(),
    }),
    execute: async ({ parentNodeId, share, form }) => {
      const id = newNodeId('node');
      const okFlag = useWorkspaceStore.getState().convey(
        parentNodeId,
        id,
        share,
        formToPartialNode(form)
      );
      if (!okFlag) {
        return {
          ok: false,
          error: useWorkspaceStore.getState().lastError,
          validation: summariseValidation(),
        };
      }
      return { ok: true, nodeId: id, validation: summariseValidation() };
    },
  }),

  createNpri: tool({
    description:
      'Create a non-participating royalty interest (NPRI) branch off a mineral node. Always ask the user whether the NPRI is fixed or floating if unclear — the distinction is a core title rule. A fixed NPRI needs a basis: "burdened_branch" (default) vs "whole_tract".',
    inputSchema: z.object({
      parentNodeId: z.string().min(1).describe('The mineral node being burdened.'),
      share: z.string().min(1),
      royaltyKind: z.enum(['fixed', 'floating']).default('fixed'),
      fixedRoyaltyBasis: z
        .enum(['burdened_branch', 'whole_tract'])
        .optional(),
      form: nodeFormSchema.optional(),
    }),
    execute: async ({ parentNodeId, share, royaltyKind, fixedRoyaltyBasis, form }) => {
      const id = newNodeId('node');
      const okFlag = useWorkspaceStore.getState().createNpri(parentNodeId, id, share, {
        ...formToPartialNode(form),
        royaltyKind,
        fixedRoyaltyBasis:
          royaltyKind === 'fixed' ? fixedRoyaltyBasis ?? 'burdened_branch' : null,
      });
      if (!okFlag) {
        return {
          ok: false,
          error: useWorkspaceStore.getState().lastError,
          validation: summariseValidation(),
        };
      }
      return { ok: true, nodeId: id, validation: summariseValidation() };
    },
  }),

  precede: tool({
    description:
      'Insert a predecessor (parent) above an existing node — used when an earlier deed is discovered that should sit above the current branch. `newInitialFraction` becomes the predecessor\'s share; the existing node is scaled to fit underneath it.',
    inputSchema: z.object({
      nodeId: z.string().min(1).describe('The existing node that will become the child of the new predecessor.'),
      newInitialFraction: z.string().min(1),
      form: nodeFormSchema.optional(),
    }),
    execute: async ({ nodeId, newInitialFraction, form }) => {
      const predId = newNodeId('node');
      const okFlag = useWorkspaceStore.getState().insertPredecessor(
        nodeId,
        predId,
        newInitialFraction,
        formToPartialNode(form)
      );
      if (!okFlag) {
        return {
          ok: false,
          error: useWorkspaceStore.getState().lastError,
          validation: summariseValidation(),
        };
      }
      return { ok: true, newPredecessorId: predId, validation: summariseValidation() };
    },
  }),

  graftToParent: tool({
    description:
      'Batch-attach one or more orphan tree roots to a common parent — the workhorse move once the common grantor is found. Each orphan keeps its current initialFraction at the new destination unless calcShares overrides. Partial success is returned; individual failures do not abort the batch. All orphans must share the parent\'s interest class (mineral↔mineral, NPRI↔NPRI).',
    inputSchema: z.object({
      parentNodeId: z.string().min(1),
      orphanNodeIds: z.array(z.string().min(1)).min(1).max(100),
      calcShares: z
        .array(z.string())
        .optional()
        .describe("Optional per-orphan override fractions, same length/order as orphanNodeIds. Omit to use each orphan's current initialFraction."),
    }),
    execute: async ({ parentNodeId, orphanNodeIds, calcShares }) => {
      if (calcShares && calcShares.length !== orphanNodeIds.length) {
        return {
          ok: false,
          error: 'calcShares length must match orphanNodeIds length',
          attached: [],
          failed: [],
          validation: summariseValidation(),
        };
      }
      const attached: string[] = [];
      const failed: Array<{ nodeId: string; reason: string }> = [];
      for (let i = 0; i < orphanNodeIds.length; i += 1) {
        const orphanId = orphanNodeIds[i];
        const { nodes } = useWorkspaceStore.getState();
        const orphan = nodes.find((n) => n.id === orphanId);
        if (!orphan) {
          failed.push({ nodeId: orphanId, reason: 'Node not found' });
          continue;
        }
        const share = calcShares?.[i] ?? orphan.initialFraction;
        const okFlag = useWorkspaceStore.getState().attachConveyance(
          orphanId,
          parentNodeId,
          share,
          {}
        );
        if (okFlag) {
          attached.push(orphanId);
        } else {
          failed.push({
            nodeId: orphanId,
            reason: useWorkspaceStore.getState().lastError ?? 'Unknown error',
          });
        }
      }
      const summary =
        failed.length === 0
          ? `Attached all ${attached.length} orphan(s) to ${parentNodeId}.`
          : `Attached ${attached.length} of ${orphanNodeIds.length}. Failed: ${failed
              .map((f) => `${f.nodeId} (${f.reason})`)
              .join('; ')}.`;
      return {
        ok: failed.length === 0,
        partialSuccess: attached.length > 0 && failed.length > 0,
        attached,
        failed,
        summary,
        validation: summariseValidation(),
      };
    },
  }),

  previewDeleteNode: tool({
    description:
      'Read-only: count what would be removed if you deleted this node. Returns descendant count, total nodes that would be removed, and curative issues that would be detached. ALWAYS call this before deleteNode when the target has any children, so you can tell the user what they are about to lose before you ask them to confirm.',
    inputSchema: z.object({
      nodeId: z.string().min(1),
    }),
    execute: async ({ nodeId }) => {
      const { nodes } = useWorkspaceStore.getState();
      const target = nodes.find((n) => n.id === nodeId);
      if (!target) return { error: `No node with id ${nodeId}` };
      const descendantIds = new Set<string>();
      const queue = [nodeId];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const n of nodes) {
          if (n.parentId === cur && !descendantIds.has(n.id)) {
            descendantIds.add(n.id);
            queue.push(n.id);
          }
        }
      }
      const allRemovedIds = new Set([nodeId, ...descendantIds]);
      const titleIssues = useCurativeStore.getState().titleIssues;
      const affectedTitleIssueCount = titleIssues.filter(
        (ti) => ti.affectedNodeId && allRemovedIds.has(ti.affectedNodeId)
      ).length;
      return {
        targetId: nodeId,
        targetGrantee: target.grantee,
        targetInterestClass: target.interestClass,
        descendantCount: descendantIds.size,
        totalNodesRemoved: allRemovedIds.size,
        affectedTitleIssueCount,
        requiresConfirmCascade: descendantIds.size > 0,
      };
    },
  }),

  deleteNode: tool({
    description:
      'Delete a node and every descendant beneath it. The parent\'s remaining fraction is restored by the deleted branch\'s initialFraction. Cascades into curative (linked title issues), map (linked assets/regions), and owner-store (linked leases) — all cleared. If the target has any descendants, you MUST first call previewDeleteNode, report the totals to the user, and pass `confirmCascade: true` here. Without that flag, cascading deletes are refused.',
    inputSchema: z.object({
      nodeId: z.string().min(1),
      confirmCascade: z
        .boolean()
        .optional()
        .describe('Required to be true when the node has descendants. Set only after the user has seen a previewDeleteNode report and approved it.'),
    }),
    execute: async ({ nodeId, confirmCascade }) => {
      const state = useWorkspaceStore.getState();
      const target = state.nodes.find((n) => n.id === nodeId);
      if (!target) {
        return {
          ok: false,
          error: `No node with id ${nodeId}`,
          validation: summariseValidation(),
        };
      }
      // Blast-radius guard — refuse cascading deletes the AI hasn't confirmed.
      const descendantIds = new Set<string>();
      const queue = [nodeId];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const n of state.nodes) {
          if (n.parentId === cur && !descendantIds.has(n.id)) {
            descendantIds.add(n.id);
            queue.push(n.id);
          }
        }
      }
      if (descendantIds.size > 0 && !confirmCascade) {
        return {
          ok: false,
          error:
            `Refusing cascading delete — this node has ${descendantIds.size} descendant(s). Call previewDeleteNode, report the totals to the user, then call deleteNode again with confirmCascade: true.`,
          descendantCount: descendantIds.size,
          validation: summariseValidation(),
        };
      }
      const before = state.nodes.length;
      useWorkspaceStore.getState().removeNode(nodeId);
      const after = useWorkspaceStore.getState().nodes.length;
      const err = useWorkspaceStore.getState().lastError;
      if (after === before) {
        return {
          ok: false,
          error: err ?? 'Delete did not remove any nodes',
          validation: summariseValidation(),
        };
      }
      return {
        ok: true,
        removedCount: before - after,
        validation: summariseValidation(),
      };
    },
  }),

  createLease: tool({
    description:
      'Create a new Lease record linked to an existing Owner (lessor). Returns the new leaseId, which can then be passed to attachLease. Does NOT automatically attach to a mineral node — call attachLease separately once you know which mineral node represents this lessor in the tract. Use this during a guided import when the workbook has lease-level data (lessee, royalty rate, effective date) and no matching record exists in getLessorRoster.',
    inputSchema: z.object({
      ownerId: z.string().min(1).describe('Owner-record id of the lessor. Get from listOwners or createOwner.'),
      leaseName: z.string().optional(),
      lessee: z.string().optional(),
      royaltyRate: z.string().optional().describe('e.g. "1/8", "0.20". Store the exact string from the instrument.'),
      leasedInterest: z.string().optional(),
      effectiveDate: z.string().optional(),
      expirationDate: z.string().optional(),
      status: z.string().optional().describe('e.g. "Active", "Expired", "HBP".'),
      docNo: z.string().optional(),
      notes: z.string().optional(),
      jurisdiction: z
        .enum(['tx_fee', 'tx_state'])
        .optional()
        .describe('Active Desk Map/Leasehold math is Texas-only. Use "tx_fee" (default) or "tx_state"; keep federal/private records in Research/Federal Leasing.'),
    }),
    execute: async ({ ownerId, ...rest }) => {
      const workspaceId = useWorkspaceStore.getState().workspaceId;
      if (!workspaceId) {
        return { ok: false, error: 'No active workspace.' };
      }
      const owner = useOwnerStore.getState().owners.find((o) => o.id === ownerId);
      if (!owner) {
        return { ok: false, error: `Owner ${ownerId} not found. Use listOwners or createOwner first.` };
      }
      if (typeof rest.royaltyRate === 'string' && parseStrictInterestString(rest.royaltyRate) === null) {
        return {
          ok: false,
          error: 'Royalty rate must be a fraction (e.g. 1/8), a decimal (e.g. 0.125), or blank.',
        };
      }
      if (typeof rest.leasedInterest === 'string' && parseStrictInterestString(rest.leasedInterest) === null) {
        return {
          ok: false,
          error: 'Leased interest must be a fraction (e.g. 1/2), a decimal (e.g. 0.5), or blank.',
        };
      }
      if (rest.jurisdiction && !isTexasMathLeaseJurisdiction(rest.jurisdiction)) {
        return {
          ok: false,
          error:
            'Only Texas fee/state leases can be created from the active Desk Map AI tools. Keep federal/private/tribal leases in Research or Federal Leasing as reference records.',
        };
      }
      const overrides: Record<string, string> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (typeof v === 'string' && v.trim()) overrides[k] = v.trim();
      }
      const lease = createBlankLease(workspaceId, ownerId, overrides);
      try {
        await useOwnerStore.getState().addLease(lease);
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
      return { ok: true, leaseId: lease.id, ownerName: owner.name };
    },
  }),

  createDeskMap: tool({
    description:
      'Create a new desk map (tract) in the workspace. Returns the new deskMapId. The newly created desk map is automatically set active. Use this when the user describes a new tract that does not appear in listDeskMaps, or during a guided import before creating nodes for a tract that the wizard did not materialize.',
    inputSchema: z.object({
      name: z.string().min(1).describe('Human-readable tract name, e.g. "Section 12 Abstract 420".'),
      code: z.string().min(1).describe('Short code shown on desk-map tabs, e.g. "§12" or "T-1".'),
      grossAcres: z.string().optional(),
      pooledAcres: z.string().optional(),
      description: z.string().optional(),
      unitName: z.string().optional(),
      unitCode: z.string().optional(),
    }),
    execute: async ({ name, code, grossAcres, pooledAcres, description, unitName, unitCode }) => {
      const store = useWorkspaceStore.getState();
      const existing = store.deskMaps.find(
        (dm) => dm.code.trim().toLowerCase() === code.trim().toLowerCase()
      );
      if (existing) {
        return {
          ok: false,
          error: `Desk map with code "${code}" already exists (id: ${existing.id}).`,
          existingDeskMapId: existing.id,
        };
      }
      const id = store.createDeskMap(name.trim(), code.trim(), [], {
        ...(unitName ? { unitName: unitName.trim() } : {}),
        ...(unitCode ? { unitCode: unitCode.trim() } : {}),
      });
      if (grossAcres || pooledAcres || description) {
        store.updateDeskMapDetails(id, {
          ...(grossAcres ? { grossAcres: grossAcres.trim() } : {}),
          ...(pooledAcres ? { pooledAcres: pooledAcres.trim() } : {}),
          ...(description ? { description: description.trim() } : {}),
        });
      }
      return { ok: true, deskMapId: id, name, code };
    },
  }),

  createOwner: tool({
    description:
      'Create a new Owner record (a mineral/royalty lessor — a real person or entity). Returns the new ownerId, which can then be passed to createRootNode as `linkedOwnerId` so the node is attached to the owner. Use this during a guided import whenever you encounter a new name that does not appear in listOwners. Keep entityType, county, and prospect empty if the workbook does not provide them — the user can fill those in later.',
    inputSchema: z.object({
      name: z.string().min(1),
      entityType: z
        .string()
        .optional()
        .describe('e.g. "Individual", "Trust", "LLC". Defaults to "Individual" if omitted.'),
      county: z.string().optional(),
      prospect: z.string().optional(),
      mailingAddress: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
    }),
    execute: async ({ name, entityType, county, prospect, mailingAddress, email, phone, notes }) => {
      const workspaceId = useWorkspaceStore.getState().workspaceId;
      if (!workspaceId) {
        return { ok: false, error: 'No active workspace.' };
      }
      const owner = createBlankOwner(workspaceId, {
        name: name.trim(),
        entityType: entityType?.trim() || 'Individual',
        county: county?.trim() ?? '',
        prospect: prospect?.trim() ?? '',
        mailingAddress: mailingAddress?.trim() ?? '',
        email: email?.trim() ?? '',
        phone: phone?.trim() ?? '',
        notes: notes?.trim() ?? '',
      });
      try {
        await useOwnerStore.getState().addOwner(owner);
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
      return { ok: true, ownerId: owner.id, name: owner.name };
    },
  }),

  setActiveDeskMap: tool({
    description:
      'Switch the active desk map (tract). Use when walking an import that spans multiple tracts — before creating nodes for tract T2, switch to T2 so subsequent createRootNode calls without an explicit deskMapId land there. Get ids from listDeskMaps.',
    inputSchema: z.object({
      deskMapId: z.string().min(1),
    }),
    execute: async ({ deskMapId }) => {
      const state = useWorkspaceStore.getState();
      const target = state.deskMaps.find((dm) => dm.id === deskMapId);
      if (!target) {
        return { ok: false, error: `No desk map with id ${deskMapId}` };
      }
      state.setActiveDeskMap(deskMapId);
      return { ok: true, deskMapId, name: target.name, code: target.code };
    },
  }),

  attachLease: tool({
    description:
      'Attach an existing lease record as a lease-node under a mineral ownership node. Leases can ONLY attach to mineral nodes — never NPRI — and the owner of the lease should normally be the owner linked to (or represented by) that mineral node. Use listOwners + getLessorRoster to find the right leaseId. Does not create a lease record; use the UI for that.',
    inputSchema: z.object({
      mineralNodeId: z.string().min(1),
      leaseId: z.string().min(1),
    }),
    execute: async ({ mineralNodeId, leaseId }) => {
      const lease = useOwnerStore.getState().leases.find((l) => l.id === leaseId);
      if (!lease) {
        return {
          ok: false,
          error: `Lease ${leaseId} not found. Use getLessorRoster to list leases.`,
          validation: summariseValidation(),
        };
      }
      const leaseNodeId = useWorkspaceStore
        .getState()
        .attachLease(mineralNodeId, lease);
      if (!leaseNodeId) {
        return {
          ok: false,
          error: useWorkspaceStore.getState().lastError,
          validation: summariseValidation(),
        };
      }
      return { ok: true, leaseNodeId, validation: summariseValidation() };
    },
  }),
};

/**
 * Names of tools that mutate workspace state. Consumed by `runChat.ts` to
 * decide whether to commit the pre-turn snapshot for undo.
 */
export const MUTATING_TOOL_NAMES: ReadonlySet<string> = new Set([
  'createRootNode',
  'convey',
  'createNpri',
  'precede',
  'graftToParent',
  'deleteNode',
  'attachLease',
  'createOwner',
  'createLease',
  'createDeskMap',
  // setActiveDeskMap intentionally excluded — changing focus is not a
  // workspace-data mutation and should not burn the undo slot on its own.
  // previewDeleteNode intentionally excluded — read-only.
]);
