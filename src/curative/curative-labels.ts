/**
 * Human-readable labels for the entities a curative issue can reference.
 *
 * Shared by the Curative view and the printable requirement report so a tract /
 * branch / owner / lease always reads the same way in both. Pure: records in →
 * display strings out.
 */
import type { DeskMap, OwnershipNode } from '../types/node';
import type { Lease, Owner } from '../types/owner';

export function describeOwner(owner: Owner | undefined): string {
  return owner?.name || 'Unlinked owner';
}

export function describeLease(lease: Lease | undefined): string {
  if (!lease) {
    return 'Unlinked lease';
  }

  return (
    [lease.leaseName, lease.lessee, lease.docNo].filter(Boolean).join(' • ')
    || 'Unnamed lease'
  );
}

export function describeDeskMap(deskMap: DeskMap | undefined): string {
  if (!deskMap) {
    return 'Unlinked tract';
  }

  return (
    [deskMap.code, deskMap.name].filter(Boolean).join(' • ') || 'Unnamed tract'
  );
}

export function describeNode(node: OwnershipNode | undefined): string {
  if (!node) {
    return 'Unlinked branch';
  }

  const label = node.grantee || node.grantor || node.docNo || node.id;
  const classLabel = node.interestClass === 'npri' ? 'NPRI' : 'Mineral';
  return `${label} (${classLabel})`;
}

/** The id of the desk map that contains `nodeId`, or null. */
export function findDeskMapIdForNode(
  nodeId: string | null,
  deskMaps: DeskMap[]
): string | null {
  if (!nodeId) {
    return null;
  }

  return deskMaps.find((deskMap) => deskMap.nodeIds.includes(nodeId))?.id ?? null;
}
