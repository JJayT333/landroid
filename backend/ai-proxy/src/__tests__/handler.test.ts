import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type LambdaUrlEvent = {
  requestContext: { http: { method: string; path: string } };
  headers: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
};

type TestResponseStream = {
  chunks: Array<string | Uint8Array>;
  ended: boolean;
  metadata: { statusCode: number; headers?: Record<string, string> } | null;
  write: (chunk: string | Uint8Array) => boolean;
  end: () => void;
};

type HandlerFn = (event: LambdaUrlEvent, responseStream: TestResponseStream, context: unknown) => Promise<void>;

const verifyToken = vi.fn<(token: string) => Promise<{ sub: string }>>();

function makeStream(): TestResponseStream {
  return {
    chunks: [],
    ended: false,
    metadata: null,
    write(chunk) {
      this.chunks.push(chunk);
      return true;
    },
    end() {
      this.ended = true;
    },
  };
}

function bodyText(stream: TestResponseStream): string {
  const decoder = new TextDecoder();
  return stream.chunks
    .map((chunk) => (typeof chunk === 'string' ? chunk : decoder.decode(chunk)))
    .join('');
}

function chatEvent(body: Record<string, unknown>, token = 'good-token'): LambdaUrlEvent {
  return {
    requestContext: { http: { method: 'POST', path: '/chat/completions' } },
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  };
}

function installAwsLambdaStub(): void {
  vi.stubGlobal('awslambda', {
    streamifyResponse: (fn: HandlerFn) => fn,
    HttpResponseStream: {
      from(stream: TestResponseStream, metadata: TestResponseStream['metadata']) {
        stream.metadata = metadata;
        return stream;
      },
    },
  });
}

async function loadHandler(): Promise<HandlerFn> {
  vi.resetModules();
  vi.stubEnv('COGNITO_USER_POOL_ID', 'us-east-1_test');
  vi.stubEnv('COGNITO_CLIENT_ID', 'client-123');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('USAGE_TABLE_NAME', '');
  vi.stubEnv('ALLOW_IN_MEMORY_USAGE_STORE', 'true');

  installAwsLambdaStub();

  vi.doMock('aws-jwt-verify', () => ({
    CognitoJwtVerifier: {
      create: () => ({
        verify: verifyToken,
      }),
    },
  }));

  const mod = await import('../handler.js');
  return mod.handler as HandlerFn;
}

describe('handler integration', () => {
  beforeEach(() => {
    verifyToken.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.doUnmock('aws-jwt-verify');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('rejects an invalid Cognito JWT before calling upstream OpenAI', async () => {
    verifyToken.mockRejectedValue(new Error('bad token'));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const handler = await loadHandler();
    const stream = makeStream();

    await handler(chatEvent({ messages: [] }, 'bad-token'), stream, {});

    expect(verifyToken).toHaveBeenCalledWith('bad-token');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stream.metadata?.statusCode).toBe(401);
    expect(bodyText(stream)).toContain('Invalid or expired token');
    expect(stream.ended).toBe(true);
  });

  it('fails fast unless durable usage tracking or explicit local fallback is configured', async () => {
    vi.resetModules();
    vi.stubEnv('COGNITO_USER_POOL_ID', 'us-east-1_test');
    vi.stubEnv('COGNITO_CLIENT_ID', 'client-123');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    vi.stubEnv('USAGE_TABLE_NAME', '');
    vi.stubEnv('ALLOW_IN_MEMORY_USAGE_STORE', '');
    installAwsLambdaStub();

    await expect(import('../handler.js')).rejects.toThrow(/USAGE_TABLE_NAME/);
  });

  it('pins the verified sub onto the OpenAI body and streams the upstream response', async () => {
    verifyToken.mockResolvedValue({ sub: 'cognito-sub-123' });
    const upstreamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: first\n\n'));
        controller.enqueue(new TextEncoder().encode('data: second\n\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn(async () => new Response(upstreamBody, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const handler = await loadHandler();
    const stream = makeStream();

    await handler(
      chatEvent({
        model: 'gpt-9000',
        max_tokens: 99_999,
        user: 'spoofed-user',
        messages: [{ role: 'user', content: 'hello' }],
      }),
      stream,
      {}
    );

    expect(stream.metadata).toMatchObject({
      statusCode: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
      },
    });
    expect(bodyText(stream)).toBe('data: first\n\ndata: second\n\n');
    expect(stream.ended).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers).toMatchObject({
      authorization: 'Bearer sk-test',
      'content-type': 'application/json',
    });
    const outbound = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(outbound).toMatchObject({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      user: 'cognito-sub-123',
    });
  });
});
