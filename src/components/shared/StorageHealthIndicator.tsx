import type {
  BrowserStorageEstimateResult,
  PersistentStorageResult,
} from '../../storage/persistent-storage';
import {
  useStorageHealthStore,
  type RollingAutoExportState,
} from '../../store/storage-health-store';

interface StorageHealthIndicatorProps {
  onConfigureAutoExport: () => void | Promise<void>;
  onDisableAutoExport: () => void | Promise<void>;
  onBackupNow: () => void | Promise<void>;
}

export function StorageHealthIndicator({
  onBackupNow,
  onConfigureAutoExport,
  onDisableAutoExport,
}: StorageHealthIndicatorProps) {
  const lastSavedAt = useStorageHealthStore((state) => state.lastSavedAt);
  const lastExportedAt = useStorageHealthStore((state) => state.lastExportedAt);
  const persistentStorage = useStorageHealthStore((state) => state.persistentStorage);
  const browserStorageEstimate = useStorageHealthStore(
    (state) => state.browserStorageEstimate
  );
  const rollingAutoExport = useStorageHealthStore(
    (state) => state.rollingAutoExport
  );

  return (
    <StorageHealthIndicatorContent
      lastSavedAt={lastSavedAt}
      lastExportedAt={lastExportedAt}
      persistentStorage={persistentStorage}
      browserStorageEstimate={browserStorageEstimate}
      rollingAutoExport={rollingAutoExport}
      onBackupNow={onBackupNow}
      onConfigureAutoExport={onConfigureAutoExport}
      onDisableAutoExport={onDisableAutoExport}
    />
  );
}

interface StorageHealthIndicatorContentProps extends StorageHealthIndicatorProps {
  browserStorageEstimate: BrowserStorageEstimateResult | null;
  lastExportedAt: string | null;
  lastSavedAt: string | null;
  persistentStorage: PersistentStorageResult | null;
  rollingAutoExport: RollingAutoExportState;
}

export function StorageHealthIndicatorContent({
  browserStorageEstimate,
  lastExportedAt,
  lastSavedAt,
  persistentStorage,
  rollingAutoExport,
  onBackupNow,
  onConfigureAutoExport,
  onDisableAutoExport,
}: StorageHealthIndicatorContentProps) {
  const storageLabel = formatStorageValue(
    persistentStorage,
    browserStorageEstimate
  );
  const autoExportLabel = formatRollingAutoExportValue(rollingAutoExport);
  const autoExportTitle = formatRollingAutoExportTitle(rollingAutoExport);
  const autoExportUnsupported = rollingAutoExport.support === 'unsupported';

  return (
    <div
      aria-label="Storage health"
      className="flex min-w-[27rem] items-center gap-2 rounded-lg border border-parchment/15 bg-parchment/5 px-2 py-1"
    >
      <div className="grid min-w-0 flex-1 grid-cols-[0.7fr_0.7fr_1.1fr_1.2fr] gap-2 text-[10px] leading-tight text-parchment/70">
        <StatusField label="Saved" value={formatTimestamp(lastSavedAt)} />
        <StatusField label="Backup" value={formatTimestamp(lastExportedAt)} />
        <StatusField
          label="Storage"
          value={storageLabel}
          title={formatStorageEstimate(browserStorageEstimate)}
        />
        <StatusField
          label="Auto"
          value={autoExportLabel}
          title={autoExportTitle}
          warning={Boolean(rollingAutoExport.warning)}
        />
      </div>
      <button
        type="button"
        onClick={() => void onBackupNow()}
        className="shrink-0 rounded-md border border-gold/40 px-2.5 py-1.5 text-xs font-semibold text-gold/90 transition-colors hover:border-gold hover:bg-gold/10 hover:text-gold"
      >
        Backup Now
      </button>
      <button
        type="button"
        onClick={() => void onConfigureAutoExport()}
        disabled={autoExportUnsupported}
        title={
          autoExportUnsupported
            ? 'This browser does not support local folder auto-export.'
            : 'Choose a local folder for rolling .landroid snapshots.'
        }
        className="shrink-0 rounded-md border border-parchment/25 px-2.5 py-1.5 text-xs font-semibold text-parchment/75 transition-colors hover:border-parchment/50 hover:bg-parchment/10 hover:text-parchment disabled:cursor-not-allowed disabled:opacity-45"
      >
        {rollingAutoExport.enabled ? 'Change Folder' : 'Auto Export'}
      </button>
      {rollingAutoExport.enabled && (
        <button
          type="button"
          onClick={() => void onDisableAutoExport()}
          title="Disable rolling auto-export."
          className="shrink-0 rounded-md border border-parchment/20 px-2 py-1.5 text-xs font-semibold text-parchment/60 transition-colors hover:border-parchment/40 hover:bg-parchment/10 hover:text-parchment"
        >
          Off
        </button>
      )}
    </div>
  );
}

function StatusField({
  label,
  value,
  title,
  warning = false,
}: {
  label: string;
  value: string;
  title?: string;
  warning?: boolean;
}) {
  return (
    <div className="min-w-0" title={title ?? value}>
      <div className="font-semibold text-parchment/45">{label}</div>
      <div
        className={`truncate font-mono ${warning ? 'text-gold' : 'text-parchment/85'}`}
      >
        {value}
      </div>
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

function formatRollingAutoExportValue(state: RollingAutoExportState): string {
  if (state.support === 'checking') return 'checking';
  if (state.support === 'unsupported') return 'manual only';
  if (!state.enabled) return 'off';
  if (state.permission === 'denied' || state.permission === 'prompt') {
    return 'manual';
  }
  if (state.warning) return 'overdue';
  if (state.isWriting) return 'writing';
  if (state.pendingExportDueAt) return 'queued';
  if (state.lastAutoExportedAt) return formatTimestamp(state.lastAutoExportedAt);
  return 'ready';
}

function formatRollingAutoExportTitle(state: RollingAutoExportState): string {
  if (state.support === 'unsupported') {
    return 'Rolling auto-export needs File System Access API support. Use Backup Now for manual .landroid backups.';
  }
  if (!state.enabled) {
    return 'Rolling auto-export is off.';
  }
  if (state.warning) return state.warning;
  if (state.lastAutoExportError) return state.lastAutoExportError;

  const directory = state.directoryName
    ? `Folder: ${state.directoryName}. `
    : '';
  if (state.pendingExportDueAt) {
    return `${directory}Next snapshot due ${formatTimestamp(state.pendingExportDueAt)}.`;
  }
  if (state.lastAutoExportedAt && state.lastAutoExportFileName) {
    return `${directory}Last snapshot: ${state.lastAutoExportFileName}.`;
  }
  return `${directory}Rolling .landroid snapshots are enabled.`;
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
