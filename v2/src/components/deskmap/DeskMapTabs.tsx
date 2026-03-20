/**
 * Desk Map tab bar — switch between tracts, create/rename/delete desk maps.
 *
 * Double-click a tab to rename. Click × to delete.
 * Deleting the last desk map is allowed — auto-create will make a fresh one.
 */
import { useState } from 'react';
import { useWorkspaceStore } from '../../store/workspace-store';

export default function DeskMapTabs() {
  const deskMaps = useWorkspaceStore((s) => s.deskMaps);
  const activeDeskMapId = useWorkspaceStore((s) => s.activeDeskMapId);
  const createDeskMap = useWorkspaceStore((s) => s.createDeskMap);
  const setActiveDeskMap = useWorkspaceStore((s) => s.setActiveDeskMap);
  const renameDeskMap = useWorkspaceStore((s) => s.renameDeskMap);
  const deleteDeskMap = useWorkspaceStore((s) => s.deleteDeskMap);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

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
    <div className="flex items-center gap-1 px-3 py-1.5 bg-parchment-dark/50 border-b border-ledger-line overflow-x-auto">
      {deskMaps.map((dm) => (
        <div
          key={dm.id}
          onClick={() => setActiveDeskMap(dm.id)}
          className={`group flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
            activeDeskMapId === dm.id
              ? 'bg-leather text-parchment'
              : 'text-ink-light hover:bg-parchment-dark'
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
              className="w-24 px-1 py-0.5 rounded text-xs bg-parchment text-ink border border-ledger-line outline-none"
            />
          ) : (
            <span onDoubleClick={() => handleStartRename(dm.id, dm.name)}>
              {dm.name}
            </span>
          )}
          {activeDeskMapId === dm.id && editingId !== dm.id && (
            <button
              onClick={(e) => handleDelete(dm.id, e)}
              className="opacity-0 group-hover:opacity-100 text-parchment/60 hover:text-parchment text-[10px] transition-opacity"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        onClick={handleCreate}
        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-dashed border-leather/30 transition-colors"
        title="Add new desk map"
      >
        + Add Tract
      </button>
    </div>
  );
}
