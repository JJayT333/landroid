/**
 * Read-only banner shown when another tab/window holds the workspace write
 * lease (Phase 0.5 single-writer). The current tab is read-only so its edits
 * cannot overwrite the active writer; the user may explicitly take over.
 */
import { useState } from 'react';
import Notice from './Notice';
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
    <Notice
      frame="banner"
      tone="warn"
      actions={
        <button
          type="button"
          className="shrink-0 rounded-sm border border-tint-amber-ink/40 px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-tint-amber-line/60 disabled:opacity-60"
          onClick={() => void handleTakeover()}
          disabled={takingOver}
        >
          {takingOver ? 'Taking over…' : 'Take over editing here'}
        </button>
      }
    >
      This workspace is open and being edited in another tab or window.
      You&rsquo;re in read-only mode here so your changes don&rsquo;t overwrite
      the other tab.
    </Notice>
  );
}
