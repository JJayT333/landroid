/**
 * Sidebar-footer chip exposing browser storage health (DEF-STOR-01).
 *
 * The app already collects persistent-storage status and a usage/quota estimate
 * at boot (`main.tsx` → `useStorageHealthStore`), but only the persistent/
 * best-effort flag was ever surfaced. This chip opens a small popover (mirroring
 * `LedgerStatusChip`) showing the usage/quota bar, persistence status, and the
 * last-saved / last-exported / auto-export state so the user can tell whether a
 * durable backup exists before browser storage fills. Read-only.
 */
import { useEffect, useRef, useState } from 'react';
import { useStorageHealthStore } from '../../store/storage-health-store';
import { formatBytes, formatTimestamp } from '../../utils/format-storage';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="text-ink-light">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

export function StorageHealthChip() {
  const persistentStorage = useStorageHealthStore((s) => s.persistentStorage);
  const estimate = useStorageHealthStore((s) => s.browserStorageEstimate);
  const lastSavedAt = useStorageHealthStore((s) => s.lastSavedAt);
  const lastExportedAt = useStorageHealthStore((s) => s.lastExportedAt);
  const rollingAutoExport = useStorageHealthStore((s) => s.rollingAutoExport);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const persisted = persistentStorage?.status === 'persisted';
  const usage = estimate?.usage ?? null;
  const quota = estimate?.quota ?? null;
  const percent =
    usage != null && quota != null && quota > 0
      ? Math.min(100, Math.round((usage / quota) * 100))
      : null;
  const nearFull = percent != null && percent >= 85;
  const dotClass = nearFull ? 'bg-seal' : persisted ? 'bg-[#3f7d4e]' : 'bg-gold';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Browser storage health. Click for details."
        className="flex shrink-0 items-center gap-1.5 rounded-[7px] border border-ledger-line px-2 py-[3px] text-[10px] font-semibold text-ink-light transition-colors hover:bg-parchment-dark"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        Storage
      </button>
      {open && (
        <div className="absolute bottom-8 right-0 z-50 w-72 max-w-[80vw] overflow-hidden rounded-[10px] border border-ledger-line bg-parchment-light p-3.5 shadow-[0_12px_30px_rgba(45,33,20,0.16)]">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-light">
            Storage health
          </div>

          {percent != null ? (
            <div className="mb-2.5">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-ink-light">Browser usage</span>
                <span className="font-semibold text-ink">
                  {formatBytes(usage)} of {formatBytes(quota)} ({percent}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-parchment-dark">
                <div
                  className={`h-full rounded-full ${nearFull ? 'bg-seal' : 'bg-leather'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              {nearFull && (
                <div className="mt-1 text-[10px] font-semibold text-seal">
                  Storage is nearly full — export a backup.
                </div>
              )}
            </div>
          ) : (
            <div className="mb-2.5 text-[11px] text-ink-light">
              Browser does not report a storage estimate.
            </div>
          )}

          <div className="space-y-1 border-t border-ledger-line pt-2">
            <DetailRow
              label="Persistence"
              value={persisted ? 'Persistent' : 'Best effort'}
            />
            <DetailRow label="Last saved" value={formatTimestamp(lastSavedAt)} />
            <DetailRow label="Last exported" value={formatTimestamp(lastExportedAt)} />
            <DetailRow
              label="Auto-export"
              value={
                rollingAutoExport.enabled
                  ? rollingAutoExport.directoryName ?? 'On'
                  : 'Manual'
              }
            />
          </div>

          {!persisted && (
            <div className="mt-2 text-[10px] text-ink-light">
              The browser may evict best-effort storage under pressure. Keep a
              recent .landroid backup.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
