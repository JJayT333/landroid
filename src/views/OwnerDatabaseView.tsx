import { useCallback, useEffect, useMemo, useState } from 'react';
import OwnerDetailPanel from '../components/owners/OwnerDetailPanel';
import { getOwnerLeaseDeskMapTargets } from '../components/owners/owner-lease-deskmap';
import {
  countActiveLeaseInstruments,
  groupLeasesByInstrument,
} from '../components/owners/owner-lease-grouping';
import Button from '../components/shared/Button';
import Pill from '../components/shared/Pill';
import UndoRedoControls from '../components/shell/UndoRedoControls';
import UnitFocusSelector from '../components/shared/UnitFocusSelector';
import { useOwnerStore } from '../store/owner-store';
import { useUIStore } from '../store/ui-store';
import { useWorkspaceStore } from '../store/workspace-store';
import {
  READ_ONLY_WORKSPACE_EDIT_TITLE,
  useWorkspaceReadOnly,
} from '../store/write-lease-store';
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

type OwnerLeaseChip = 'all' | 'leased' | 'unleased';

/** Avatar initials for the CRM record list (display only). */
export function ownerInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
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
    // Count distinct lease INSTRUMENTS, not per-tract records, so the list-rail
    // badge matches the collapsed cards in the detail panel.
    const activeLeaseCount = countActiveLeaseInstruments(
      ownerLeases,
      isInactiveLeaseStatus
    );

    return {
      owner,
      leaseCount: groupLeasesByInstrument(ownerLeases).length,
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
  const readOnly = useWorkspaceReadOnly();
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
  const [leaseChip, setLeaseChip] = useState<OwnerLeaseChip>('all');

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
  const visibleOwnerRows = useMemo(() => {
    const sortedRows = sortAndFilterOwnerListRows(ownerRows, ownerSearchQuery, ownerSortMode);
    if (leaseChip === 'leased') {
      return sortedRows.filter((row) => row.activeLeaseCount > 0);
    }
    if (leaseChip === 'unleased') {
      return sortedRows.filter((row) => row.activeLeaseCount === 0);
    }
    return sortedRows;
  }, [leaseChip, ownerRows, ownerSearchQuery, ownerSortMode]);
  const leasedCount = useMemo(
    () => ownerRows.filter((row) => row.activeLeaseCount > 0).length,
    [ownerRows]
  );
  const tractCountByOwnerId = useMemo(() => {
    const ownerByNodeId = new Map<string, string>();
    for (const node of nodes) {
      if (node.linkedOwnerId) ownerByNodeId.set(node.id, node.linkedOwnerId);
    }
    const next = new Map<string, Set<string>>();
    for (const deskMap of focusedDeskMaps) {
      for (const nodeId of deskMap.nodeIds) {
        const ownerId = ownerByNodeId.get(nodeId);
        if (!ownerId) continue;
        const set = next.get(ownerId) ?? new Set<string>();
        set.add(deskMap.id);
        next.set(ownerId, set);
      }
    }
    return next;
  }, [focusedDeskMaps, nodes]);
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
      if (!readOnly) {
        setPendingNodeEditorRoute({
          kind: 'lease',
          parentNodeId: target.parentNodeId,
          leaseId,
        });
      }
      setView('chart');
    },
    [readOnly, setActiveDeskMap, setActiveNode, setPendingNodeEditorRoute, setView]
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-parchment text-ink">
      {/* Command header */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ledger-line bg-parchment-light px-5 py-3">
        <div className="min-w-0">
          <h1 className="font-display text-[19px] font-bold leading-tight text-ink">Owners</h1>
          <div className="mt-px truncate text-[11px] text-ink-light">
            {activeUnit ? `${activeUnit.unitName}` : 'All units'} ·{' '}
            <span className="font-mono text-[10.5px]">
              {unitOwners.length} records · {leasedCount} leased
            </span>
          </div>
        </div>
        <div className="ml-3 hidden md:block">
          <UnitFocusSelector />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <UndoRedoControls variant="secondary" />
          <Button
            size="sm"
            disabled={readOnly || !workspaceId}
            title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
            onClick={async () => {
              if (readOnly || !workspaceId) return;
              await addOwner(
                createBlankOwner(workspaceId, {
                  name: 'New Owner',
                  prospect: activeUnit?.unitName ?? '',
                })
              );
            }}
          >
            + New Owner
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Record list */}
        <aside className="flex w-[296px] shrink-0 flex-col border-r border-ledger-line bg-parchment-light">
          <div className="px-3 pt-3">
            <label className="block">
              <span className="sr-only">Search owners</span>
              <input
                value={ownerSearchQuery}
                onChange={(event) => setOwnerSearchQuery(event.target.value)}
                placeholder="Owner, county, lease…"
                className="w-full rounded-lg border border-ledger-line bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-leather"
              />
            </label>
            <div className="scrollbar-hidden mt-2 flex gap-1.5 overflow-x-auto">
              {([
                { id: 'all', label: 'All' },
                { id: 'leased', label: 'Leased' },
                { id: 'unleased', label: 'Unleased' },
              ] as const).map((chip) => (
                <Pill
                  key={chip.id}
                  size="sm"
                  active={leaseChip === chip.id}
                  onClick={() => setLeaseChip(chip.id)}
                >
                  {chip.label}
                </Pill>
              ))}
            </div>
            <div className="mx-0.5 mb-1.5 mt-2 flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] text-ink-light">
                Sort:
                <select
                  value={ownerSortMode}
                  onChange={(event) => setOwnerSortMode(event.target.value as OwnerListSortMode)}
                  className="rounded border-none bg-transparent text-[10px] font-semibold text-ink outline-none"
                >
                  {OWNER_LIST_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ml-auto font-mono text-[9.5px] text-ink-faint">
                {visibleOwnerRows.length} of {unitOwners.length} shown
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#f1eada] px-2 pb-2.5">
            {unitOwners.length === 0 ? (
              <div className="px-2 py-6 text-sm text-ink-light">
                No owner records are linked to this unit yet. Create one here or link one from a desk map node.
              </div>
            ) : visibleOwnerRows.length === 0 ? (
              <div className="px-2 py-6 text-sm text-ink-light">
                <div className="font-semibold text-ink">No owners match this search.</div>
                <div className="mt-1">
                  Try a different owner name, county, prospect, or lease term.
                </div>
              </div>
            ) : (
              visibleOwnerRows.map(({ owner, leaseCount, activeLeaseCount }) => {
                const selected = selectedOwnerId === owner.id;
                return (
                  <button
                    key={owner.id}
                    type="button"
                    onClick={() => selectOwner(owner.id)}
                    className={`mt-1 flex w-full items-center gap-2 rounded-[9px] px-2 py-2 text-left transition-colors ${
                      selected
                        ? 'bg-[#f7efdf] shadow-[inset_2px_0_0_var(--color-leather)]'
                        : 'hover:bg-parchment'
                    }`}
                  >
                    <span
                      className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                        activeLeaseCount > 0
                          ? 'bg-emerald-100 text-tint-green-ink'
                          : 'bg-parchment-dark text-leather'
                      }`}
                    >
                      {ownerInitials(owner.name || '?')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-ink">
                        {owner.name || 'Unnamed Owner'}
                      </span>
                      <span className="block truncate text-[10px] text-ink-light">
                        {[owner.entityType, owner.county].filter(Boolean).join(' · ')
                          || 'No details yet'}
                      </span>
                    </span>
                    {(activeLeaseCount > 0 || leaseCount > 0) && (
                      <span
                        className={`shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                          activeLeaseCount > 0
                            ? 'bg-[#e4efe1] text-tint-green-ink'
                            : 'bg-[#efebe2] text-ink-light'
                        }`}
                      >
                        {activeLeaseCount > 0 ? `${activeLeaseCount} active` : `${leaseCount}`}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="min-w-[360px] flex-1 overflow-y-auto box-border p-4">
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
            tractCount={tractCountByOwnerId.get(selectedOwner.id)?.size ?? 0}
            unitScoped={Boolean(effectiveUnitCode)}
            readOnly={readOnly}
          />
        ) : unitOwners.length > 0 && visibleOwnerRows.length === 0 ? (
          <div className="h-full rounded-md border border-dashed border-ledger-line bg-parchment flex items-center justify-center">
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
          <div className="h-full rounded-md border border-dashed border-ledger-line bg-parchment flex items-center justify-center">
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
    </div>
  );
}
