import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_MODELS,
  isConfigured,
  toPersistedAISettings,
  useAISettingsStore,
} from '../settings-store';

describe('AI settings store', () => {
  beforeEach(() => {
    useAISettingsStore.setState({
      provider: 'ollama',
      model: DEFAULT_MODELS.ollama,
      ollamaBaseURL: 'http://localhost:11434/v1',
      openaiApiKey: '',
      anthropicApiKey: '',
    });
  });

  it('changing provider resets model to that provider default', () => {
    useAISettingsStore.getState().setProvider('anthropic');
    expect(useAISettingsStore.getState().model).toBe(DEFAULT_MODELS.anthropic);

    useAISettingsStore.getState().setProvider('openai');
    expect(useAISettingsStore.getState().model).toBe(DEFAULT_MODELS.openai);
  });

  it('setModel overrides without changing provider', () => {
    useAISettingsStore.getState().setProvider('ollama');
    useAISettingsStore.getState().setModel('qwen2.5:14b');
    expect(useAISettingsStore.getState().model).toBe('qwen2.5:14b');
    expect(useAISettingsStore.getState().provider).toBe('ollama');
  });

  it('ollama is configured when baseURL is present', () => {
    expect(isConfigured(useAISettingsStore.getState())).toBe(true);
  });

  it('openai without key is not configured', () => {
    useAISettingsStore.getState().setProvider('openai');
    expect(isConfigured(useAISettingsStore.getState())).toBe(false);
    useAISettingsStore.getState().setOpenAIKey('sk-test');
    expect(isConfigured(useAISettingsStore.getState())).toBe(true);
  });

  it('anthropic without key is not configured', () => {
    useAISettingsStore.getState().setProvider('anthropic');
    expect(isConfigured(useAISettingsStore.getState())).toBe(false);
    useAISettingsStore.getState().setAnthropicKey('sk-ant-test');
    expect(isConfigured(useAISettingsStore.getState())).toBe(true);
  });

  it('persists provider preferences but not cloud API keys', () => {
    const persisted = toPersistedAISettings({
      ...useAISettingsStore.getState(),
      provider: 'openai',
      model: 'gpt-4o',
      ollamaBaseURL: 'http://localhost:11434/v1',
      openaiApiKey: 'sk-test',
      anthropicApiKey: 'sk-ant-test',
    });

    expect(persisted).toEqual({
      provider: 'openai',
      model: 'gpt-4o',
      ollamaBaseURL: 'http://localhost:11434/v1',
    });
    expect(persisted).not.toHaveProperty('openaiApiKey');
    expect(persisted).not.toHaveProperty('anthropicApiKey');
  });
});
