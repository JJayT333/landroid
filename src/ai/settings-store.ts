/**
 * AI settings — provider, model, endpoint, and API key.
 *
 * Keys live in localStorage only (single-user local-first app). Cloud keys are
 * exposed to the browser — acceptable for the current architecture; revisit if
 * LANDroid ever ships multi-user.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AIProvider = 'ollama' | 'openai' | 'anthropic';

export interface AISettings {
  provider: AIProvider;
  model: string;
  ollamaBaseURL: string;
  openaiApiKey: string;
  anthropicApiKey: string;
}

export interface AISettingsActions {
  setProvider: (p: AIProvider) => void;
  setModel: (m: string) => void;
  setOllamaBaseURL: (url: string) => void;
  setOpenAIKey: (k: string) => void;
  setAnthropicKey: (k: string) => void;
}

/** Default model per provider. Local defaults to a model the user already has. */
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  ollama: 'gpt-oss:20b',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-6',
};

/** Curated suggestions surfaced in the settings UI; user can type anything. */
export const MODEL_SUGGESTIONS: Record<AIProvider, string[]> = {
  ollama: ['gpt-oss:20b', 'llama3.2:latest', 'qwen2.5:7b', 'qwen2.5:14b'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
  anthropic: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'],
};

export const useAISettingsStore = create<AISettings & AISettingsActions>()(
  persist(
    (set) => ({
      provider: 'ollama',
      model: DEFAULT_MODELS.ollama,
      ollamaBaseURL: 'http://localhost:11434/v1',
      openaiApiKey: '',
      anthropicApiKey: '',
      setProvider: (provider) =>
        set({ provider, model: DEFAULT_MODELS[provider] }),
      setModel: (model) => set({ model }),
      setOllamaBaseURL: (ollamaBaseURL) => set({ ollamaBaseURL }),
      setOpenAIKey: (openaiApiKey) => set({ openaiApiKey }),
      setAnthropicKey: (anthropicApiKey) => set({ anthropicApiKey }),
    }),
    { name: 'landroid-ai-settings' }
  )
);

export function isConfigured(settings: AISettings): boolean {
  if (settings.provider === 'ollama') return settings.ollamaBaseURL.length > 0;
  if (settings.provider === 'openai') return settings.openaiApiKey.length > 0;
  if (settings.provider === 'anthropic') return settings.anthropicApiKey.length > 0;
  return false;
}
