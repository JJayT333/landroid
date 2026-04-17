/**
 * AI runtime adapter — resolves a provider+model from settings into a
 * Vercel AI SDK `LanguageModel` ready for `streamText`/`generateText`.
 *
 * Keeps provider-specific SDK imports centralised so UI code never touches them.
 */
import type { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { AISettings } from './settings-store';

export class AISettingsError extends Error {}

export function resolveModel(settings: AISettings): LanguageModel {
  if (settings.provider === 'ollama') {
    const ollama = createOpenAICompatible({
      name: 'ollama',
      baseURL: settings.ollamaBaseURL,
    });
    return ollama(settings.model);
  }

  if (settings.provider === 'openai') {
    if (!settings.openaiApiKey) {
      throw new AISettingsError('OpenAI API key is not set.');
    }
    const openai = createOpenAI({ apiKey: settings.openaiApiKey });
    return openai(settings.model);
  }

  if (settings.provider === 'anthropic') {
    if (!settings.anthropicApiKey) {
      throw new AISettingsError('Anthropic API key is not set.');
    }
    const anthropic = createAnthropic({
      apiKey: settings.anthropicApiKey,
      headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
    });
    return anthropic(settings.model);
  }

  throw new AISettingsError(`Unsupported provider: ${settings.provider}`);
}
