/** Floating "Ask LANDroid AI" FAB — toggles the AI panel open. */
import { lazy, Suspense, useState } from 'react';

const AIPanel = lazy(() => import('./AIPanel'));

export default function AIToggleButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open LANDroid AI"
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full border border-leather/40 bg-ink px-4 py-2.5 text-sm font-semibold text-parchment shadow-xl transition-colors hover:bg-ink-light"
        >
          Ask LANDroid AI
        </button>
      )}
      {open && (
        <Suspense fallback={null}>
          <AIPanel onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
