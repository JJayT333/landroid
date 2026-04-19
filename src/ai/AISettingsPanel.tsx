/**
 * Provider & model settings surface. Rendered inline at the top of the AI panel.
 * Keys live in localStorage only — we warn the user about browser exposure.
 */
import { useAISettingsStore, MODEL_SUGGESTIONS, type AIProvider } from './settings-store';

export default function AISettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useAISettingsStore();
  const { provider, model, ollamaBaseURL, openaiApiKey, anthropicApiKey } = settings;

  return (
    <div className="space-y-3 rounded-lg border border-leather/40 bg-parchment/60 p-3 text-xs text-ink">
      <div className="flex items-center justify-between">
        <span className="font-semibold uppercase tracking-wide text-ink-light">AI Settings</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-leather/40 px-2 py-0.5 text-[10px] text-ink-light hover:bg-leather/10"
        >
          Done
        </button>
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-light">Provider</span>
        <select
          value={provider}
          onChange={(e) => settings.setProvider(e.target.value as AIProvider)}
          className="w-full rounded border border-leather/40 bg-parchment px-2 py-1"
        >
          <option value="ollama">Ollama (local)</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-light">Model</span>
        <input
          list={`ai-model-suggestions-${provider}`}
          value={model}
          onChange={(e) => settings.setModel(e.target.value)}
          className="w-full rounded border border-leather/40 bg-parchment px-2 py-1 font-mono"
        />
        <datalist id={`ai-model-suggestions-${provider}`}>
          {MODEL_SUGGESTIONS[provider].map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>

      {provider === 'ollama' && (
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-light">Ollama base URL</span>
          <input
            value={ollamaBaseURL}
            onChange={(e) => settings.setOllamaBaseURL(e.target.value)}
            className="w-full rounded border border-leather/40 bg-parchment px-2 py-1 font-mono"
            placeholder="http://localhost:11434/v1"
          />
          <p className="mt-1 text-[10px] text-ink-light">
            Ollama must allow browser requests. If chat fails with a CORS error,
            restart Ollama with <code className="font-mono">OLLAMA_ORIGINS=*</code>.
          </p>
        </label>
      )}

      {provider === 'openai' && (
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-light">OpenAI API key</span>
          <input
            type="password"
            value={openaiApiKey}
            onChange={(e) => settings.setOpenAIKey(e.target.value)}
            className="w-full rounded border border-leather/40 bg-parchment px-2 py-1 font-mono"
            placeholder="sk-…"
          />
        </label>
      )}

      {provider === 'anthropic' && (
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-light">Anthropic API key</span>
          <input
            type="password"
            value={anthropicApiKey}
            onChange={(e) => settings.setAnthropicKey(e.target.value)}
            className="w-full rounded border border-leather/40 bg-parchment px-2 py-1 font-mono"
            placeholder="sk-ant-…"
          />
        </label>
      )}

      {provider !== 'ollama' && (
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-[10px] leading-snug text-amber-900">
          Cloud API keys stay in memory for this session only and are sent
          directly to the provider. For single-user local use only.
        </p>
      )}
    </div>
  );
}
