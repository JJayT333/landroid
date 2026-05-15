/**
 * Shared attachments section — Phase 5 / B3.
 *
 * Drop-in UI primitive for any modal that edits an existing ownership
 * node's `attachments[]`. Renders one row per attachment with:
 *   - inline filename rename (commits on blur / Enter)
 *   - "View PDF" button (calls `onViewDoc(docId)`)
 *   - up / down reorder buttons (last/first row disable the corresponding
 *     direction)
 *   - remove button (cascades to `deleteDoc`)
 * Plus an "Attach PDF" file picker at the bottom.
 *
 * Routed through the workspace-store actions
 * (`attachDocToNode` / `detachDocFromNode` / `renameDocOnNode` /
 * `reorderNodeAttachments`) so the Dexie write and the
 * `node.attachments[]` cache stay in sync.
 *
 * Used by `NodeEditModal`. `AttachLeaseModal` keeps its create-time
 * single-file picker because the lease node doesn't exist until Save —
 * users get the full section when re-editing a saved lease node through
 * `NodeEditModal`.
 */
import { useState } from 'react';
import { useWorkspaceStore } from '../../store/workspace-store';
import { assertFileSize, FILE_SIZE_LIMITS } from '../../utils/file-validation';
import type { NodeAttachmentSummary, OwnershipNode } from '../../types/node';

export interface AttachmentsSectionProps {
  node: Pick<OwnershipNode, 'id' | 'attachments' | 'docNo'>;
  onViewDoc?: (docId: string) => void;
}

export default function AttachmentsSection({
  node,
  onViewDoc,
}: AttachmentsSectionProps) {
  const attachDocToNode = useWorkspaceStore((s) => s.attachDocToNode);
  const detachDocFromNode = useWorkspaceStore((s) => s.detachDocFromNode);
  const renameDocOnNode = useWorkspaceStore((s) => s.renameDocOnNode);
  const reorderNodeAttachments = useWorkspaceStore(
    (s) => s.reorderNodeAttachments
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** Per-attachment in-flight rename input (keyed by attachmentId). */
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});

  async function handleAdd(file: File): Promise<void> {
    setError(null);
    setPending(true);
    try {
      assertFileSize(file, FILE_SIZE_LIMITS.PDF, 'PDF');
      await attachDocToNode(node.id, file);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'PDF attachment failed. Please try again.'
      );
    } finally {
      setPending(false);
    }
  }

  async function handleRename(
    attachment: NodeAttachmentSummary,
    nextName: string
  ): Promise<void> {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === attachment.fileName) {
      // Discard empty / unchanged drafts without a Dexie write.
      setRenameDraft((current) => {
        const next = { ...current };
        delete next[attachment.attachmentId];
        return next;
      });
      return;
    }
    setError(null);
    try {
      await renameDocOnNode(attachment.docId, trimmed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Rename failed. Please try again.'
      );
    } finally {
      setRenameDraft((current) => {
        const next = { ...current };
        delete next[attachment.attachmentId];
        return next;
      });
    }
  }

  async function handleRemove(
    attachment: NodeAttachmentSummary
  ): Promise<void> {
    setError(null);
    try {
      await detachDocFromNode(node.id, attachment.attachmentId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Remove failed. Please try again.'
      );
    }
  }

  async function handleMove(
    attachment: NodeAttachmentSummary,
    delta: -1 | 1
  ): Promise<void> {
    const order = node.attachments.map((a) => a.attachmentId);
    const idx = order.indexOf(attachment.attachmentId);
    const swapIdx = idx + delta;
    if (idx < 0 || swapIdx < 0 || swapIdx >= order.length) return;
    const next = [...order];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setError(null);
    try {
      await reorderNodeAttachments(node.id, next);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Reorder failed. Please try again.'
      );
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-md border border-seal/30 bg-seal/10 px-2 py-1 text-xs text-seal">
          {error}
        </div>
      )}

      {node.attachments.length === 0 ? (
        <div className="rounded-md border border-dashed border-ledger-line px-2 py-2 text-xs text-ink-light">
          No documents attached yet.
        </div>
      ) : (
        <ul className="space-y-1" aria-label="Attached documents">
          {node.attachments.map((attachment, idx) => {
            const draft = renameDraft[attachment.attachmentId];
            const draftValue =
              draft !== undefined ? draft : attachment.fileName;
            const isFirst = idx === 0;
            const isLast = idx === node.attachments.length - 1;
            return (
              <li
                key={attachment.attachmentId}
                className="flex flex-wrap items-center gap-1 rounded-md border border-ledger-line bg-ledger px-2 py-1 text-xs"
              >
                <span className="shrink-0 uppercase tracking-wider text-[9px] text-ink-light">
                  {attachment.kind}
                </span>
                <input
                  type="text"
                  className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-xs text-ink hover:border-ledger-line focus:border-leather focus:outline-none"
                  value={draftValue}
                  aria-label="Rename attachment"
                  onChange={(event) =>
                    setRenameDraft((current) => ({
                      ...current,
                      [attachment.attachmentId]: event.target.value,
                    }))
                  }
                  onBlur={() =>
                    handleRename(
                      attachment,
                      draftValue || attachment.fileName
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      (event.target as HTMLInputElement).blur();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setRenameDraft((current) => {
                        const next = { ...current };
                        delete next[attachment.attachmentId];
                        return next;
                      });
                      (event.target as HTMLInputElement).blur();
                    }
                  }}
                />
                {onViewDoc && (
                  <button
                    type="button"
                    onClick={() => onViewDoc(attachment.docId)}
                    className="rounded border border-leather/30 px-2 py-0.5 text-[10px] font-semibold text-leather hover:bg-leather/10"
                  >
                    View
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={isFirst}
                  onClick={() => handleMove(attachment, -1)}
                  className="rounded border border-ledger-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-light hover:bg-leather/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={isLast}
                  onClick={() => handleMove(attachment, 1)}
                  className="rounded border border-ledger-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-light hover:bg-leather/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(attachment)}
                  className="rounded px-2 py-0.5 text-[10px] font-semibold text-seal hover:bg-seal/10"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-ledger-line bg-parchment px-2 py-1 text-xs font-semibold text-leather hover:bg-leather/5">
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          disabled={pending}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            await handleAdd(file);
            event.target.value = '';
          }}
        />
        {pending ? 'Attaching…' : '+ Attach PDF'}
      </label>
    </div>
  );
}
