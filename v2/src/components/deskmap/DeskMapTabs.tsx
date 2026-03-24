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
    <div className="flex items-center gap-3 px-4 py-3 bg-parchment border-b border-ledger-line overflow-x-auto">
      {deskMaps.map((dm) => (
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
