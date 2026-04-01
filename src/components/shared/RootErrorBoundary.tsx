import { Component, type ErrorInfo, type ReactNode } from 'react';

export function RootErrorFallback({
  error,
}: {
  error: Error;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-6 py-10">
      <div className="w-full max-w-2xl rounded-3xl border border-seal/20 bg-parchment shadow-xl">
        <div className="border-b border-seal/15 bg-seal/5 px-6 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-seal">
            Application Error
          </div>
          <h1 className="mt-2 text-3xl font-display font-bold text-ink">
            LANDroid hit a render error.
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-light">
            Your saved data should still be on disk. Reload the app to retry the current
            workspace, and if the problem repeats, note the message below for debugging.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-ledger-line bg-white/70 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
              Error Message
            </div>
            <div className="mt-2 text-sm text-ink">
              {error.message || 'Unknown render error'}
            </div>
          </div>

          <details className="rounded-2xl border border-ledger-line bg-white/70 px-4 py-3 text-sm text-ink-light">
            <summary className="cursor-pointer font-semibold text-ink">
              Technical details
            </summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-ink-light">
              {error.stack || error.message || 'No stack trace available.'}
            </pre>
          </details>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-leather px-4 py-2 text-sm font-semibold text-parchment transition-colors hover:bg-leather-light"
            >
              Reload App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  error: Error | null;
}

export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('LANDroid root render error', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return <RootErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

export default RootErrorBoundary;
