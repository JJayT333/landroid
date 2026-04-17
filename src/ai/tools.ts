/**
 * Read-only tools the AI assistant can invoke.
 *
 * Tools are plain TS wrappers over existing Zustand stores. They return
 * citation-friendly, compact summaries — never raw node graphs. Keep them
 * deterministic: same workspace state must produce the same output.
 */
import { tool } from 'ai';
import { z } from 'zod';
import { useWorkspaceStore } from '../store/workspace-store';
import { useOwnerStore } from '../store/owner-store';
import { useCurativeStore } from '../store/curative-store';
import type { OwnershipNode } from '../types/node';

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
};
