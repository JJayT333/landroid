import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AISettingsPanel from '../AISettingsPanel';
import { useAISettingsStore } from '../settings-store';

describe('AISettingsPanel', () => {
  it('recommends explicit local Ollama origins instead of wildcard CORS', () => {
    useAISettingsStore.setState({
      provider: 'ollama',
      model: 'gpt-oss:20b',
      ollamaBaseURL: 'http://localhost:11434/v1',
      openaiApiKey: '',
      anthropicApiKey: '',
    });

    const html = renderToStaticMarkup(<AISettingsPanel onClose={() => {}} />);

    expect(html).not.toContain('OLLAMA_ORIGINS=*');
    expect(html).toContain(
      'OLLAMA_ORIGINS=http://localhost:5173,http://127.0.0.1:5173'
    );
  });
});
