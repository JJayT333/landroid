/**
 * Display helpers for the storage-health surface (DEF-STOR-01).
 *
 * These format byte counts and timestamps for human reading — NOT ownership
 * decimals, so they intentionally live outside the engine display-format
 * precision policy (byte humanization is a sanctioned `.toFixed` use).
 */

export function formatBytes(value: number | null): string {
  if (value == null) return '—';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let scaled = value / 1024;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  return `${scaled.toFixed(scaled >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return 'never';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'never' : date.toLocaleString();
}
