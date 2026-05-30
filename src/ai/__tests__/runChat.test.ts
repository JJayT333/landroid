import { afterEach, describe, expect, it, vi } from 'vitest';

const aiMocks = vi.hoisted(() => ({
  resolveModel: vi.fn(() => 'test-model'),
  stepCountIs: vi.fn((count: number) => ({ kind: 'stepCountIs', count })),
  streamText: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    stepCountIs: aiMocks.stepCountIs,
    streamText: aiMocks.streamText,
  };
});

vi.mock('../client', () => ({
  HOSTED_MODEL_ID: 'gpt-hosted-test',
  resolveModel: aiMocks.resolveModel,
}));

vi.mock('../../utils/deploy-env', () => ({
  isHostedMode: () => false,
}));

async function* emptyStream() {
  // no-op stream for configuration-only assertions
}

describe('runChatTurn local provider path', () => {
  afterEach(() => {
    aiMocks.resolveModel.mockClear();
    aiMocks.stepCountIs.mockClear();
    aiMocks.streamText.mockReset();
    vi.resetModules();
  });

  it('caps local AI tool loops at 8 SDK steps', async () => {
    aiMocks.streamText.mockReturnValue({
      fullStream: emptyStream(),
      usage: Promise.resolve({ inputTokens: 10, outputTokens: 0 }),
    });
    const { runChatTurn } = await import('../runChat');

    const result = await runChatTurn({
      messages: [{ role: 'user', content: 'keep calling tools' }],
    });

    expect(result).toMatchObject({
      text: '',
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 0 },
    });
    expect(aiMocks.stepCountIs).toHaveBeenCalledWith(8);
    expect(aiMocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        stopWhen: { kind: 'stepCountIs', count: 8 },
      })
    );
  });
});
