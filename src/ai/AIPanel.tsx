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
import { useAIUndoStore, restoreSnapshot } from './undo-store';
import AISettingsPanel from './AISettingsPanel';
import WizardPanel from './wizard/WizardPanel';

interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
  toolCalls?: ChatTurnResult['toolCalls'];
  error?: string;
}

type Mode = 'chat' | 'wizard';

export default function AIPanel({ onClose }: { onClose: () => void }) {
  const settings = useAISettingsStore();
  const configured = isConfigured(settings);

  const [mode, setMode] = useState<Mode>('chat');
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(!configured);
  const undoSnapshot = useAIUndoStore((s) => s.snapshot);
  const clearSnapshot = useAIUndoStore((s) => s.clear);
  const [undoing, setUndoing] = useState(false);

  const onUndo = async () => {
    if (!undoSnapshot || undoing) return;
    setUndoing(true);
    try {
      await restoreSnapshot(undoSnapshot);
      clearSnapshot();
      setEntries((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: '↩ Restored workspace to the state before the last AI change.',
        },
      ]);
    } catch (err) {
      setEntries((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: '',
          error: err instanceof Error ? err.message : String(err),
        },
      ]);
    } finally {
      setUndoing(false);
    }
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const baseEntries: ChatEntry[] = [...entries, { role: 'user', text: trimmed }];
    const streamingIndex = baseEntries.length; // index of the assistant entry we'll stream into
    const streamingPlaceholder: ChatEntry = {
      role: 'assistant',
      text: '',
      toolCalls: [],
    };
    setEntries([...baseEntries, streamingPlaceholder]);
    setInput('');
    setBusy(true);

    const modelMessages: ModelMessage[] = baseEntries.map((e) => ({
      role: e.role,
      content: e.text,
    }));

    // Live-stream buffers (refs-via-closure pattern — React state would
    // re-batch and swallow mid-flight updates).
    let liveText = '';
    const liveToolCalls: NonNullable<ChatEntry['toolCalls']> = [];
    const patchStreaming = () => {
      setEntries((prev) => {
        const next = [...prev];
        next[streamingIndex] = {
          role: 'assistant',
          text: liveText,
          toolCalls: [...liveToolCalls],
        };
        return next;
      });
    };

    try {
      const result = await runChatTurn({
        messages: modelMessages,
        onDelta: (delta) => {
          liveText += delta;
          patchStreaming();
        },
        onToolCall: (call) => {
          liveToolCalls.push(call);
          patchStreaming();
        },
      });
      // Finalise with authoritative text + tool calls from the SDK in case the
      // stream dropped or reconciled differently.
      setEntries((prev) => {
        const next = [...prev];
        next[streamingIndex] = {
          role: 'assistant',
          text: result.text,
          toolCalls: result.toolCalls,
        };
        return next;
      });
    } catch (err) {
      setEntries((prev) => {
        const next = [...prev];
        next[streamingIndex] = {
          role: 'assistant',
          text: liveText,
          toolCalls: liveToolCalls,
          error: err instanceof Error ? err.message : String(err),
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  };

  const send = () => sendText(input);

  const startGuidedImport = (workbookText: string) => {
    setMode('chat');
    const seed =
      "I've uploaded a workbook. Walk me through importing it row-by-row.\n\n"
      + 'Rules for this walkthrough:\n'
      + '- Ask clarifying questions before calling any mutating tool when something is ambiguous — especially fixed vs floating NPRI, whether a fraction burdens the branch or the whole tract, and which tract each row belongs to.\n'
      + '- Create each mineral owner as a standalone tree root for now (createRootNode). We will graft to a common grantor later via graftToParent once we know the relationships.\n'
      + '- NPRI rows get createRootNode with kind="npri"; confirm fixed vs floating with me first.\n'
      + '- Before creating anything, summarize what you see (how many owners, which tracts, any rows you cannot classify) and wait for my go-ahead.\n'
      + '- After each batch of creations, report the validation result.\n\n'
      + 'Workbook contents:\n\n'
      + workbookText;
    void sendText(seed);
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
        <div className="flex items-center gap-1">
          {undoSnapshot && (
            <button
              type="button"
              onClick={onUndo}
              disabled={undoing}
              title={`Undo last AI change · "${undoSnapshot.label}"`}
              className="rounded border border-gold/50 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold hover:bg-gold/20 disabled:opacity-40"
            >
              ↩ Undo
            </button>
          )}
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

      <nav className="flex border-b border-leather/30 bg-parchment/70 text-[11px] font-semibold uppercase tracking-wide">
        <TabButton active={mode === 'chat'} onClick={() => setMode('chat')}>
          Chat
        </TabButton>
        <TabButton active={mode === 'wizard'} onClick={() => setMode('wizard')}>
          Import wizard
        </TabButton>
      </nav>

      <div className="flex-1 space-y-3 overflow-y-auto bg-parchment-light p-3 text-sm text-ink">
        {showSettings && <AISettingsPanel onClose={() => setShowSettings(false)} />}

        {mode === 'wizard' && !showSettings && (
          <WizardPanel onStartGuided={startGuidedImport} />
        )}

        {mode === 'chat' && !showSettings && (
          <>
            {entries.length === 0 && (
              <div className="rounded-lg border border-leather/30 bg-parchment p-3 text-xs text-ink-light">
                Ask about the current project, a tract, a lessor, or a mineral-math
                scenario. All active calculations assume Texas oil-and-gas rules.
                Try: <em>"What's in this project?"</em>
              </div>
            )}
            {entries.map((e, i) => (
              <ChatBubble key={i} entry={e} />
            ))}
            {busy
              && entries[entries.length - 1]?.role === 'assistant'
              && !entries[entries.length - 1]?.text
              && (entries[entries.length - 1]?.toolCalls ?? []).length === 0 && (
                <div className="text-xs italic text-ink-light">Thinking…</div>
              )}
          </>
        )}
      </div>

      {mode === 'chat' && (
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
      )}
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 transition ${
        active
          ? 'border-b-2 border-gold bg-parchment text-ink'
          : 'text-ink-light hover:bg-parchment/90 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

type ToolCall = NonNullable<ChatEntry['toolCalls']>[number];

function toolCallSummary(call: ToolCall): { text: string; ok: boolean | null } {
  const out = call.output as Record<string, unknown> | null;
  const input = (call.input as Record<string, unknown>) ?? {};
  const okFlag = out && typeof out === 'object' && 'ok' in out ? Boolean(out.ok) : null;

  const peek = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return '';
  };

  switch (call.toolName) {
    case 'createRootNode':
      return {
        text: `createRootNode (${peek(input.kind) || 'mineral'} ${peek(input.initialFraction)}) → ${peek(out?.nodeId) || '✗'}`,
        ok: okFlag,
      };
    case 'convey':
      return {
        text: `convey ${peek(input.share)} from ${peek(input.parentNodeId)} → ${peek(out?.nodeId) || '✗'}`,
        ok: okFlag,
      };
    case 'createNpri':
      return {
        text: `createNpri ${peek(input.share)} (${peek(input.royaltyKind) || 'fixed'}) on ${peek(input.parentNodeId)} → ${peek(out?.nodeId) || '✗'}`,
        ok: okFlag,
      };
    case 'precede':
      return {
        text: `precede ${peek(input.nodeId)} with ${peek(input.newInitialFraction)} → ${peek(out?.newPredecessorId) || '✗'}`,
        ok: okFlag,
      };
    case 'graftToParent': {
      const attached = Array.isArray(out?.attached) ? (out.attached as unknown[]).length : 0;
      const failed = Array.isArray(out?.failed) ? (out.failed as unknown[]).length : 0;
      return {
        text: `graftToParent ${peek(input.parentNodeId)} → attached ${attached}, failed ${failed}`,
        ok: okFlag,
      };
    }
    case 'previewDeleteNode':
      return {
        text: `previewDeleteNode ${peek(input.nodeId)} → ${peek(out?.totalNodesRemoved)} node(s) would be removed (${peek(out?.descendantCount)} descendants)`,
        ok: null,
      };
    case 'deleteNode':
      return {
        text: `deleteNode ${peek(input.nodeId)} → ${okFlag ? `removed ${peek(out?.removedCount)}` : 'refused'}`,
        ok: okFlag,
      };
    case 'attachLease':
      return {
        text: `attachLease lease=${peek(input.leaseId)} onto ${peek(input.mineralNodeId)} → ${peek(out?.leaseNodeId) || '✗'}`,
        ok: okFlag,
      };
    case 'createOwner':
      return {
        text: `createOwner "${peek(input.name)}" → ${peek(out?.ownerId) || '✗'}`,
        ok: okFlag,
      };
    case 'createLease':
      return {
        text: `createLease owner=${peek(input.ownerId)} → ${peek(out?.leaseId) || '✗'}`,
        ok: okFlag,
      };
    case 'createDeskMap':
      return {
        text: `createDeskMap "${peek(input.name)}" (${peek(input.code)}) → ${peek(out?.deskMapId) || '✗'}`,
        ok: okFlag,
      };
    case 'setActiveDeskMap':
      return {
        text: `setActiveDeskMap → ${peek(input.deskMapId)}`,
        ok: okFlag,
      };
    default:
      return { text: call.toolName, ok: okFlag };
  }
}

interface ToolCallValidation {
  valid: boolean;
  issueCount: number;
  issues: Array<{ code: string; nodeId: string | null; message: string }>;
}

function extractValidation(call: ToolCall): ToolCallValidation | null {
  const out = call.output as Record<string, unknown> | null;
  const v = out && typeof out === 'object' ? (out.validation as ToolCallValidation | undefined) : undefined;
  if (!v || typeof v !== 'object') return null;
  if (v.valid === true) return null;
  return v;
}

function ToolCallTrace({ calls }: { calls: ToolCall[] }) {
  const validationIssues = calls
    .map((c, i) => ({ i, call: c, v: extractValidation(c) }))
    .filter((entry) => entry.v !== null) as Array<{
      i: number;
      call: ToolCall;
      v: ToolCallValidation;
    }>;

  return (
    <div className="max-w-[90%] space-y-2 text-[10px]">
      {/* Compact summary — always visible, no click required */}
      <ul className="space-y-0.5 rounded border border-leather/20 bg-parchment/60 p-2 font-mono text-ink">
        {calls.map((c, i) => {
          const s = toolCallSummary(c);
          const tone =
            s.ok === false
              ? 'text-rose-700'
              : s.ok === true
              ? 'text-emerald-800'
              : 'text-ink-light';
          const dot = s.ok === false ? '✗' : s.ok === true ? '✓' : '•';
          return (
            <li key={i} className={`flex gap-2 ${tone}`}>
              <span className="shrink-0">{dot}</span>
              <span className="break-all">{s.text}</span>
            </li>
          );
        })}
      </ul>

      {/* Validation issues — prominent, not hidden behind a disclosure */}
      {validationIssues.length > 0 && (
        <div className="rounded border border-amber-400 bg-amber-50 p-2 text-amber-900">
          <div className="mb-1 font-semibold uppercase tracking-wide">
            ⚠ Graph validation issues after this turn
          </div>
          <ul className="space-y-0.5">
            {validationIssues[validationIssues.length - 1].v.issues.map((issue, i) => (
              <li key={i} className="font-mono">
                <span className="font-semibold">{issue.code}</span>
                {issue.nodeId && <span className="text-amber-700"> · {issue.nodeId}</span>}
                <span className="text-amber-800"> — {issue.message}</span>
              </li>
            ))}
            {validationIssues[validationIssues.length - 1].v.issueCount
              > validationIssues[validationIssues.length - 1].v.issues.length && (
              <li className="italic text-amber-700">
                (and{' '}
                {validationIssues[validationIssues.length - 1].v.issueCount
                  - validationIssues[validationIssues.length - 1].v.issues.length}{' '}
                more)
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Raw JSON — still available on demand for debugging */}
      <details className="rounded border border-leather/20 bg-parchment/40 text-ink-light">
        <summary className="cursor-pointer px-2 py-1 font-mono uppercase tracking-wide">
          raw tool I/O
        </summary>
        <div className="space-y-2 border-t border-leather/20 p-2">
          {calls.map((tc, i) => (
            <div key={i} className="font-mono">
              <div className="font-semibold text-ink">{tc.toolName}</div>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded bg-ink/5 p-1">
                {JSON.stringify({ input: tc.input, output: tc.output }, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </details>
    </div>
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
        <ToolCallTrace calls={entry.toolCalls} />
      )}
    </div>
  );
}
