/**
 * Desk Map tab bar — switch between tracts, create/rename/delete desk maps.
 *
 * When desk maps carry `unitCode` / `unitName` (Phase 4a), the tab bar groups
 * them under bold section headers. Tracts without a `unitCode` render under an
 * "Unassigned" header for backward compatibility with pre-overhaul workspaces.
 *
 * Double-click a tab to rename. Click × to delete.
 * Deleting the last desk map is allowed — auto-create will make a fresh one.
 */
import { useMemo, useState } from 'react';
import { useWorkspaceStore } from '../../store/workspace-store';
import type { DeskMap, DeskMapUnitCode } from '../../types/node';

/** Tracts that belong to error-scenario flavors show a small dot indicator. */
function hasWarning(dm: DeskMap): boolean {
  // C3 (NPRI discrepancy), C7 (over-conveyance), C9 (orphan node) each carry
  // a recognizable substring in their description so we can show the dot
  // without importing the full validation engine into the tab bar.
  return (
    /NPRI.discrepancy|over-conveyance|orphan/i.test(dm.description)
  );
}

interface UnitGroup {
  unitCode: DeskMapUnitCode | null;
  unitName: string;
  deskMaps: DeskMap[];
}

export default function DeskMapTabs() {
  const deskMaps = useWorkspaceStore((s) => s.deskMaps);
  const activeDeskMapId = useWorkspaceStore((s) => s.activeDeskMapId);
  const createDeskMap = useWorkspaceStore((s) => s.createDeskMap);
  const setActiveDeskMap = useWorkspaceStore((s) => s.setActiveDeskMap);
  const renameDeskMap = useWorkspaceStore((s) => s.renameDeskMap);
  const deleteDeskMap = useWorkspaceStore((s) => s.deleteDeskMap);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

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

  const handleCreate = () => {
    const num = deskMaps.length + 1;
    createDeskMap(`Tract ${num}`, `T${num}`);
  };

  const handleStartRename = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleFinishRename = () => {
    if (editingId && editName.trim()) {
      renameDeskMap(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this desk map? Nodes will remain in the workspace.')) {
      deleteDeskMap(id);
    }
  };

  if (deskMaps.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-parchment border-b border-ledger-line overflow-x-auto">
      {groups.map((group) => (
        <div key={group.unitCode ?? '_unassigned'} className="flex items-center gap-2">
          {/* Section header — only shown when unit grouping is present */}
          {hasMultipleGroups && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink/50 whitespace-nowrap mr-1">
              {group.unitName}
            </span>
          )}

          {group.deskMaps.map((dm) => (
            <div
              key={dm.id}
              onClick={() => setActiveDeskMap(dm.id)}
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
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleFinishRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-36 px-2 py-1 rounded-lg text-sm bg-parchment text-ink border border-ledger-line outline-none"
                />
              ) : (
                <span onDoubleClick={() => handleStartRename(dm.id, dm.name)}>
                  {dm.name}
                </span>
              )}
              {/* Error-dot indicator for tracts with active validation warnings */}
              {hasWarning(dm) && (
                <span
                  className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                    activeDeskMapId === dm.id ? 'bg-seal/80' : 'bg-seal'
                  }`}
                  title="This tract has an active validation warning"
                />
              )}
              {activeDeskMapId === dm.id && editingId !== dm.id && (
                <button
                  onClick={(e) => handleDelete(dm.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-parchment/60 hover:text-parchment text-xs transition-opacity"
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
        onClick={handleCreate}
        className="px-5 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap text-leather hover:bg-leather/10 border border-dashed border-leather/40 transition-colors"
        title="Add new desk map"
      >
        + Add Tract
      </button>
    </div>
  );
}
