/**
 * Inline notice / banner kit (deep audit §5.7). Four theme-mapped tones so
 * status messages stop reaching for raw Tailwind palettes and looking "pasted
 * from another app." Tones map onto the locked palette tints: info = sky,
 * success = green, warn = amber, error = seal.
 *
 * `frame="card"` (default) is a rounded inline notice for in-content messages.
 * `frame="banner"` is a full-bleed top banner (bottom border, centered content)
 * for app-level state like the read-only / title-ledger banners.
 */
import type { ReactNode } from 'react';

export type NoticeTone = 'info' | 'warn' | 'error' | 'success';
export type NoticeFrame = 'card' | 'banner';

const TONES: Record<NoticeTone, string> = {
  info: 'border-tint-sky-line bg-tint-sky-line/15 text-tint-sky-ink',
  success: 'border-tint-green-line bg-tint-green-line/20 text-tint-green-ink',
  warn: 'border-tint-amber-line bg-tint-amber text-tint-amber-ink',
  error: 'border-seal/40 bg-seal/10 text-seal',
};

export interface NoticeProps {
  tone?: NoticeTone;
  frame?: NoticeFrame;
  /** Bold lead line above the body. */
  title?: ReactNode;
  /** Right-aligned actions (buttons/links). */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export default function Notice({
  tone = 'info',
  frame = 'card',
  title,
  actions,
  className = '',
  children,
}: NoticeProps) {
  const role = tone === 'error' || tone === 'warn' ? 'alert' : 'status';
  const frameClass = frame === 'banner' ? 'border-b' : 'rounded-md border';
  const body = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold leading-6">{title}</p> : null}
        {children ? <div className="leading-6">{children}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
  return (
    <div role={role} className={`px-4 py-3 text-sm ${frameClass} ${TONES[tone]} ${className}`.trim()}>
      {frame === 'banner' ? <div className="mx-auto max-w-6xl">{body}</div> : body}
    </div>
  );
}
