/**
 * Accessible modal shell — backdrop, escape-to-close, click-outside-to-close,
 * focus trap, and return-focus on close.
 *
 * Phase 5 / B4: closes the audit F8 modal-focus gap. Tab and Shift+Tab
 * cycle focus within the dialog so keyboard users can't accidentally
 * land on the page underneath. On close, focus returns to whichever
 * element opened the dialog.
 */
import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

/**
 * Selector for elements that should participate in the Tab cycle.
 * Mirrors the WAI-ARIA Authoring Practices guidance — buttons, links,
 * form fields, anything with a non-negative tabindex, plus inputs that
 * may have a `disabled` attribute (which we explicitly exclude).
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
}

export default function Modal({ open, onClose, title, children, wide }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Escape-to-close.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Capture the previously-focused element and move focus into the
  // dialog on open. Restore focus on close.
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Defer the focus call so the dialog has actually mounted and is
    // visible in the focus tree. The dialog itself is the fallback when
    // it has no focusable children (rare — usually buttons are inside).
    const dialog = dialogRef.current;
    if (dialog) {
      const focusables = getFocusable(dialog);
      const requested = dialog.querySelector<HTMLElement>('[data-autofocus="true"]');
      const target = requested ?? focusables[0] ?? dialog;
      target.focus();
    }

    return () => {
      const previous = previousFocusRef.current;
      if (previous && document.body.contains(previous)) {
        previous.focus();
      }
      previousFocusRef.current = null;
    };
  }, [open]);

  // Tab / Shift+Tab focus cycle.
  useEffect(() => {
    if (!open) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = getFocusable(dialog);
      if (focusables.length === 0) {
        // No focusable inside — keep focus pinned to the dialog itself.
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !dialog.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`
          relative bg-parchment rounded-md shadow-2xl border border-ledger-line
          mx-4 max-h-[90vh] overflow-y-auto outline-none
          ${wide ? 'max-w-2xl w-full' : 'max-w-lg w-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ledger-line sticky top-0 bg-parchment rounded-t-md z-10">
          <h2 className="text-lg font-display font-bold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="text-ink-light hover:text-ink text-2xl leading-none px-1"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
