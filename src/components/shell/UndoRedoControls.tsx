/**
 * The always-visible Undo/Redo cluster (locked decision: never buried in the
 * sidebar, never upper-left). Desk Map mounts it in the canvas chrome next to
 * Fit; Leasehold/Documents mount it in their command headers; App floats it
 * over every other view. Glass variant by default so it sits over canvases;
 * headers pass `variant="secondary"`.
 */
import { useState } from 'react';
import Button, { type ButtonVariant } from '../shared/Button';
import {
  useTitleRedoCount,
  useTitleRedoPeekLabel,
  useTitleUndoCount,
  useTitleUndoPeekLabel,
} from '../../store/title-undo-stack';
import { useWorkspaceStore } from '../../store/workspace-store';
import {
  READ_ONLY_WORKSPACE_EDIT_TITLE,
  useWorkspaceReadOnly,
} from '../../store/write-lease-store';
import { RedoIcon, UndoIcon } from './icons';

const IS_MAC =
  typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
const MOD = IS_MAC ? 'Cmd' : 'Ctrl';
const REDO_COMBO = IS_MAC ? 'Cmd+Shift+Z' : 'Ctrl+Y';

export default function UndoRedoControls({
  variant = 'glass',
  showLabels = true,
}: {
  variant?: ButtonVariant;
  showLabels?: boolean;
}) {
  const readOnly = useWorkspaceReadOnly();
  const undoCount = useTitleUndoCount();
  const redoCount = useTitleRedoCount();
  const undoPeek = useTitleUndoPeekLabel();
  const redoPeek = useTitleRedoPeekLabel();
  const [busy, setBusy] = useState(false);

  const canUndo = undoCount > 0 && !readOnly && !busy;
  const canRedo = redoCount > 0 && !readOnly && !busy;

  const run = async (action: 'undo' | 'redo') => {
    setBusy(true);
    try {
      const store = useWorkspaceStore.getState();
      await (action === 'undo'
        ? store.undoLastTitleMutation()
        : store.redoLastTitleMutation());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={variant}
        size="sm"
        disabled={!canUndo}
        onClick={() => void run('undo')}
        aria-label={canUndo ? `Undo ${undoPeek}` : 'Undo (nothing to undo)'}
        title={
          canUndo
            ? `Undo: ${undoPeek} (${MOD}+Z)`
            : readOnly
              ? READ_ONLY_WORKSPACE_EDIT_TITLE
              : 'Nothing to undo'
        }
      >
        <UndoIcon />
        {showLabels && 'Undo'}
      </Button>
      <Button
        variant={variant}
        size="sm"
        disabled={!canRedo}
        onClick={() => void run('redo')}
        aria-label={canRedo ? `Redo ${redoPeek}` : 'Redo (nothing to redo)'}
        title={
          canRedo
            ? `Redo: ${redoPeek} (${REDO_COMBO})`
            : readOnly
              ? READ_ONLY_WORKSPACE_EDIT_TITLE
              : 'Nothing to redo'
        }
      >
        <RedoIcon />
        {showLabels && 'Redo'}
      </Button>
    </div>
  );
}
