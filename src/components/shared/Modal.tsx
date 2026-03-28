/**
 * Accessible modal shell — backdrop, escape-to-close, click-outside-to-close.
 */
import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

export default function Modal({ open, onClose, title, children, wide }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Focus trap: focus the dialog when it opens
  useEffect(() => {
    if (open) dialogRef.current?.focus();
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
          relative bg-parchment rounded-xl shadow-2xl border border-ledger-line
          mx-4 max-h-[90vh] overflow-y-auto outline-none
          ${wide ? 'max-w-2xl w-full' : 'max-w-lg w-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ledger-line sticky top-0 bg-parchment rounded-t-xl z-10">
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
