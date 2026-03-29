/** Single contact log entry — timeline style. */
import type { ContactLog } from '../../types/owner';
import { CONTACT_TYPE_OPTIONS } from '../../types/owner';

const TYPE_ICONS: Record<string, string> = {
  call: '\uD83D\uDCDE',
  email: '\u2709\uFE0F',
  visit: '\uD83D\uDCCD',
  letter: '\uD83D\uDCE8',
  text: '\uD83D\uDCAC',
  other: '\uD83D\uDD39',
};

interface Props {
  entry: ContactLog;
  onDelete: () => void;
}

export default function ContactLogEntry({ entry, onDelete }: Props) {
  const typeOpt = CONTACT_TYPE_OPTIONS.find((t) => t.value === entry.type);
  const icon = TYPE_ICONS[entry.type] ?? '\uD83D\uDD39';
  const isOverdue = entry.followUpDate && !entry.followUpCompleted && entry.followUpDate < new Date().toISOString().slice(0, 10);

  return (
    <div className="flex gap-3 group">
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-1">
        <span className="text-base leading-none">{icon}</span>
        <div className="flex-1 w-px bg-ledger-line mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-ink">{typeOpt?.label ?? entry.type}</span>
          <span className="text-[10px] text-ink-light/50">
            {entry.direction === 'inbound' ? '\u2190 Inbound' : '\u2192 Outbound'}
          </span>
          <span className="text-[10px] text-ink-light/40 font-mono ml-auto shrink-0">
            {entry.date} {entry.time}
          </span>
          <button
            onClick={onDelete}
            className="text-[10px] text-seal/50 hover:text-seal opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Del
          </button>
        </div>

        {entry.contactPerson && (
          <div className="text-[11px] text-ink-light mt-0.5">
            Spoke with: <span className="font-medium text-ink">{entry.contactPerson}</span>
          </div>
        )}

        {entry.summary && (
          <p className="text-sm text-ink mt-1 font-medium">{entry.summary}</p>
        )}

        {entry.notes && (
          <p className="text-xs text-ink-light mt-1 whitespace-pre-wrap">{entry.notes}</p>
        )}

        {entry.followUpDate && (
          <div className={`inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            entry.followUpCompleted
              ? 'bg-emerald-100 text-emerald-700'
              : isOverdue
                ? 'bg-red-100 text-red-700'
                : 'bg-gold/15 text-ink-light'
          }`}>
            {entry.followUpCompleted ? '\u2713 ' : isOverdue ? '\u26A0 ' : '\u23F0 '}
            Follow-up: {entry.followUpDate}
          </div>
        )}
      </div>
    </div>
  );
}
