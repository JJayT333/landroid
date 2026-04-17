/**
 * Read-only tools the AI assistant can invoke.
 *
 * Tools are plain TS wrappers over existing Zustand stores. They return
 * citation-friendly, compact summaries — never raw node graphs.
 *
 * Keep tools deterministic: same workspace state must produce the same output.
 */
import { tool } from 'ai';
import { z } from 'zod';
import { useWorkspaceStore } from '../store/workspace-store';
import { useOwnerStore } from '../store/owner-store';

function summariseProject() {
  const ws = useWorkspaceStore.getState();
  const owners = useOwnerStore.getState().owners;
  const leases = useOwnerStore.getState().leases;

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
    nodeCount: nodes.filter((n) =>
      (d.nodeIds ?? []).includes(n.id)
    ).length,
  }));
}

export const landroidTools = {
  getProjectSummary: tool({
    description:
      'Return a high-level summary of the current LANDroid workspace: project name, desk-map count, active desk map, node counts by interest class, owner and lease counts. Use this first whenever the user asks about what is in the project.',
    inputSchema: z.object({}),
    execute: async () => summariseProject(),
  }),

  listDeskMaps: tool({
    description:
      'List every desk map (tract) in the current workspace with its code, gross acres, pooled acres, unit name if any, and node count.',
    inputSchema: z.object({}),
    execute: async () => listDeskMaps(),
  }),
};
