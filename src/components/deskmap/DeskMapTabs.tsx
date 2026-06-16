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
import { CloseIcon } from '../shell/icons';
import {
  calculateDeskMapCoverageSummary,
  getActiveLeases,
} from '../../title-math';
import { hasDeskMapWarningDot } from './deskmap-warning-dots';
import { countOpenHighRiskCurativeIssuesForDeskMap } from './curative-deskmap-flags';
import { useCurativeStore } from '../../store/curative-store';

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
  const titleIssues = useCurativeStore((s) => s.titleIssues);
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
            curativeIssueCount: countOpenHighRiskCurativeIssuesForDeskMap(
              deskMap,
              titleIssues
            ),
          }),
        ] as const;
      })
    );
  }, [deskMaps, leases, nodes, titleIssues]);

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
      className="scrollbar-hidden flex items-center gap-2 overflow-x-auto border-b border-ledger-line bg-parchment-light px-4 py-[9px]"
    >
      {groups.map((group) => (
        <div
          key={group.unitCode ?? '_unassigned'}
          role="presentation"
          className="flex items-center gap-2"
        >
          {/* Section header — only shown when unit grouping is present */}
          {hasMultipleGroups && (
            <span className="mr-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.1em] text-ink-light">
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
              className={`group flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-[13px] py-[5px] text-xs transition-colors ${
                activeDeskMapId === dm.id
                  ? 'bg-leather font-semibold text-[#fff6ec] shadow-[0_1px_3px_rgba(45,33,20,0.18)]'
                  : 'font-medium text-ink-light hover:bg-parchment-dark hover:text-ink'
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
                  className="w-36 px-2 py-1 rounded-md text-sm bg-parchment text-ink border border-ledger-line outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="inline-flex items-center text-[#fff6ec]/70 opacity-0 transition-opacity hover:text-[#fff6ec] group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <CloseIcon size={12} />
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
        className="whitespace-nowrap rounded-full border border-dashed border-connector px-3 py-1 text-xs font-semibold text-leather transition-colors hover:bg-parchment-dark disabled:cursor-not-allowed disabled:opacity-50"
        title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : 'Add new desk map'}
      >
        + Add
      </button>
    </div>
  );
}
