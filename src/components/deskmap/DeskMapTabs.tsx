/**
 * Desk Map tab bar — switch between tracts, create/rename/delete desk maps.
 *
 * When desk maps carry `unitCode` / `unitName`, the tab bar groups them under
 * bold section headers. Tracts without a `unitCode` render under an
 * "Unassigned" header for backward compatibility with pre-overhaul workspaces.
 *
 * Double-click a tab to rename. Click × to delete.
 * Deleting the last desk map is allowed — auto-create will make a fresh one.
 */
import { useEffect, useMemo, useState } from 'react';
import { useOwnerStore } from '../../store/owner-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import {
  READ_ONLY_WORKSPACE_EDIT_TITLE,
  useWorkspaceReadOnly,
} from '../../store/write-lease-store';
import type { DeskMap, DeskMapUnitCode } from '../../types/node';
import type { Lease } from '../../types/owner';
import { useConfirmation } from '../shared/ConfirmationProvider';
import {
  calculateDeskMapCoverageSummary,
  getActiveLeases,
} from './deskmap-coverage';
import { hasDeskMapWarningDot } from './deskmap-warning-dots';

interface UnitGroup {
  unitCode: DeskMapUnitCode | null;
  unitName: string;
  deskMaps: DeskMap[];
}

export default function DeskMapTabs() {
  const readOnly = useWorkspaceReadOnly();
  const nodes = useWorkspaceStore((s) => s.nodes);
  const deskMaps = useWorkspaceStore((s) => s.deskMaps);
  const activeDeskMapId = useWorkspaceStore((s) => s.activeDeskMapId);
  const activeUnitCode = useWorkspaceStore((s) => s.activeUnitCode);
  const createDeskMap = useWorkspaceStore((s) => s.createDeskMap);
  const setActiveDeskMap = useWorkspaceStore((s) => s.setActiveDeskMap);
  const renameDeskMap = useWorkspaceStore((s) => s.renameDeskMap);
  const deleteDeskMap = useWorkspaceStore((s) => s.deleteDeskMap);
  const leases = useOwnerStore((s) => s.leases);
  const { confirm: requestConfirmation } = useConfirmation();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (readOnly) {
      setEditingId(null);
    }
  }, [readOnly]);

  // Group desk maps by unitCode, preserving original order within each group.
  const groups = useMemo<UnitGroup[]>(() => {
    const order: (DeskMapUnitCode | null)[] = [];
    const map = new Map<DeskMapUnitCode | null, { unitName: string; items: DeskMap[] }>();

    for (const dm of deskMaps) {
      const code = dm.unitCode ?? null;
      if (!map.has(code)) {
        order.push(code);
        map.set(code, { unitName: dm.unitName ?? 'Unassigned', items: [] });
      }
      map.get(code)!.items.push(dm);
    }

    return order.map((code) => {
      const { unitName, items } = map.get(code)!;
      return { unitCode: code, unitName, deskMaps: items };
    });
  }, [deskMaps]);

  const hasMultipleGroups = groups.length > 1 || (groups.length === 1 && groups[0].unitCode !== null);
  const warningDotByDeskMapId = useMemo(() => {
    const activeLeasesByOwnerId = new Map<string, Lease[]>();
    for (const lease of getActiveLeases(leases)) {
      const current = activeLeasesByOwnerId.get(lease.ownerId) ?? [];
      current.push(lease);
      activeLeasesByOwnerId.set(lease.ownerId, current);
    }

    return new Map(
      deskMaps.map((deskMap) => {
        const nodeIds = new Set(deskMap.nodeIds);
        const deskMapNodes = nodes.filter((node) => nodeIds.has(node.id));
        const coverageSummary = calculateDeskMapCoverageSummary(
          deskMapNodes,
          activeLeasesByOwnerId,
          nodes
        );
        return [
          deskMap.id,
          hasDeskMapWarningDot({
            deskMap,
            nodes: deskMapNodes,
            coverageSummary,
          }),
        ] as const;
      })
    );
  }, [deskMaps, leases, nodes]);

  const handleCreate = () => {
    if (readOnly) return;
    const activeDeskMap = activeDeskMapId
      ? deskMaps.find((deskMap) => deskMap.id === activeDeskMapId) ?? null
      : null;
    const activeUnit = activeUnitCode
      ? groups.find((group) => group.unitCode === activeUnitCode) ?? null
      : activeDeskMap?.unitCode
        ? groups.find((group) => group.unitCode === activeDeskMap.unitCode) ?? null
        : null;
    const num = activeUnit ? activeUnit.deskMaps.length + 1 : deskMaps.length + 1;
    createDeskMap(`Tract ${num}`, `T${deskMaps.length + 1}`, [], {
      unitName: activeUnit?.unitName,
      unitCode: activeUnit?.unitCode ?? undefined,
    });
  };

  const handleStartRename = (id: string, name: string) => {
    if (readOnly) return;
    setEditingId(id);
    setEditName(name);
  };

  const handleFinishRename = () => {
    if (editingId && editName.trim()) {
      renameDeskMap(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    const confirmed = await requestConfirmation({
      title: 'Delete Desk Map?',
      message: 'Delete this desk map? Nodes will remain in the workspace.',
      confirmLabel: 'Delete Desk Map',
      tone: 'danger',
    });
    if (confirmed) {
      deleteDeskMap(id);
    }
  };

  if (deskMaps.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="Desk maps"
      className="flex items-center gap-3 px-4 py-3 bg-parchment border-b border-ledger-line overflow-x-auto"
    >
      {groups.map((group) => (
        <div
          key={group.unitCode ?? '_unassigned'}
          role="presentation"
          className="flex items-center gap-2"
        >
          {/* Section header — only shown when unit grouping is present */}
          {hasMultipleGroups && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink/50 whitespace-nowrap mr-1">
              {group.unitName}
            </span>
          )}

          {group.deskMaps.map((dm) => (
            <div
              key={dm.id}
              role="tab"
              aria-selected={activeDeskMapId === dm.id}
              tabIndex={activeDeskMapId === dm.id ? 0 : -1}
              onClick={() => setActiveDeskMap(dm.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setActiveDeskMap(dm.id);
                }
              }}
              className={`group flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                activeDeskMapId === dm.id
                  ? 'bg-leather text-parchment'
                  : 'text-ink-light hover:bg-parchment-dark/70'
              }`}
            >
              {editingId === dm.id ? (
                <input
                  autoFocus
                  value={editName}
                  disabled={readOnly}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleFinishRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Rename ${dm.name}`}
                  title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                  className="w-36 px-2 py-1 rounded-lg text-sm bg-parchment text-ink border border-ledger-line outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
              ) : (
                <span
                  onDoubleClick={() => handleStartRename(dm.id, dm.name)}
                  title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                >
                  {dm.name}
                </span>
              )}
              {/* Error-dot indicator for tracts with active validation warnings */}
              {warningDotByDeskMapId.get(dm.id) && (
                <span
                  className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                    activeDeskMapId === dm.id ? 'bg-seal/80' : 'bg-seal'
                  }`}
                  title="This tract has an active validation warning"
                />
              )}
              {activeDeskMapId === dm.id && editingId !== dm.id && (
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={(e) => handleDelete(dm.id, e)}
                  aria-label={`Delete ${dm.name}`}
                  title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                  className="opacity-0 group-hover:opacity-100 text-parchment/60 hover:text-parchment text-xs transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {/* Separator between unit groups */}
          {hasMultipleGroups && group.unitCode !== groups[groups.length - 1]?.unitCode && (
            <div className="w-px h-6 bg-ledger-line/50 mx-1" />
          )}
        </div>
      ))}
      <button
        type="button"
        disabled={readOnly}
        onClick={handleCreate}
        className="px-5 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap text-leather hover:bg-leather/10 border border-dashed border-leather/40 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : 'Add new desk map'}
      >
        + Add Tract
      </button>
    </div>
  );
}
