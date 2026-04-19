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
import { landroidTools, MUTATING_TOOL_NAMES } from './tools';
import { useAISettingsStore } from './settings-store';
import { captureSnapshot, useAIUndoStore } from './undo-store';

export interface ChatTurnInput {
  messages: ModelMessage[];
  /** Called for every text delta as the assistant streams. */
  onDelta?: (delta: string) => void;
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

  const result = streamText({
    model,
    system: LANDROID_SYSTEM_PROMPT,
    messages: input.messages,
    tools: landroidTools,
    stopWhen: stepCountIs(8),
  });

  // Consume the full stream. `fullStream` yields text deltas, tool-call events,
  // and step boundaries; we surface text via onDelta and accumulate tool calls
  // for the final result and undo-commit logic.
  const toolCallsInProgress = new Map<string, { toolName: string; input: unknown }>();
  const toolCalls: ChatTurnResult['toolCalls'] = [];
  let mutated = false;
  let finalText = '';

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
        }
        break;
      }
      case 'tool-result': {
        const pending = toolCallsInProgress.get(part.toolCallId);
        const call = {
          toolName: pending?.toolName ?? part.toolName,
          input: pending?.input ?? null,
          output: part.output ?? null,
        };
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
  if (mutated && pendingSnapshot) {
    useAIUndoStore.getState().setSnapshot(pendingSnapshot);
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
