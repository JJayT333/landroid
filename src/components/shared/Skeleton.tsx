/**
 * Loading skeletons (deep audit §5.7): animate-pulse shimmer blocks that replace
 * bare "Loading…" strings so a pending list reads as content arriving rather
 * than a dead screen. Compose `Skeleton` bars; size them with className.
 */
export interface SkeletonProps {
  className?: string;
}

/** A single shimmer block. Give it a height/width via className. */
export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-sm bg-line-strong/50 ${className}`.trim()}
    />
  );
}
