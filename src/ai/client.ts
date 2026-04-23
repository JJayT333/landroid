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
import { isHostedMode } from '../utils/deploy-env';
import { getIdToken, triggerUnauthorized } from '../auth/session';

export class AISettingsError extends Error {}

export const HOSTED_MODEL_ID = 'gpt-4o-mini';

export function resolveModel(settings: AISettings): LanguageModel {
  if (isHostedMode()) {
    const proxy = createOpenAICompatible({
      name: 'landroid-proxy',
      baseURL: '/api/ai',
      fetch: async (url, init) => {
        const token = await getIdToken();
        const headers = new Headers(init?.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        const res = await fetch(url as string, { ...init, headers });
        // Token expired / invalid. Clear the session so LoginGate re-prompts
        // instead of leaving the user staring at a broken AI stream.
        if (res.status === 401) triggerUnauthorized();
        return res;
      },
    });
    return proxy(HOSTED_MODEL_ID);
  }

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
