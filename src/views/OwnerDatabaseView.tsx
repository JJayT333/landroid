import { useCallback, useEffect, useMemo, useState } from 'react';
import OwnerDetailPanel from '../components/owners/OwnerDetailPanel';
import { getOwnerLeaseDeskMapTargets } from '../components/owners/owner-lease-deskmap';
import UnitFocusSelector from '../components/shared/UnitFocusSelector';
import { useOwnerStore } from '../store/owner-store';
import { useUIStore } from '../store/ui-store';
import { useWorkspaceStore } from '../store/workspace-store';
import {
  createBlankOwner,
  isInactiveLeaseStatus,
  type Lease,
  type Owner,
} from '../types/owner';
import {
  filterDeskMapsByUnitCode,
  findUnitOption,
  resolveActiveUnitCode,
} from '../utils/desk-map-units';

type OwnerListSortMode =
  | 'name_asc'
  | 'name_desc'
  | 'county'
  | 'prospect'
  | 'active_leases'
  | 'recent';

interface OwnerListRow {
  owner: Owner;
  leaseCount: number;
  activeLeaseCount: number;
  searchText: string;
}

const OWNER_LIST_SORT_OPTIONS: Array<{ value: OwnerListSortMode; label: string }> = [
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'county', label: 'County' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'active_leases', label: 'Active Leases' },
  { value: 'recent', label: 'Recently Updated' },
];

function normalizeOwnerListText(value: string) {
  return value.trim().toLowerCase();
}

function compareOwnerListText(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function compareOwnerListField(left: string, right: string) {
  const leftValue = normalizeOwnerListText(left);
  const rightValue = normalizeOwnerListText(right);

  if (leftValue.length === 0 && rightValue.length > 0) {
    return 1;
  }
  if (leftValue.length > 0 && rightValue.length === 0) {
    return -1;
  }
  return compareOwnerListText(leftValue, rightValue);
}

export function buildOwnerListRows(owners: Owner[], leases: Lease[]): OwnerListRow[] {
  const leasesByOwnerId = new Map<string, Lease[]>();

  leases.forEach((lease) => {
    const current = leasesByOwnerId.get(lease.ownerId) ?? [];
    current.push(lease);
    leasesByOwnerId.set(lease.ownerId, current);
  });

  return owners.map((owner) => {
    const ownerLeases = leasesByOwnerId.get(owner.id) ?? [];
    const activeLeaseCount = ownerLeases.filter(
      (lease) => !isInactiveLeaseStatus(lease.status)
    ).length;

    return {
      owner,
      leaseCount: ownerLeases.length,
      activeLeaseCount,
      searchText: normalizeOwnerListText(
        [
          owner.name,
          owner.entityType,
          owner.county,
          owner.prospect,
          owner.email,
          owner.phone,
          ...ownerLeases.flatMap((lease) => [
            lease.leaseName,
            lease.lessee,
            lease.docNo,
            lease.status,
          ]),
        ]
          .filter(Boolean)
          .join(' ')
      ),
    };
  });
}

export function sortAndFilterOwnerListRows(
  rows: OwnerListRow[],
  searchQuery: string,
  sortMode: OwnerListSortMode
) {
  const normalizedQuery = normalizeOwnerListText(searchQuery);
  const filteredRows = normalizedQuery.length === 0
    ? rows
    : rows.filter((row) => row.searchText.includes(normalizedQuery));

  return [...filteredRows].sort((left, right) => {
    if (sortMode === 'name_desc') {
      return compareOwnerListText(right.owner.name, left.owner.name);
    }

    if (sortMode === 'county') {
      const countyDiff = compareOwnerListField(left.owner.county, right.owner.county);
      if (countyDiff !== 0) {
        return countyDiff;
      }
      return compareOwnerListText(left.owner.name, right.owner.name);
    }

    if (sortMode === 'prospect') {
      const prospectDiff = compareOwnerListField(left.owner.prospect, right.owner.prospect);
      if (prospectDiff !== 0) {
        return prospectDiff;
      }
      return compareOwnerListText(left.owner.name, right.owner.name);
    }

    if (sortMode === 'active_leases') {
      if (left.activeLeaseCount !== right.activeLeaseCount) {
        return right.activeLeaseCount - left.activeLeaseCount;
      }
      if (left.leaseCount !== right.leaseCount) {
        return right.leaseCount - left.leaseCount;
      }
      return compareOwnerListText(left.owner.name, right.owner.name);
    }

    if (sortMode === 'recent') {
      const updatedDiff = right.owner.updatedAt.localeCompare(left.owner.updatedAt);
      if (updatedDiff !== 0) {
        return updatedDiff;
      }
      return compareOwnerListText(left.owner.name, right.owner.name);
    }

    return compareOwnerListText(left.owner.name, right.owner.name);
  });
}

export default function OwnerDatabaseView() {
  const setView = useUIStore((state) => state.setView);
  const setPendingNodeEditorRoute = useUIStore(
    (state) => state.setPendingNodeEditorRoute
  );
  const workspaceId = useOwnerStore((state) => state.workspaceId);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);
  const contacts = useOwnerStore((state) => state.contacts);
  const docs = useOwnerStore((state) => state.docs);
  const selectedOwnerId = useOwnerStore((state) => state.selectedOwnerId);
  const selectedOwnerTab = useOwnerStore((state) => state.selectedOwnerTab);
  const selectOwner = useOwnerStore((state) => state.selectOwner);
  const selectOwnerTab = useOwnerStore((state) => state.selectOwnerTab);
  const addOwner = useOwnerStore((state) => state.addOwner);
  const updateOwner = useOwnerStore((state) => state.updateOwner);
  const removeOwner = useOwnerStore((state) => state.removeOwner);
  const addLease = useOwnerStore((state) => state.addLease);
  const updateLease = useOwnerStore((state) => state.updateLease);
  const removeLease = useOwnerStore((state) => state.removeLease);
  const addContact = useOwnerStore((state) => state.addContact);
  const updateContact = useOwnerStore((state) => state.updateContact);
  const removeContact = useOwnerStore((state) => state.removeContact);
  const addDoc = useOwnerStore((state) => state.addDoc);
  const updateDoc = useOwnerStore((state) => state.updateDoc);
  const removeDoc = useOwnerStore((state) => state.removeDoc);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const activeDeskMapId = useWorkspaceStore((state) => state.activeDeskMapId);
  const activeUnitCode = useWorkspaceStore((state) => state.activeUnitCode);
  const setActiveDeskMap = useWorkspaceStore((state) => state.setActiveDeskMap);
  const setActiveNode = useWorkspaceStore((state) => state.setActiveNode);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [ownerSortMode, setOwnerSortMode] = useState<OwnerListSortMode>('name_asc');

  const effectiveUnitCode = useMemo(
    () => resolveActiveUnitCode(deskMaps, activeUnitCode, activeDeskMapId),
    [activeDeskMapId, activeUnitCode, deskMaps]
  );
  const activeUnit = useMemo(
    () => findUnitOption(deskMaps, effectiveUnitCode),
    [deskMaps, effectiveUnitCode]
  );
  const focusedDeskMaps = useMemo(
    () => filterDeskMapsByUnitCode(deskMaps, effectiveUnitCode),
    [deskMaps, effectiveUnitCode]
  );
  const focusedOwnerIds = useMemo(() => {
    const focusedNodeIds = new Set(focusedDeskMaps.flatMap((deskMap) => deskMap.nodeIds));
    return new Set(
      nodes.flatMap((node) =>
        focusedNodeIds.has(node.id) && node.linkedOwnerId ? [node.linkedOwnerId] : []
      )
    );
  }, [focusedDeskMaps, nodes]);
  const unitOwners = useMemo(() => {
    if (!effectiveUnitCode) {
      return owners;
    }

    return owners.filter((owner) => {
      const prospect = owner.prospect.trim();
      return (
        focusedOwnerIds.has(owner.id)
        || prospect === activeUnit?.unitName
        || prospect === effectiveUnitCode
      );
    });
  }, [activeUnit?.unitName, effectiveUnitCode, focusedOwnerIds, owners]);
  const unitLeases = useMemo(() => {
    if (!effectiveUnitCode) {
      return leases;
    }

    return leases.filter((lease) => {
      const focusedTargets = getOwnerLeaseDeskMapTargets({
        ownerId: lease.ownerId,
        leaseId: lease.id,
        nodes,
        deskMaps: focusedDeskMaps,
      });
      if (focusedTargets.length > 0) {
        return true;
      }

      const allTargets = getOwnerLeaseDeskMapTargets({
        ownerId: lease.ownerId,
        leaseId: lease.id,
        nodes,
        deskMaps,
      });
      return allTargets.length === 0;
    });
  }, [deskMaps, effectiveUnitCode, focusedDeskMaps, leases, nodes]);
  const ownerRows = useMemo(() => buildOwnerListRows(unitOwners, unitLeases), [unitLeases, unitOwners]);
  const visibleOwnerRows = useMemo(
    () => sortAndFilterOwnerListRows(ownerRows, ownerSearchQuery, ownerSortMode),
    [ownerRows, ownerSearchQuery, ownerSortMode]
  );
  const selectedOwnerVisible = selectedOwnerId
    ? visibleOwnerRows.some((row) => row.owner.id === selectedOwnerId)
    : false;
  const selectedOwner = selectedOwnerVisible
    ? unitOwners.find((owner) => owner.id === selectedOwnerId) ?? null
    : null;
  const selectedOwnerLeases = useMemo(
    () =>
      selectedOwner
        ? unitLeases.filter((lease) => lease.ownerId === selectedOwner.id)
        : [],
    [selectedOwner, unitLeases]
  );
  const deskMapTargetsByLeaseId = useMemo(() => {
    if (!selectedOwner) {
      return new Map();
    }

    return new Map(
      selectedOwnerLeases.map((lease) => [
        lease.id,
        getOwnerLeaseDeskMapTargets({
          ownerId: selectedOwner.id,
          leaseId: lease.id,
          nodes,
          deskMaps: focusedDeskMaps,
        }),
      ])
    );
  }, [focusedDeskMaps, nodes, selectedOwner, selectedOwnerLeases]);

  useEffect(() => {
    if (visibleOwnerRows.length === 0) {
      return;
    }

    if (!selectedOwnerId || !visibleOwnerRows.some((row) => row.owner.id === selectedOwnerId)) {
      selectOwner(visibleOwnerRows[0].owner.id);
    }
  }, [selectOwner, selectedOwnerId, visibleOwnerRows]);

  const handleOpenDeskMapLeaseTarget = useCallback(
    (leaseId: string, target: { deskMapId: string; leaseNodeId: string | null; parentNodeId: string }) => {
      setActiveDeskMap(target.deskMapId);
      setActiveNode(target.leaseNodeId ?? target.parentNodeId);
      setPendingNodeEditorRoute({
        kind: 'lease',
        parentNodeId: target.parentNodeId,
        leaseId,
      });
      setView('chart');
    },
    [setActiveDeskMap, setActiveNode, setPendingNodeEditorRoute, setView]
  );

  return (
    <div className="h-full grid gap-4 p-4 bg-parchment-dark/30 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="min-h-0 rounded-xl border border-ledger-line bg-parchment shadow-sm overflow-hidden flex flex-col">
        <div className="px-4 py-4 border-b border-ledger-line bg-ledger flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-display font-bold text-ink">Owners</div>
            <div className="text-xs text-ink-light">
              {unitOwners.length}/{owners.length} records
            </div>
          </div>
          <button
            type="button"
            disabled={!workspaceId}
            onClick={async () => {
              if (!workspaceId) return;
              await addOwner(
                createBlankOwner(workspaceId, {
                  name: 'New Owner',
                  prospect: activeUnit?.unitName ?? '',
                })
              );
            }}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors disabled:opacity-50"
          >
            + New Owner
          </button>
        </div>

        <div className="border-b border-ledger-line bg-parchment-dark/40 px-4 py-3">
          <UnitFocusSelector />

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
              Search
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                value={ownerSearchQuery}
                onChange={(event) => setOwnerSearchQuery(event.target.value)}
                placeholder="Owner, county, prospect, lease..."
                className="min-w-0 flex-1 rounded-lg border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
              />
              {ownerSearchQuery.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setOwnerSearchQuery('')}
                  className="rounded-lg border border-ledger-line px-3 py-2 text-xs font-semibold text-ink-light transition-colors hover:bg-ledger"
                >
                  Clear
                </button>
              )}
            </div>
          </label>

          <div className="mt-3 flex items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
                Sort By
              </span>
              <select
                value={ownerSortMode}
                onChange={(event) => setOwnerSortMode(event.target.value as OwnerListSortMode)}
                className="mt-1.5 w-full rounded-lg border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
              >
                {OWNER_LIST_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg border border-ledger-line bg-white px-3 py-2 text-xs text-ink-light">
              Showing {visibleOwnerRows.length}/{unitOwners.length}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {unitOwners.length === 0 ? (
            <div className="px-4 py-6 text-sm text-ink-light">
              No owner records are linked to this unit yet. Create one here or link one from a desk map node.
            </div>
          ) : visibleOwnerRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-ink-light">
              <div className="font-semibold text-ink">No owners match this search.</div>
              <div className="mt-1">
                Try a different owner name, county, prospect, or lease term.
              </div>
            </div>
          ) : (
            visibleOwnerRows.map(({ owner, leaseCount, activeLeaseCount }) => (
              <button
                key={owner.id}
                type="button"
                onClick={() => selectOwner(owner.id)}
                className={`w-full text-left px-4 py-3 border-b border-ledger-line transition-colors ${
                  selectedOwnerId === owner.id ? 'bg-leather/10' : 'hover:bg-ledger'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-ink">
                    {owner.name || 'Unnamed Owner'}
                  </div>
                  {(activeLeaseCount > 0 || leaseCount > 0) && (
                    <span className="rounded-full border border-leather/20 bg-leather/10 px-2 py-0.5 text-[10px] font-semibold text-leather">
                      {activeLeaseCount > 0
                        ? `${activeLeaseCount} active`
                        : `${leaseCount} lease${leaseCount === 1 ? '' : 's'}`}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-ink-light">
                  {[owner.entityType, owner.county, owner.prospect]
                    .filter(Boolean)
                    .join(' • ') || 'No details yet'}
                </div>
                <div className="mt-1 text-[11px] text-ink-light">
                  {leaseCount > 0
                    ? `${leaseCount} lease record${leaseCount === 1 ? '' : 's'}${activeLeaseCount > 0 ? ` • ${activeLeaseCount} active` : ''}`
                    : 'No lease records yet'}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="min-w-0">
        {selectedOwner && workspaceId ? (
          <OwnerDetailPanel
            key={selectedOwner.id}
            workspaceId={workspaceId}
            owner={selectedOwner}
            leases={selectedOwnerLeases}
            contacts={contacts.filter((contact) => contact.ownerId === selectedOwner.id)}
            docs={docs.filter((doc) => doc.ownerId === selectedOwner.id)}
            tab={selectedOwnerTab}
            onChangeTab={selectOwnerTab}
            onSaveOwner={(fields) => updateOwner(selectedOwner.id, fields)}
            onDeleteOwner={() => removeOwner(selectedOwner.id)}
            onAddLease={addLease}
            onUpdateLease={updateLease}
            onRemoveLease={removeLease}
            getDeskMapTargetsForLease={(leaseId) =>
              deskMapTargetsByLeaseId.get(leaseId) ?? []
            }
            onOpenDeskMapLeaseTarget={(lease, target) =>
              handleOpenDeskMapLeaseTarget(lease.id, target)
            }
            onAddContact={addContact}
            onUpdateContact={updateContact}
            onRemoveContact={removeContact}
            onAddDoc={addDoc}
            onUpdateDoc={updateDoc}
            onRemoveDoc={removeDoc}
          />
        ) : unitOwners.length > 0 && visibleOwnerRows.length === 0 ? (
          <div className="h-full rounded-xl border border-dashed border-ledger-line bg-parchment flex items-center justify-center">
            <div className="text-center px-6">
              <div className="text-xl font-display font-bold text-ink">
                No owners match the current search
              </div>
              <div className="text-sm text-ink-light mt-2">
                Clear the filter or change the search terms to pick an owner from the list.
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full rounded-xl border border-dashed border-ledger-line bg-parchment flex items-center justify-center">
            <div className="text-center px-6">
              <div className="text-xl font-display font-bold text-ink">
                No owner selected
              </div>
              <div className="text-sm text-ink-light mt-2">
                Choose an owner on the left, or create a new one to begin.
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
