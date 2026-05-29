/**
 * Read-only banner shown when another tab/window holds the workspace write
 * lease (Phase 0.5 single-writer). The current tab is read-only so its edits
 * cannot overwrite the active writer; the user may explicitly take over.
 */
import { useState } from 'react';
import { useConfirmation } from './ConfirmationProvider';
import { useWorkspaceStore } from '../../store/workspace-store';
import { isWorkspaceReadOnly, useWriteLeaseStore } from '../../store/write-lease-store';
import { takeoverWorkspaceWrite } from '../../storage/workspace-write-lease';

export default function WriteLeaseBanner() {
  const role = useWriteLeaseStore((s) => s.role);
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const { confirm } = useConfirmation();
  const [takingOver, setTakingOver] = useState(false);

  if (!isWorkspaceReadOnly(role)) return null;

  const handleTakeover = async () => {
    const confirmed = await confirm({
      title: 'Take over editing here?',
      message:
        'This workspace is open in another tab or window. Taking over makes this '
        + 'tab the editor and switches the other one to read-only. Unsaved changes '
        + 'in the other tab will not be saved.',
      confirmLabel: 'Take over editing',
      cancelLabel: 'Stay read-only',
      tone: 'danger',
    });
    if (!confirmed) return;
    setTakingOver(true);
    try {
      await takeoverWorkspaceWrite(workspaceId);
    } finally {
      setTakingOver(false);
    }
  };

  return (
    <div className="border-b border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-900">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
        <p className="leading-6">
          This workspace is open and being edited in another tab or window.
          You&rsquo;re in read-only mode here so your changes don&rsquo;t overwrite
          the other tab.
        </p>
        <button
          type="button"
          className="shrink-0 rounded border border-amber-400 px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-amber-200 disabled:opacity-60"
          onClick={() => void handleTakeover()}
          disabled={takingOver}
        >
          {takingOver ? 'Taking over…' : 'Take over editing here'}
        </button>
      </div>
    </div>
  );
}
