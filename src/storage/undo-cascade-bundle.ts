/**
 * Undo support for destructive title mutations (operator undo button).
 *
 * `removeNode` / `clearDeskMapNodes` delete more than store state: their
 * cascades remove document + attachment rows, owner-side rows (owners,
 * leases, lease purchase reports, contacts, owner docs), and null out the
 * map/curative link fields that referenced the removed nodes, desk map,
 * owners, or leases. This module captures exactly those doomed rows BEFORE
 * the cascades fire (bounded by the removed set — never a workspace-wide
 * export) and can put them back verbatim afterwards: every restore is a
 * `bulkPut` of the raw stored rows, so ids, hashes, blobs, and dbKey scoping
 * are preserved bit-for-bit. Restores run behind the workspace write fence
 * like every other store write.
 *
 * Side-store stores (owner/map/curative) are reloaded from Dexie after a
 * restore via their `setWorkspace` loaders — imported dynamically because the
 * owner store imports the workspace store (same cycle-avoidance the existing
 * owner cleanup uses).
 */
import db from './db';
import { activeStorageScopedId, activeWorkspaceScope } from './db-key-scope';
import {
  readDoomedDocumentRows,
  restoreDocumentRows,
  type DoomedDocumentRows,
} from './document-store';
import {
  assertWorkspaceWriteFence,
  ensureWorkspaceWritable,
} from './workspace-write-lease';
import type { MapAsset, MapRegion } from '../types/map';
import type { OwnershipNode } from '../types/node';
import type { Lease } from '../types/owner';

type ScopedRow<T extends { workspaceId: string }> = T & { dbKey?: string };

/**
 * Which owner and lease records the post-delete owner cleanup will remove for
 * this node removal. Pure; shared by the cleanup itself and the undo capture
 * so the two can never disagree.
 */
export function planOwnerRecordCleanup(
  removedNodes: OwnershipNode[],
  survivingNodes: OwnershipNode[],
  leases: Lease[]
): { ownerIdsToRemove: string[]; leaseIdsToRemove: string[] } {
  const removedOwnerIds = new Set(
    removedNodes
      .map((node) => node.linkedOwnerId)
      .filter((id): id is string => Boolean(id))
  );
  const removedLeaseIds = new Set(
    removedNodes
      .map((node) => node.linkedLeaseId)
      .filter((id): id is string => Boolean(id))
  );
  if (removedOwnerIds.size === 0 && removedLeaseIds.size === 0) {
    return { ownerIdsToRemove: [], leaseIdsToRemove: [] };
  }

  const survivingOwnerIds = new Set(
    survivingNodes
      .map((node) => node.linkedOwnerId)
      .filter((id): id is string => Boolean(id))
  );
  const survivingLeaseIds = new Set(
    survivingNodes
      .map((node) => node.linkedLeaseId)
      .filter((id): id is string => Boolean(id))
  );
  for (const lease of leases) {
    if (survivingLeaseIds.has(lease.id)) {
      survivingOwnerIds.add(lease.ownerId);
    }
  }

  const ownerIdsToRemove = [...removedOwnerIds].filter(
    (ownerId) => !survivingOwnerIds.has(ownerId)
  );
  const ownerIdsToRemoveSet = new Set(ownerIdsToRemove);
  const leaseIdsToRemove = [...removedLeaseIds].filter((leaseId) => {
    if (survivingLeaseIds.has(leaseId)) return false;
    const lease = leases.find((candidate) => candidate.id === leaseId);
    return !lease || !ownerIdsToRemoveSet.has(lease.ownerId);
  });
  return { ownerIdsToRemove, leaseIdsToRemove };
}

async function readOwnerCascadeRows(
  workspaceId: string,
  ownerIds: string[],
  leaseIds: string[]
) {
  const scope = activeWorkspaceScope(workspaceId);
  const ownerScopes = ownerIds.map((ownerId) => [...scope, ownerId]);

  const [owners, ownerLeases, leasePurchaseReports, contactLogs, ownerDocs] =
    await Promise.all([
      db.owners
        .bulkGet(ownerIds.map((id) => activeStorageScopedId(id)))
        .then((rows) => rows.filter((row) => Boolean(row))),
      ownerScopes.length > 0
        ? db.leases.where('[dbKey+workspaceId+ownerId]').anyOf(ownerScopes).toArray()
        : Promise.resolve([]),
      ownerScopes.length > 0
        ? db.leasePurchaseReports
            .where('[dbKey+workspaceId+ownerId]')
            .anyOf(ownerScopes)
            .toArray()
        : Promise.resolve([]),
      ownerScopes.length > 0
        ? db.contactLogs.where('[dbKey+workspaceId+ownerId]').anyOf(ownerScopes).toArray()
        : Promise.resolve([]),
      ownerScopes.length > 0
        ? db.ownerDocs.where('[dbKey+workspaceId+ownerId]').anyOf(ownerScopes).toArray()
        : Promise.resolve([]),
    ]);

  // Leases removed individually (owner survives): the lease row dies and the
  // owner docs that referenced it get their leaseId nulled — capture both.
  const directLeases = (
    await db.leases.bulkGet(leaseIds.map((id) => activeStorageScopedId(id)))
  ).filter((row) => Boolean(row));
  const leaseScopes = leaseIds.map((leaseId) => [...scope, leaseId]);
  const leaseLinkedDocs =
    leaseScopes.length > 0
      ? await db.ownerDocs.where('[dbKey+workspaceId+leaseId]').anyOf(leaseScopes).toArray()
      : [];

  return {
    owners,
    leases: [...ownerLeases, ...directLeases],
    leasePurchaseReports,
    contactLogs,
    ownerDocs: [...ownerDocs, ...leaseLinkedDocs],
  };
}

async function readLinkRows(
  workspaceId: string,
  nodeIds: string[],
  deskMapIds: string[],
  ownerIds: string[],
  leaseIds: string[]
) {
  const scope = activeWorkspaceScope(workspaceId);
  interface LinkQueryTable<Row> {
    where(index: string): {
      anyOf(keys: (string | string[])[]): { toArray(): Promise<Row[]> };
    };
  }
  const byIndex = async <Row extends { id: string }>(
    table: LinkQueryTable<Row>
  ): Promise<Row[]> => {
    const queries = [
      nodeIds.length > 0
        ? table.where('[dbKey+workspaceId+nodeId]').anyOf(nodeIds.map((id) => [...scope, id])).toArray()
        : Promise.resolve([] as Row[]),
      deskMapIds.length > 0
        ? table.where('[dbKey+workspaceId+deskMapId]').anyOf(deskMapIds.map((id) => [...scope, id])).toArray()
        : Promise.resolve([] as Row[]),
      ownerIds.length > 0
        ? table.where('[dbKey+workspaceId+linkedOwnerId]').anyOf(ownerIds.map((id) => [...scope, id])).toArray()
        : Promise.resolve([] as Row[]),
      leaseIds.length > 0
        ? table.where('[dbKey+workspaceId+leaseId]').anyOf(leaseIds.map((id) => [...scope, id])).toArray()
        : Promise.resolve([] as Row[]),
    ];
    const results = (await Promise.all(queries)).flat();
    return [...new Map(results.map((row) => [row.id, row])).values()];
  };

  type MapAssetRow = ScopedRow<MapAsset> & { id: string };
  type MapRegionRow = ScopedRow<MapRegion> & { id: string };
  const [mapAssets, mapRegions, workspaceIssues] = await Promise.all([
    byIndex<MapAssetRow>(db.mapAssets as unknown as LinkQueryTable<MapAssetRow>),
    byIndex<MapRegionRow>(db.mapRegions as unknown as LinkQueryTable<MapRegionRow>),
    db.titleIssues.where('[dbKey+workspaceId]').equals(scope).toArray(),
  ]);
  const nodeIdSet = new Set(nodeIds);
  const deskMapIdSet = new Set(deskMapIds);
  const ownerIdSet = new Set(ownerIds);
  const leaseIdSet = new Set(leaseIds);
  const titleIssues = workspaceIssues.filter(
    (issue) =>
      (issue.affectedNodeId && nodeIdSet.has(issue.affectedNodeId))
      || (issue.affectedDeskMapId && deskMapIdSet.has(issue.affectedDeskMapId))
      || (issue.affectedOwnerId && ownerIdSet.has(issue.affectedOwnerId))
      || (issue.affectedLeaseId && leaseIdSet.has(issue.affectedLeaseId))
  );
  return { mapAssets, mapRegions, titleIssues };
}

export async function captureCascadeBundle(input: {
  workspaceId: string;
  removedNodes: OwnershipNode[];
  survivingNodes: OwnershipNode[];
  leases: Lease[];
  removedDeskMapId?: string;
}) {
  const { ownerIdsToRemove, leaseIdsToRemove } = planOwnerRecordCleanup(
    input.removedNodes,
    input.survivingNodes,
    input.leases
  );
  const removedNodeIds = input.removedNodes.map((node) => node.id);
  const attachmentIds = input.removedNodes.flatMap((node) =>
    node.attachments.map((attachment) => attachment.attachmentId)
  );
  const deskMapIds = input.removedDeskMapId ? [input.removedDeskMapId] : [];

  const [documents, ownerRows, linkRows] = await Promise.all([
    readDoomedDocumentRows(attachmentIds),
    readOwnerCascadeRows(input.workspaceId, ownerIdsToRemove, leaseIdsToRemove),
    readLinkRows(
      input.workspaceId,
      removedNodeIds,
      deskMapIds,
      ownerIdsToRemove,
      leaseIdsToRemove
    ),
  ]);

  return {
    workspaceId: input.workspaceId,
    documents,
    ownerRows,
    linkRows,
  };
}

export type CascadeBundle = Awaited<ReturnType<typeof captureCascadeBundle>>;

function isEmptyBundle(bundle: CascadeBundle): boolean {
  const { documents, ownerRows, linkRows } = bundle;
  return (
    documents.attachments.length === 0
    && documents.documents.length === 0
    && ownerRows.owners.length === 0
    && ownerRows.leases.length === 0
    && ownerRows.leasePurchaseReports.length === 0
    && ownerRows.contactLogs.length === 0
    && ownerRows.ownerDocs.length === 0
    && linkRows.mapAssets.length === 0
    && linkRows.mapRegions.length === 0
    && linkRows.titleIssues.length === 0
  );
}

/**
 * Put the captured rows back (undo of a destructive mutation). Best-effort
 * per section — the title-slice restore has already happened, so a partial
 * failure surfaces as a warning rather than blocking the undo (entry
 * principle: warn, never block). Returns the aggregated warning, if any.
 */
export async function restoreCascadeBundle(
  bundle: CascadeBundle
): Promise<{ warning?: string }> {
  if (isEmptyBundle(bundle)) return {};
  const failures: string[] = [];

  try {
    await restoreDocumentRows(bundle.documents as DoomedDocumentRows);
  } catch (err) {
    failures.push(`documents (${err instanceof Error ? err.message : String(err)})`);
  }

  try {
    const writable = await ensureWorkspaceWritable(bundle.workspaceId);
    if (!writable) {
      throw new Error('workspace is read-only');
    }
    await db.transaction(
      'rw',
      [
        db.workspaceWriteLeases,
        db.owners,
        db.leases,
        db.leasePurchaseReports,
        db.contactLogs,
        db.ownerDocs,
        db.mapAssets,
        db.mapRegions,
        db.titleIssues,
      ],
      async () => {
        await assertWorkspaceWriteFence(bundle.workspaceId);
        const { ownerRows, linkRows } = bundle;
        if (ownerRows.owners.length > 0) {
          await db.owners.bulkPut(ownerRows.owners.filter((row) => row != null));
        }
        if (ownerRows.leases.length > 0) {
          await db.leases.bulkPut(ownerRows.leases.filter((row) => row != null));
        }
        if (ownerRows.leasePurchaseReports.length > 0) {
          await db.leasePurchaseReports.bulkPut(ownerRows.leasePurchaseReports);
        }
        if (ownerRows.contactLogs.length > 0) {
          await db.contactLogs.bulkPut(ownerRows.contactLogs);
        }
        if (ownerRows.ownerDocs.length > 0) {
          await db.ownerDocs.bulkPut(ownerRows.ownerDocs);
        }
        if (linkRows.mapAssets.length > 0) {
          await db.mapAssets.bulkPut(linkRows.mapAssets);
        }
        if (linkRows.mapRegions.length > 0) {
          await db.mapRegions.bulkPut(linkRows.mapRegions);
        }
        if (linkRows.titleIssues.length > 0) {
          await db.titleIssues.bulkPut(linkRows.titleIssues);
        }
      }
    );
  } catch (err) {
    failures.push(
      `owner, map, or curative records (${err instanceof Error ? err.message : String(err)})`
    );
  }

  // Reload the side-store state from the restored rows. Dynamic imports keep
  // this module out of the store import cycle (owner-store imports the
  // workspace store).
  try {
    const [{ useOwnerStore }, { useMapStore }, { useCurativeStore }] =
      await Promise.all([
        import('../store/owner-store'),
        import('../store/map-store'),
        import('../store/curative-store'),
      ]);
    await Promise.all([
      useOwnerStore.getState().setWorkspace(bundle.workspaceId),
      useMapStore.getState().setWorkspace(bundle.workspaceId),
      useCurativeStore.getState().setWorkspace(bundle.workspaceId),
    ]);
  } catch (err) {
    failures.push(
      `side-store refresh (${err instanceof Error ? err.message : String(err)})`
    );
  }

  if (failures.length > 0) {
    return {
      warning:
        'Undo restored the title cards, but some related records could not be '
        + `fully restored: ${failures.join('; ')}. Review Owners, Documents, and `
        + 'Maps before relying on them.',
    };
  }
  return {};
}
