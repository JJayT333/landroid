/**
 * AI settings — provider, model, endpoint, and API key.
 *
 * Provider/model preferences persist for convenience. Cloud API keys are
 * session-only so a future OpenAI/Anthropic workflow cannot accidentally leave
 * long-lived secrets in browser storage.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Audit L2: under jsdom-less vitest runs the default `localStorage` isn't
 * present and zustand's persist middleware logs a noisy "No storage" warning
 * on every write. Wire an in-memory fallback so the store works identically
 * regardless of environment and tests can assert against persisted payloads
 * without env setup.
 */
function resolvePersistStorage(): Storage {
  // Feature-check by method shape, not truthiness — Node 25+ exposes a
  // localStorage property whose methods are undefined unless a backing file
  // is configured, which otherwise blows up with "setItem is not a function".
  const ls = typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
  if (ls && typeof ls.setItem === 'function' && typeof ls.getItem === 'function') {
    return ls;
  }
  const backing = new Map<string, string>();
  return {
    get length() {
      return backing.size;
    },
    clear: () => backing.clear(),
    getItem: (key) => (backing.has(key) ? backing.get(key)! : null),
    key: (index) => Array.from(backing.keys())[index] ?? null,
    removeItem: (key) => {
      backing.delete(key);
    },
    setItem: (key, value) => {
      backing.set(key, String(value));
    },
  } satisfies Storage;
}

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

type PersistedAISettings = Pick<AISettings, 'provider' | 'model' | 'ollamaBaseURL'>;

function isAIProvider(value: unknown): value is AIProvider {
  return value === 'ollama' || value === 'openai' || value === 'anthropic';
}

export function toPersistedAISettings<T extends AISettings>(
  state: T
): PersistedAISettings {
  return {
    provider: state.provider,
    model: state.model,
    ollamaBaseURL: state.ollamaBaseURL,
  };
}

export const useAISettingsStore = create<AISettings & AISettingsActions>()(
  persist(
    (set) => ({
      provider: 'ollama',
      model: DEFAULT_MODELS.ollama,
      ollamaBaseURL: 'http://localhost:11434/v1',
      openaiApiKey: '',
      anthropicApiKey: '',
      setProvider: (provider: AIProvider) =>
        set({ provider, model: DEFAULT_MODELS[provider] }),
      setModel: (model: string) => set({ model }),
      setOllamaBaseURL: (ollamaBaseURL: string) => set({ ollamaBaseURL }),
      setOpenAIKey: (openaiApiKey: string) => set({ openaiApiKey }),
      setAnthropicKey: (anthropicApiKey: string) => set({ anthropicApiKey }),
    }),
    {
      name: 'landroid-ai-settings',
      version: 1,
      storage: createJSONStorage(resolvePersistStorage),
      partialize: toPersistedAISettings,
      migrate: (persisted) => {
        const safe =
          persisted && typeof persisted === 'object'
            ? persisted as Partial<AISettings>
            : {};
        const provider = isAIProvider(safe.provider)
          ? safe.provider
          : 'ollama';

        return toPersistedAISettings({
          provider,
          model:
            typeof safe.model === 'string' && safe.model.trim()
              ? safe.model
              : DEFAULT_MODELS[provider],
          ollamaBaseURL:
            typeof safe.ollamaBaseURL === 'string'
              ? safe.ollamaBaseURL
              : 'http://localhost:11434/v1',
          openaiApiKey: '',
          anthropicApiKey: '',
        });
      },
      merge: (persisted, current) => {
        const safe =
          persisted && typeof persisted === 'object'
            ? persisted as Partial<AISettings>
            : {};
        const provider = isAIProvider(safe.provider)
          ? safe.provider
          : current.provider;

        return {
          ...current,
          provider,
          model:
            typeof safe.model === 'string' && safe.model.trim()
              ? safe.model
              : DEFAULT_MODELS[provider],
          ollamaBaseURL:
            typeof safe.ollamaBaseURL === 'string'
              ? safe.ollamaBaseURL
              : current.ollamaBaseURL,
          openaiApiKey: '',
          anthropicApiKey: '',
        };
      },
    }
  )
);

export function isConfigured(settings: AISettings): boolean {
  if (settings.provider === 'ollama') return settings.ollamaBaseURL.length > 0;
  if (settings.provider === 'openai') return settings.openaiApiKey.length > 0;
  if (settings.provider === 'anthropic') return settings.anthropicApiKey.length > 0;
  return false;
}
