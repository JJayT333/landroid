interface StorageHealthIndicatorProps {
  onBackupNow: () => void | Promise<void>;
}

export function StorageHealthIndicator({ onBackupNow }: StorageHealthIndicatorProps) {
  return (
    <button
      type="button"
      onClick={() => void onBackupNow()}
      className="rounded-lg border border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold/90 transition-colors hover:border-gold hover:bg-gold/10 hover:text-gold"
    >
      Backup Now
    </button>
  );
}
