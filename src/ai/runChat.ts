/**
 * Single-turn chat invocation against the configured provider.
 *
 * Streams assistant text via `onDelta`, collects tool-call traces, and resolves
 * to the finalised result. The caller chooses whether to render partials
 * (AIPanel does) or ignore them (tests).
 */
import { streamText, stepCountIs, type ModelMessage } from 'ai';
import { resolveModel } from './client';
import { LANDROID_SYSTEM_PROMPT } from './system-prompt';
import { landroidTools, MUTATING_TOOL_NAMES, readOnlyLandroidTools } from './tools';
import { useAISettingsStore } from './settings-store';
import { captureSnapshot, useAIUndoStore } from './undo-store';
import { isHostedMode } from '../utils/deploy-env';

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
  const model = resolveModel(settings);

  // Pre-turn snapshot. We always capture — it's cheap — and discard later if
  // the turn didn't call any mutating tool. Capturing before the stream
  // guarantees the snapshot predates every mutation in this turn.
  const lastUserMessage = [...input.messages].reverse().find((m) => m.role === 'user');
  const label =
    typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content.slice(0, 60)
      : 'AI mutation';
  const pendingSnapshot = await captureSnapshot(label);

  // Hosted deploy: ship the read-only tool subset until the proposal/approval
  // boundary (AUDIT CB-4) lands. Local dev keeps the full tool set so the
  // user-as-operator can continue authoring.
  const activeTools = isHostedMode() ? readOnlyLandroidTools : landroidTools;

  const result = streamText({
    model,
    system: LANDROID_SYSTEM_PROMPT,
    messages: input.messages,
    tools: activeTools,
    stopWhen: stepCountIs(8),
    abortSignal: input.signal,
    timeout: settings.provider === 'ollama' ? 10 * 60_000 : 2 * 60_000,
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
        if (MUTATING_TOOL_NAMES.has(part.toolName)) {
          mutated = true;
          commitMutationSnapshot();
        }
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
        if (MUTATING_TOOL_NAMES.has(call.toolName)) {
          mutated = true;
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
