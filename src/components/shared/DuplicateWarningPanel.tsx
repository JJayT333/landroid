/**
 * The warn-and-choose panel for the ingest dedup guard.
 *
 * Shown when a picked file is byte-for-byte identical to a document already in
 * the workspace. It only *offers a choice* — attach a copy anyway, or cancel
 * and keep the one on file. Nothing is ever skipped or merged automatically.
 * Presentational: the surface owns the file state and the decision handlers.
 */
import type { DuplicateMatch } from '../../documents/duplicate-guard';

export interface DuplicateWarningPanelProps {
  /** Filename of the file the user just picked. */
  candidateName: string;
  /** Existing workspace documents that share the candidate's exact bytes. */
  matches: ReadonlyArray<DuplicateMatch>;
  onConfirm: () => void;
  onCancel: () => void;
  /** Confirm-button label; defaults to the attach wording. */
  confirmLabel?: string;
  disabled?: boolean;
}

export default function DuplicateWarningPanel({
  candidateName,
  matches,
  onConfirm,
  onCancel,
  confirmLabel = 'Attach a copy anyway',
  disabled = false,
}: DuplicateWarningPanelProps) {
  return (
    <div className="space-y-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-ink">
      <p className="font-semibold">This exact file is already in this project.</p>
      <p className="text-ink-light">
        “{candidateName}” is byte-for-byte identical to{' '}
        {matches.length === 1
          ? `“${matches[0].fileName}”`
          : `${matches.length} documents already on file`}
        . You can add it anyway, or cancel and keep the one already here.
      </p>
      {matches.length > 1 && (
        <ul className="list-disc pl-4 font-mono text-ink-light">
          {matches.map((match) => (
            <li key={match.docId}>{match.fileName}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          className="rounded border border-leather/40 bg-parchment px-2 py-1 text-[11px] font-semibold text-leather hover:bg-leather/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="rounded px-2 py-1 text-[11px] font-semibold text-ink-light hover:bg-leather/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
