/**
 * Chip / badge primitive (deep audit §5, pill/tag consolidation). One component
 * for the small status tags that were copy-pasted across the desk-map cards with
 * a mix of raw Tailwind palettes and theme tints. Tones map onto the locked
 * palette so badges read as one app:
 *   amber  → NPRI / royalty   green → lease / lessee   sky → present owner
 *   seal   → review / problem  leather/gold → document chrome  neutral → default
 *
 * `variant="solid"` is the filled emphasis badge (e.g. the NPRI / Lessee tag);
 * `variant="soft"` (default) is the quieter white-tinted tag. `shape="pill"`
 * is fully rounded; `shape="tag"` (default) is the squared chip. Numeric or
 * mixed-case chips pass `uppercase={false}`.
 */
import type { ReactNode } from 'react';

export type ChipTone = 'neutral' | 'leather' | 'gold' | 'seal' | 'amber' | 'green' | 'sky';
export type ChipSize = 'xs' | 'sm';
export type ChipShape = 'pill' | 'tag';
export type ChipVariant = 'soft' | 'solid';

const SOFT: Record<ChipTone, string> = {
  neutral: 'border-ledger-line bg-parchment-light text-ink-light',
  leather: 'border-leather/30 bg-leather/5 text-leather',
  gold: 'border-gold/30 bg-gold/10 text-gold',
  seal: 'border-seal/25 bg-seal/10 text-seal',
  amber: 'border-tint-amber-line bg-white/80 text-tint-amber-ink',
  green: 'border-tint-green-line bg-white/85 text-tint-green-ink',
  sky: 'border-tint-sky-line bg-white/80 text-tint-sky-ink',
};

const SOLID: Record<ChipTone, string> = {
  neutral: 'border-line-strong bg-parchment-dark text-ink',
  leather: 'border-leather/40 bg-leather/15 text-leather',
  gold: 'border-gold/40 bg-gold/20 text-gold',
  seal: 'border-seal/40 bg-seal/15 text-seal',
  amber: 'border-tint-amber-line bg-tint-amber text-tint-amber-ink',
  green: 'border-tint-green-line bg-tint-green-line/55 text-tint-green-ink',
  sky: 'border-tint-sky-line bg-tint-sky-line/55 text-tint-sky-ink',
};

const SIZES: Record<ChipSize, string> = {
  xs: 'px-1 py-0.5 text-[8px]',
  sm: 'px-1.5 py-0.5 text-[9px]',
};

export interface ChipProps {
  tone?: ChipTone;
  size?: ChipSize;
  shape?: ChipShape;
  variant?: ChipVariant;
  /** Uppercase + tracking (default). Pass false for numeric/mixed-case chips. */
  uppercase?: boolean;
  /**
   * Allow long chip text to wrap inside its container instead of forcing a
   * single nowrap line. Opt-in (default false keeps the short-tag look) for
   * chips that can carry free text, e.g. a lease's Notes term on a fixed-width
   * desk-map card where nowrap text would bleed past the card edge.
   */
  wrap?: boolean;
  /** Native title (tooltip) — useful when wrapped/long text is shown. */
  title?: string;
  className?: string;
  children?: ReactNode;
}

export default function Chip({
  tone = 'neutral',
  size = 'sm',
  shape = 'tag',
  variant = 'soft',
  uppercase = true,
  wrap = false,
  title,
  className = '',
  children,
}: ChipProps) {
  const toneClass = variant === 'solid' ? SOLID[tone] : SOFT[tone];
  const shapeClass = shape === 'pill' ? 'rounded-full' : 'rounded-sm';
  const caseClass = uppercase ? 'uppercase tracking-wide' : '';
  // wrap: let long free text break within the chip and never exceed the parent
  // width; default: the original single-line tag.
  const wrapClass = wrap
    ? 'max-w-full whitespace-normal break-words text-left'
    : 'whitespace-nowrap';
  return (
    <span
      title={title}
      className={`inline-flex items-center border font-semibold ${wrapClass} ${shapeClass} ${SIZES[size]} ${toneClass} ${caseClass} ${className}`
        .replace(/\s+/g, ' ')
        .trim()}
    >
      {children}
    </span>
  );
}
