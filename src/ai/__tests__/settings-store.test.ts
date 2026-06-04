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
      hostedContextMode: 'minimal',
      hostedFullContextAcceptedWorkspaceId: null,
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
      hostedContextMode: 'full',
      hostedFullContextAcceptedWorkspaceId: 'ws-1',
    });

    expect(persisted).toEqual({
      provider: 'openai',
      model: 'gpt-4o',
      ollamaBaseURL: 'http://localhost:11434/v1',
    });
    expect(Object.keys(persisted).sort()).toEqual([
      'model',
      'ollamaBaseURL',
      'provider',
    ]);
    expect(persisted).not.toHaveProperty('openaiApiKey');
    expect(persisted).not.toHaveProperty('anthropicApiKey');
    expect(persisted).not.toHaveProperty('hostedContextMode');
    expect(persisted).not.toHaveProperty('hostedFullContextAcceptedWorkspaceId');
  });

  it('never writes cloud API keys through the persisted partial (audit L2)', () => {
    useAISettingsStore.getState().setProvider('openai');
    useAISettingsStore.getState().setOpenAIKey('sk-should-not-persist');
    useAISettingsStore.getState().setProvider('anthropic');
    useAISettingsStore.getState().setAnthropicKey('sk-ant-should-not-persist');

    const persisted = JSON.stringify(
      toPersistedAISettings(useAISettingsStore.getState())
    );
    expect(persisted).not.toContain('sk-should-not-persist');
    expect(persisted).not.toContain('sk-ant-should-not-persist');
    expect(persisted).not.toContain('openaiApiKey');
    expect(persisted).not.toContain('anthropicApiKey');
  });

  it('defaults hosted context to minimal and scopes full-context acceptance by workspace', () => {
    expect(useAISettingsStore.getState().hostedContextMode).toBe('minimal');
    expect(useAISettingsStore.getState().hostedFullContextAcceptedWorkspaceId).toBeNull();

    useAISettingsStore.getState().setHostedContextMode('full');
    expect(useAISettingsStore.getState().hostedContextMode).toBe('full');
    expect(useAISettingsStore.getState().hostedFullContextAcceptedWorkspaceId).toBeNull();

    useAISettingsStore.getState().acceptHostedFullContextDisclosure('ws-full');
    expect(useAISettingsStore.getState().hostedContextMode).toBe('full');
    expect(useAISettingsStore.getState().hostedFullContextAcceptedWorkspaceId).toBe('ws-full');

    useAISettingsStore.getState().setHostedContextMode('minimal');
    expect(useAISettingsStore.getState().hostedContextMode).toBe('minimal');
    expect(useAISettingsStore.getState().hostedFullContextAcceptedWorkspaceId).toBeNull();
  });
});
