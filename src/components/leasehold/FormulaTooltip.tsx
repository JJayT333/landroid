/**
 * Hover popover that shows the arithmetic behind a computed decimal in the
 * Leasehold view. Lets a landman walk an auditor / buyer / partner through
 * the math by pointing at any number on screen.
 *
 * Triggers: hover (with a small delay) and focus (for keyboard / screen
 * reader users). Wrap the visible number with this component.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface FormulaStep {
  /** Short label, e.g., "Owner Tract Royalty". */
  label: string;
  /** Symbolic expression, e.g., "1/2 × 1/4". */
  expression: string;
  /** Evaluated value with units, e.g., "= 0.1250000 (12.50%)". */
  value: string;
}

export interface FormulaInput {
  label: string;
  value: string;
}

export interface FormulaContent {
  title: string;
  /** One-line explainer shown under the title. */
  description?: string;
  /** Optional raw inputs (source-of-truth values pulled from leases /
   *  ORRIs / NPRIs) shown before the derivation. */
  inputs?: FormulaInput[];
  /** Derivation steps in order. */
  steps: FormulaStep[];
  /** Final result label and value. */
  result: { label: string; value: string };
  /** Optional caveat, e.g., "Clamped to 0 when negative". */
  note?: string;
}

const SHOW_DELAY_MS = 150;

export function FormulaTooltip({
  content,
  children,
}: {
  content: FormulaContent;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [placement, setPlacement] = useState<'above' | 'below'>('above');
  const showTimer = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => () => {
    if (showTimer.current !== null) window.clearTimeout(showTimer.current);
  }, []);

  // Decide whether to render above or below based on available room.
  useEffect(() => {
    if (!visible || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setPlacement(rect.top < 220 ? 'below' : 'above');
  }, [visible]);

  const scheduleShow = () => {
    if (showTimer.current !== null) window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
  };

  const hide = () => {
    if (showTimer.current !== null) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (!pinned) setVisible(false);
  };

  const togglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !pinned;
    setPinned(next);
    if (next) setVisible(true);
  };

  return (
    <span
      ref={wrapperRef}
      className="relative inline-block cursor-help underline decoration-dotted decoration-[currentColor]/40 underline-offset-2 hover:decoration-[currentColor]/80"
      onMouseEnter={scheduleShow}
      onMouseLeave={hide}
      onFocus={scheduleShow}
      onBlur={hide}
      onClick={togglePin}
      tabIndex={0}
      role="button"
      aria-label={`${content.title} — click to pin formula`}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={[
            'absolute z-50 w-80 rounded-lg border border-leather bg-ink p-3 text-left text-xs text-parchment shadow-xl',
            'left-1/2 -translate-x-1/2',
            placement === 'above' ? 'bottom-full mb-2' : 'top-full mt-2',
            pinned ? 'ring-1 ring-amber-400/60' : '',
          ].join(' ')}
          onClick={(e) => e.stopPropagation()}
        >
          <FormulaContentBody content={content} pinned={pinned} />
        </span>
      )}
    </span>
  );
}

function FormulaContentBody({
  content,
  pinned,
}: {
  content: FormulaContent;
  pinned: boolean;
}) {
  return (
    <span className="block space-y-2">
      <span className="block">
        <span className="block font-semibold text-parchment">
          {content.title}
          {pinned && (
            <span className="ml-2 rounded bg-amber-400/20 px-1 text-[10px] uppercase text-amber-200">
              pinned
            </span>
          )}
        </span>
        {content.description && (
          <span className="block text-parchment/70">{content.description}</span>
        )}
      </span>

      {content.inputs && content.inputs.length > 0 && (
        <span className="block border-t border-leather/40 pt-2">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-parchment/50">
            Inputs
          </span>
          {content.inputs.map((input, i) => (
            <span key={i} className="flex justify-between gap-2">
              <span className="text-parchment/70">{input.label}</span>
              <span className="font-mono text-parchment">{input.value}</span>
            </span>
          ))}
        </span>
      )}

      <span className="block border-t border-leather/40 pt-2">
        <span className="mb-1 block text-[10px] uppercase tracking-wide text-parchment/50">
          Derivation
        </span>
        {content.steps.map((step, i) => (
          <span key={i} className="mb-1 block">
            <span className="block text-parchment/70">{step.label}</span>
            <span className="block font-mono text-parchment">
              {step.expression} <span className="text-parchment/80">{step.value}</span>
            </span>
          </span>
        ))}
      </span>

      <span className="block border-t border-leather/40 pt-2">
        <span className="flex justify-between gap-2 font-semibold">
          <span className="text-parchment">{content.result.label}</span>
          <span className="font-mono text-amber-200">{content.result.value}</span>
        </span>
      </span>

      {content.note && (
        <span className="block border-t border-leather/40 pt-2 text-[10px] italic text-parchment/60">
          {content.note}
        </span>
      )}

      <span className="block pt-1 text-[10px] text-parchment/40">
        {pinned ? 'Click again to unpin.' : 'Click to pin.'}
      </span>
    </span>
  );
}
