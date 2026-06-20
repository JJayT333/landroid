/**
 * Single-turn chat invocation against the configured provider.
 *
 * Streams assistant text via `onDelta`, collects tool-call traces, and resolves
 * to the finalised result. The caller chooses whether to render partials
 * (AIPanel does) or ignore them (tests).
 */
import { streamText, stepCountIs, type ModelMessage } from 'ai';
import { HOSTED_MODEL_ID, resolveModel } from './client';
import { LANDROID_ADVISORY_SYSTEM_PROMPT, LANDROID_SYSTEM_PROMPT } from './system-prompt';
import { buildAIAppContext } from './app-context';
import { landroidTools, UNDO_MUTATING_TOOL_NAMES } from './tools';
import { useAISettingsStore } from './settings-store';
import { captureSnapshot, useAIUndoStore } from './undo-store';
import { isHostedMode } from '../utils/deploy-env';
import { getIdToken, triggerUnauthorized } from '../auth/session';
import { useWorkspaceStore } from '../store/workspace-store';

export interface ChatTurnInput {
  messages: ModelMessage[];
  signal?: AbortSignal;
  /** Called for every text delta as the assistant streams. */
  onDelta?: (delta: string) => void;
  /** Called as soon as the model starts a tool call. */
  onToolStart?: (call: { toolName: string; input: unknown }) => void;
  /** Called when a tool call resolves, before the next token arrives. */
  onToolCall?: (call: {
    toolName: string;
    input: unknown;
    output: unknown;
  }) => void;
}

export interface ChatTurnResult {
  text: string;
  toolCalls: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
  }>;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export async function runChatTurn(
  input: ChatTurnInput
): Promise<ChatTurnResult> {
  const settings = useAISettingsStore.getState();
  if (isHostedMode()) {
    return runHostedProxyChatTurn(input);
  }

  const model = resolveModel(settings);

  // Mutating tools now queue approval proposals. The approved apply path takes
  // its own snapshot, so merely proposing a change must not consume the undo
  // slot. This fallback snapshot remains for any future live mutator that is
  // intentionally left outside the approval wrapper.
  const lastUserMessage = [...input.messages].reverse().find((m) => m.role === 'user');
  const label =
    typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content.slice(0, 60)
      : 'AI mutation';
  let pendingSnapshot: Awaited<ReturnType<typeof captureSnapshot>> | null = null;

  const result = streamText({
    model,
    system: LANDROID_SYSTEM_PROMPT,
    messages: input.messages,
    tools: landroidTools,
    stopWhen: stepCountIs(8),
    abortSignal: input.signal,
    timeout:
      settings.provider !== 'ollama' ? 2 * 60_000 : 10 * 60_000,
  });

  // Consume the full stream. `fullStream` yields text deltas, tool-call events,
  // and step boundaries; we surface text via onDelta and accumulate tool calls
  // for the final result and undo-commit logic.
  const toolCallsInProgress = new Map<string, { toolName: string; input: unknown }>();
  const toolCalls: ChatTurnResult['toolCalls'] = [];
  let mutated = false;
  let snapshotCommitted = false;
  let finalText = '';

  const commitMutationSnapshot = () => {
    if (snapshotCommitted || !pendingSnapshot) return;
    useAIUndoStore.getState().setSnapshot(pendingSnapshot);
    snapshotCommitted = true;
  };

  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'text-delta': {
        finalText += part.text;
        input.onDelta?.(part.text);
        break;
      }
      case 'tool-call': {
        toolCallsInProgress.set(part.toolCallId, {
          toolName: part.toolName,
          input: part.input,
        });
        input.onToolStart?.({ toolName: part.toolName, input: part.input });
        break;
      }
      case 'tool-result': {
        const pending = toolCallsInProgress.get(part.toolCallId);
        const call = {
          toolName: pending?.toolName ?? part.toolName,
          input: pending?.input ?? null,
          output: part.output ?? null,
        };
        const output = call.output as { approvalRequired?: unknown } | null;
        if (
          UNDO_MUTATING_TOOL_NAMES.has(call.toolName)
          && output?.approvalRequired !== true
        ) {
          mutated = true;
          pendingSnapshot ??= await captureSnapshot(label);
          commitMutationSnapshot();
        }
        toolCalls.push(call);
        toolCallsInProgress.delete(part.toolCallId);
        input.onToolCall?.(call);
        break;
      }
      default:
        break;
    }
  }

  // Keep the snapshot only if the turn actually mutated workspace state;
  // otherwise a harmless read-only question would wipe a prior usable undo.
  if (mutated && !snapshotCommitted) {
    commitMutationSnapshot();
  }

  const usage = await Promise.resolve(result.usage).catch(() => undefined);

  return {
    text: finalText,
    toolCalls,
    usage: usage
      ? {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        }
      : undefined,
  };
}

async function runHostedProxyChatTurn(
  input: ChatTurnInput
): Promise<ChatTurnResult> {
  const settings = useAISettingsStore.getState();
  const workspaceId = useWorkspaceStore.getState().workspaceId;
  if (
    settings.hostedContextMode === 'full'
    && settings.hostedFullContextAcceptedWorkspaceId !== workspaceId
  ) {
    throw new Error(
      'Hosted full context requires disclosure acceptance for this workspace before sending project details.'
    );
  }
  const token = await getIdToken();
  if (!token) {
    throw new Error('Hosted AI session is missing a Cognito ID token. Sign out, sign back in, and try again.');
  }

  const { signal, clear } = withTimeout(input.signal, 2 * 60_000);
  try {
    const response = await fetch('/api/ai/chat/completions', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: HOSTED_MODEL_ID,
        stream: true,
        messages: [
          // The hosted proxy forwards no tools, so the model genuinely has no
          // write path here. Send the advisory prompt so it never claims to
          // create, queue, or approve a change it cannot make.
          { role: 'system', content: LANDROID_ADVISORY_SYSTEM_PROMPT },
          { role: 'system', content: buildAIAppContext(settings.hostedContextMode) },
          ...input.messages.map(toOpenAIMessage),
        ],
      }),
      signal,
    });

    if (response.status === 401) {
      triggerUnauthorized();
    }
    if (!response.ok) {
      throw new Error(await readHostedError(response));
    }

    const reader = response.body?.getReader();
    if (!reader) return { text: '', toolCalls: [] };

    const decoder = new TextDecoder();
    let buffer = '';
    let finalText = '';

    const consumeEvent = (event: string) => {
      for (const rawLine of event.split('\n')) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice('data:'.length).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: unknown } }>;
            error?: { message?: unknown };
          };
          if (typeof parsed.error?.message === 'string') {
            throw new Error(parsed.error.message);
          }
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            finalText += delta;
            input.onDelta?.(delta);
          }
        } catch (err) {
          if (err instanceof Error) throw err;
          throw new Error('Hosted AI returned an unreadable stream event.');
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separator = findSseSeparator(buffer);
      while (separator) {
        const event = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator.length);
        consumeEvent(event);
        separator = findSseSeparator(buffer);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) consumeEvent(buffer);

    return { text: finalText, toolCalls: [] };
  } finally {
    clear();
  }
}

function withTimeout(parent: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => {
    clearTimeout(timeout);
    controller.abort();
  };
  if (parent) {
    if (parent.aborted) abort();
    else parent.addEventListener('abort', abort, { once: true });
  }
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function findSseSeparator(buffer: string): { index: number; length: number } | null {
  const match = /\r?\n\r?\n/.exec(buffer);
  return match ? { index: match.index, length: match[0].length } : null;
}

function toOpenAIMessage(message: ModelMessage): { role: 'user' | 'assistant' | 'system'; content: string } {
  const role =
    message.role === 'assistant' || message.role === 'system' ? message.role : 'user';
  return {
    role,
    content: messageContentToText(message.content),
  };
}

function messageContentToText(content: ModelMessage['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

async function readHostedError(response: Response): Promise<string> {
  const fallback = `Hosted AI request failed with HTTP ${response.status}.`;
  try {
    const text = await response.text();
    if (!text.trim()) return fallback;
    const parsed = JSON.parse(text) as { error?: { message?: unknown } };
    return typeof parsed.error?.message === 'string' ? parsed.error.message : text.slice(0, 500);
  } catch {
    return fallback;
  }
}
