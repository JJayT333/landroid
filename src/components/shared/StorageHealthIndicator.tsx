import type {
  BrowserStorageEstimateResult,
  PersistentStorageResult,
} from '../../storage/persistent-storage';
import { useStorageHealthStore } from '../../store/storage-health-store';

interface StorageHealthIndicatorProps {
  onBackupNow: () => void | Promise<void>;
}

export function StorageHealthIndicator({ onBackupNow }: StorageHealthIndicatorProps) {
  const lastSavedAt = useStorageHealthStore((state) => state.lastSavedAt);
  const lastExportedAt = useStorageHealthStore((state) => state.lastExportedAt);
  const persistentStorage = useStorageHealthStore((state) => state.persistentStorage);
  const browserStorageEstimate = useStorageHealthStore(
    (state) => state.browserStorageEstimate
  );

  return (
    <StorageHealthIndicatorContent
      lastSavedAt={lastSavedAt}
      lastExportedAt={lastExportedAt}
      persistentStorage={persistentStorage}
      browserStorageEstimate={browserStorageEstimate}
      onBackupNow={onBackupNow}
    />
  );
}

interface StorageHealthIndicatorContentProps extends StorageHealthIndicatorProps {
  browserStorageEstimate: BrowserStorageEstimateResult | null;
  lastExportedAt: string | null;
  lastSavedAt: string | null;
  persistentStorage: PersistentStorageResult | null;
}

export function StorageHealthIndicatorContent({
  browserStorageEstimate,
  lastExportedAt,
  lastSavedAt,
  persistentStorage,
  onBackupNow,
}: StorageHealthIndicatorContentProps) {
  const storageLabel = formatStorageValue(
    persistentStorage,
    browserStorageEstimate
  );

  return (
    <div
      aria-label="Storage health"
      className="flex min-w-[18rem] items-center gap-2 rounded-lg border border-parchment/15 bg-parchment/5 px-2 py-1"
    >
      <div className="grid min-w-0 flex-1 grid-cols-[0.75fr_0.75fr_1.5fr] gap-2 text-[10px] leading-tight text-parchment/70">
        <StatusField label="Saved" value={formatTimestamp(lastSavedAt)} />
        <StatusField label="Backup" value={formatTimestamp(lastExportedAt)} />
        <StatusField
          label="Storage"
          value={storageLabel}
          title={formatStorageEstimate(browserStorageEstimate)}
        />
      </div>
      <button
        type="button"
        onClick={() => void onBackupNow()}
        className="shrink-0 rounded-md border border-gold/40 px-2.5 py-1.5 text-xs font-semibold text-gold/90 transition-colors hover:border-gold hover:bg-gold/10 hover:text-gold"
      >
        Backup Now
      </button>
    </div>
  );
}

function StatusField({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="min-w-0" title={title ?? value}>
      <div className="font-semibold text-parchment/45">{label}</div>
      <div className="truncate font-mono text-parchment/85">{value}</div>
    </div>
  );
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'none';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPersistentStorageLabel(result: PersistentStorageResult | null): string {
  if (!result) return 'pending';
  if (result.status === 'persisted') {
    return result.alreadyPersisted ? 'persistent' : 'granted';
  }
  if (result.status === 'denied') return 'best effort';
  if (result.status === 'unsupported') return 'unsupported';
  return 'check failed';
}

function formatStorageValue(
  result: PersistentStorageResult | null,
  estimate: BrowserStorageEstimateResult | null
): string {
  const label = formatPersistentStorageLabel(result);
  const percent = formatStorageUsagePercent(estimate);
  return percent ? `${label} ${percent}` : label;
}

function formatStorageEstimate(
  estimate: BrowserStorageEstimateResult | null
): string {
  if (!estimate) return 'Storage estimate pending';
  if (!estimate.supported) return 'Storage estimate unavailable';
  if (estimate.error) return `Storage estimate failed: ${estimate.error}`;

  const usage = formatBytes(estimate.usage);
  const quota = formatBytes(estimate.quota);
  if (usage && quota && estimate.usage !== null && estimate.quota) {
    const percent = Math.min(100, (estimate.usage / estimate.quota) * 100);
    return `${usage} used of ${quota} (${percent.toFixed(1)}%)`;
  }
  if (usage) return `${usage} used`;
  if (quota) return `${quota} quota`;
  return 'Storage estimate unavailable';
}

function formatStorageUsagePercent(
  estimate: BrowserStorageEstimateResult | null
): string | null {
  if (
    !estimate?.supported
    || estimate.error
    || estimate.usage === null
    || !estimate.quota
  ) {
    return null;
  }

  const percent = Math.min(100, (estimate.usage / estimate.quota) * 100);
  return `${percent.toFixed(1)}%`;
}

function formatBytes(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  if (value < 1024) return `${value} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = value / 1024;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  return `${amount >= 10 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unitIndex]}`;
}
