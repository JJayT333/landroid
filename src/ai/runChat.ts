/**
 * Single-turn chat invocation against the configured provider.
 *
 * Assembles system prompt + message history, binds LANDroid tools, and returns
 * the final assistant text plus any tool-call trace for UI display.
 *
 * Non-streaming for v1 — streaming moves in once the pipe is proven.
 */
import { generateText, stepCountIs, type ModelMessage } from 'ai';
import { resolveModel } from './client';
import { LANDROID_SYSTEM_PROMPT } from './system-prompt';
import { landroidTools } from './tools';
import { useAISettingsStore } from './settings-store';

export interface ChatTurnInput {
  messages: ModelMessage[];
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

  const result = await generateText({
    model,
    system: LANDROID_SYSTEM_PROMPT,
    messages: input.messages,
    tools: landroidTools,
    stopWhen: stepCountIs(4),
  });

  const toolCalls: ChatTurnResult['toolCalls'] = [];
  for (const step of result.steps) {
    for (const call of step.toolCalls ?? []) {
      const matchingResult = step.toolResults?.find(
        (r) => r.toolCallId === call.toolCallId
      );
      toolCalls.push({
        toolName: call.toolName,
        input: call.input,
        output: matchingResult?.output ?? null,
      });
    }
  }

  return {
    text: result.text,
    toolCalls,
    usage: result.usage
      ? {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        }
      : undefined,
  };
}
