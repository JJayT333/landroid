/**
 * Slide-out AI chat panel — the primary assistant surface.
 *
 * Non-streaming for v1. Renders message history, a trace of any tool calls the
 * model made, and inline settings. Keeps zero workspace state of its own —
 * everything deterministic still lives in the Zustand stores the tools read.
 */
import { useState } from 'react';
import type { ModelMessage } from 'ai';
import { runChatTurn, type ChatTurnResult } from './runChat';
import { useAISettingsStore, isConfigured } from './settings-store';
import AISettingsPanel from './AISettingsPanel';

interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
  toolCalls?: ChatTurnResult['toolCalls'];
  error?: string;
}

export default function AIPanel({ onClose }: { onClose: () => void }) {
  const settings = useAISettingsStore();
  const configured = isConfigured(settings);

  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(!configured);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    const nextEntries: ChatEntry[] = [...entries, { role: 'user', text }];
    setEntries(nextEntries);
    setInput('');
    setBusy(true);

    const modelMessages: ModelMessage[] = nextEntries.map((e) => ({
      role: e.role,
      content: e.text,
    }));

    try {
      const result = await runChatTurn({ messages: modelMessages });
      setEntries([
        ...nextEntries,
        {
          role: 'assistant',
          text: result.text,
          toolCalls: result.toolCalls,
        },
      ]);
    } catch (err) {
      setEntries([
        ...nextEntries,
        {
          role: 'assistant',
          text: '',
          error: err instanceof Error ? err.message : String(err),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="fixed bottom-4 right-4 top-16 z-40 flex w-[420px] flex-col overflow-hidden rounded-2xl border border-leather/60 bg-parchment-light shadow-2xl">
      <header className="flex items-center justify-between border-b border-leather/40 bg-ink px-4 py-2 text-parchment">
        <div className="flex items-center gap-2">
          <span className="text-sm font-display font-bold">LANDroid AI</span>
          <span className="rounded border border-parchment/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-parchment/80">
            {settings.provider} · {settings.model}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className="rounded px-2 py-0.5 text-xs text-parchment/70 hover:bg-ink-light/40 hover:text-parchment"
            aria-label="Toggle AI settings"
          >
            ⚙
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 text-xs text-parchment/70 hover:bg-ink-light/40 hover:text-parchment"
            aria-label="Close AI panel"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm text-ink">
        {showSettings && <AISettingsPanel onClose={() => setShowSettings(false)} />}

        {entries.length === 0 && !showSettings && (
          <div className="rounded-lg border border-leather/30 bg-parchment p-3 text-xs text-ink-light">
            Ask about the current project, a tract, a lessor, or a mineral-math
            scenario. All active calculations assume Texas oil-and-gas rules.
            Try: <em>"What's in this project?"</em>
          </div>
        )}

        {entries.map((e, i) => (
          <ChatBubble key={i} entry={e} />
        ))}

        {busy && (
          <div className="text-xs italic text-ink-light">Thinking…</div>
        )}
      </div>

      <footer className="border-t border-leather/40 bg-parchment p-2">
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask LANDroid AI…"
            rows={2}
            className="flex-1 resize-none rounded border border-leather/40 bg-parchment-light px-2 py-1 text-xs focus:border-gold focus:outline-none"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="self-end rounded bg-ink px-3 py-1 text-xs font-semibold text-parchment hover:bg-ink-light disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </footer>
    </aside>
  );
}

function ChatBubble({ entry }: { entry: ChatEntry }) {
  if (entry.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-ink px-3 py-2 text-sm text-parchment">
          {entry.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {entry.error ? (
        <div className="rounded-lg border border-rose-400 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          <div className="mb-1 font-semibold">Error</div>
          {entry.error}
        </div>
      ) : (
        <div className="max-w-[90%] whitespace-pre-wrap rounded-lg border border-leather/30 bg-parchment px-3 py-2 text-sm text-ink">
          {entry.text}
        </div>
      )}
      {entry.toolCalls && entry.toolCalls.length > 0 && (
        <details className="max-w-[90%] rounded border border-leather/20 bg-parchment/50 text-[10px] text-ink-light">
          <summary className="cursor-pointer px-2 py-1 font-mono uppercase tracking-wide">
            {entry.toolCalls.length} tool call{entry.toolCalls.length === 1 ? '' : 's'}
          </summary>
          <div className="space-y-2 border-t border-leather/20 p-2">
            {entry.toolCalls.map((tc, i) => (
              <div key={i} className="font-mono">
                <div className="font-semibold text-ink">{tc.toolName}</div>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded bg-ink/5 p-1">
                  {JSON.stringify(tc.output, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
