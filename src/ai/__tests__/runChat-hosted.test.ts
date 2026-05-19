import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadHostedChat() {
  vi.resetModules();
  vi.doMock('../../utils/deploy-env', () => ({
    isHostedMode: () => true,
  }));
  const [{ runChatTurn }, session] = await Promise.all([
    import('../runChat'),
    import('../../auth/session'),
  ]);
  return { runChatTurn, session };
}

function streamResponse(chunks: string[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }
  );
}

describe('runChatTurn hosted proxy path', () => {
  afterEach(() => {
    vi.doUnmock('../../utils/deploy-env');
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('posts directly to the hosted proxy with the Cognito ID token and streams text deltas', async () => {
    const { runChatTurn, session } = await loadHostedChat();
    session.setIdToken('id.jwt.token');
    const fetchMock = vi.fn(async () =>
      streamResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\r\n\r\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        'data: [DONE]\n\n',
      ])
    );
    vi.stubGlobal('fetch', fetchMock);
    const onDelta = vi.fn();

    const result = await runChatTurn({
      messages: [{ role: 'user', content: 'hello' }],
      onDelta,
    });

    expect(result).toMatchObject({ text: 'Hello', toolCalls: [] });
    expect(onDelta).toHaveBeenNthCalledWith(1, 'Hel');
    expect(onDelta).toHaveBeenNthCalledWith(2, 'lo');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ai/chat/completions');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer id.jwt.token');
    const body = JSON.parse(String(init.body)) as {
      stream?: unknown;
      messages?: Array<{ role: string; content: string }>;
    };
    expect(body.stream).toBe(true);
    expect(body.messages?.at(-1)).toEqual({ role: 'user', content: 'hello' });
  });

  it('throws before fetch when hosted auth has no ID token', async () => {
    const { runChatTurn, session } = await loadHostedChat();
    session.setIdToken(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      runChatTurn({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow(/missing a Cognito ID token/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('triggers the unauthorized handler on proxy 401s', async () => {
    const { runChatTurn, session } = await loadHostedChat();
    session.setIdToken('expired.jwt.token');
    const unauthorized = vi.fn();
    session.setUnauthorizedHandler(unauthorized);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: 'Invalid or expired token.' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    await expect(
      runChatTurn({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow('Invalid or expired token.');
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });
});
