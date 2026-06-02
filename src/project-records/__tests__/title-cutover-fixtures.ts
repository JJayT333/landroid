/**
 * Shared synthetic fixtures for the Phase 4 title-cutover tests. No PII / no real
 * .landroid data — every node, owner, and lease here is invented.
 */
import { createBlankLease, createBlankOwner, type Lease, type Owner } from '../../types/owner';
import { createBlankNode, normalizeOwnershipNode, type DeskMap, type OwnershipNode } from '../../types/node';
import type { WorkspaceData } from '../../storage/workspace-persistence';
import type { RecordBuildContext } from '../record-helpers';

export const TITLE_NOW = '2026-06-01T12:00:00.000Z';
export const TITLE_WS = 'ws-title-fixture';

export function titleContext(): RecordBuildContext {
  return {
    workspaceId: TITLE_WS,
    projectId: TITLE_WS,
    generatedAt: TITLE_NOW,
    revision: 0,
    source: 'local',
    syncState: 'local_only',
  };
}

export function titleOwnerData(): { owners: Owner[]; leases: Lease[] } {
  return {
    owners: [
      createBlankOwner(TITLE_WS, {
        id: 'owner-1',
        name: 'Acme Minerals LLC',
        entityType: 'Company',
        createdAt: TITLE_NOW,
        updatedAt: TITLE_NOW,
      }),
    ],
    leases: [
      createBlankLease(TITLE_WS, 'owner-1', {
        id: 'lease-1',
        leaseName: 'Acme Lease',
        lessee: 'Operator A',
        royaltyRate: '1/8',
        leasedInterest: '1/2',
        effectiveDate: '2026-01-01',
        jurisdiction: 'tx_fee',
        createdAt: TITLE_NOW,
        updatedAt: TITLE_NOW,
      }),
    ],
  };
}

function node(overrides: Partial<OwnershipNode> & { id: string }): OwnershipNode {
  return normalizeOwnershipNode({ ...createBlankNode(overrides.id), ...overrides });
}

/**
 * A small but math-relevant title tree: a mineral root with a conveyed mineral
 * child, a floating NPRI sibling (exercises royaltyKind), and a lease node
 * (exercises the `leasehold` interest class + linkedLeaseId). The root carries a
 * linkedOwnerId so party resolution and the `linkedOwnerId` math input are both
 * exercised.
 */
export function titleWorkspace(): WorkspaceData {
  const nodes: OwnershipNode[] = [
    node({
      id: 'root',
      grantor: 'State of Texas',
      grantee: 'Acme Minerals LLC',
      instrument: 'Patent',
      docNo: 'P-1',
      fraction: '0.500000000',
      initialFraction: '1.000000000',
      interestClass: 'mineral',
      linkedOwnerId: 'owner-1',
    }),
    node({
      id: 'child',
      parentId: 'root',
      grantee: 'Child Owner',
      instrument: 'Mineral Deed',
      docNo: 'MD-1',
      fraction: '0.500000000',
      initialFraction: '0.500000000',
      interestClass: 'mineral',
    }),
    node({
      id: 'npri',
      parentId: 'root',
      grantee: 'Royalty Holder',
      instrument: 'Royalty Deed',
      docNo: 'RD-1',
      fraction: '0.125000000',
      initialFraction: '0.125000000',
      interestClass: 'npri',
      royaltyKind: 'floating',
    }),
    node({
      id: 'leasenode-1',
      parentId: 'root',
      type: 'related',
      relatedKind: 'lease',
      grantee: 'Operator A',
      instrument: 'Oil & Gas Lease',
      fraction: '0.500000000',
      initialFraction: '0.500000000',
      linkedLeaseId: 'lease-1',
    }),
  ];

  const deskMap: DeskMap = {
    id: 'dm-1',
    name: 'Tract 1',
    code: 'T1',
    tractId: 'tract-1',
    grossAcres: '100',
    pooledAcres: '100',
    description: 'Synthetic tract',
    nodeIds: nodes.map((n) => n.id),
  };

  return {
    workspaceId: TITLE_WS,
    projectName: 'Title Fixture',
    nodes,
    deskMaps: [deskMap],
    leaseholdUnit: {
      name: 'Test Unit',
      description: '',
      operator: 'Operator A',
      effectiveDate: '2026-01-01',
      jurisdiction: 'tx_fee',
    },
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: 'dm-1',
    activeUnitCode: null,
    instrumentTypes: ['Patent', 'Mineral Deed', 'Royalty Deed', 'Oil & Gas Lease'],
  };
}

/** The same workspace with no nodes (the "before" state for a from-empty build). */
export function emptyTitleWorkspace(): WorkspaceData {
  return { ...titleWorkspace(), nodes: [], deskMaps: [{ ...titleWorkspace().deskMaps[0], nodeIds: [] }] };
}
