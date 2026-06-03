import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LANDROID_PROXY_GUARD_SYSTEM,
  MAX_REQUEST_BODY_BYTES,
} from '../request-policy.js';

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
const trackUsageMock = vi.fn<(sub: string, day: string, tokens: number) => Promise<number>>();

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

function logEvents(): Array<Record<string, unknown>> {
  return vi.mocked(console.log).mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);
}

function chatEvent(body: Record<string, unknown>, token = 'good-token'): LambdaUrlEvent {
  return {
    requestContext: { http: { method: 'POST', path: '/chat/completions' } },
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  };
}

function validChatBody(messages = [{ role: 'user', content: 'hello' }]): Record<string, unknown> {
  return {
    model: 'client-choice-will-be-overwritten',
    stream: true,
    messages,
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

  vi.doMock('../usage-store.js', () => ({
    DynamoDbUsageStore: class {
      trackUsage = trackUsageMock;
    },
    InMemoryUsageStore: class {
      trackUsage = trackUsageMock;
    },
  }));

  const mod = await import('../handler.js');
  return mod.handler as HandlerFn;
}

describe('handler integration', () => {
  beforeEach(() => {
    verifyToken.mockReset();
    trackUsageMock.mockReset();
    trackUsageMock.mockResolvedValue(2_068);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.doUnmock('aws-jwt-verify');
    vi.doUnmock('../usage-store.js');
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
    expect(trackUsageMock).not.toHaveBeenCalled();
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

  it('rejects malformed JSON before charging usage or calling upstream OpenAI', async () => {
    verifyToken.mockResolvedValue({ sub: 'cognito-sub-123' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const handler = await loadHandler();
    const stream = makeStream();
    const event = chatEvent({ messages: [] });
    event.body = '{not json';

    await handler(event, stream, {});

    expect(trackUsageMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stream.metadata?.statusCode).toBe(400);
    expect(bodyText(stream)).toContain('Body must be JSON');
  });

  it('rejects oversized request bodies before charging usage or calling upstream OpenAI', async () => {
    verifyToken.mockResolvedValue({ sub: 'cognito-sub-123' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const handler = await loadHandler();
    const stream = makeStream();
    const event = chatEvent({ messages: [] });
    event.body = 'x'.repeat(MAX_REQUEST_BODY_BYTES + 1);

    await handler(event, stream, {});

    expect(trackUsageMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stream.metadata?.statusCode).toBe(413);
    expect(bodyText(stream)).toContain('Request body is too large');
  });

  it.each([
    ['temperature', { temperature: 0.2 }],
    ['tools', { tools: [{ type: 'function', function: { name: 'external_tool' } }] }],
    ['tool_choice', { tool_choice: 'auto' }],
  ])('rejects extra top-level field %s before charging usage or calling upstream OpenAI', async (_name, extra) => {
    verifyToken.mockResolvedValue({ sub: 'cognito-sub-123' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const handler = await loadHandler();
    const stream = makeStream();

    await handler(
      chatEvent({
        model: 'client-choice-will-be-overwritten',
        stream: true,
        messages: [{ role: 'user', content: 'hello' }],
        ...extra,
      }),
      stream,
      {}
    );

    expect(trackUsageMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stream.metadata?.statusCode).toBe(400);
    expect(bodyText(stream)).toContain('Hosted LANDroid AI request body is invalid');
  });

  it('accepts the real client shape, prepends the guard, and applies server-owned OpenAI fields', async () => {
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
        model: 'client-choice-will-be-overwritten',
        stream: true,
        messages: [
          { role: 'system', content: 'LANDroid system prompt' },
          { role: 'system', content: 'LANDroid project context' },
          { role: 'user', content: 'hello' },
        ],
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
    expect(trackUsageMock).toHaveBeenCalledTimes(1);
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
    expect(outbound.stream).toBe(true);
    expect(outbound.messages).toEqual([
      { role: 'system', content: LANDROID_PROXY_GUARD_SYSTEM },
      { role: 'system', content: 'LANDroid system prompt' },
      { role: 'system', content: 'LANDroid project context' },
      { role: 'user', content: 'hello' },
    ]);
    expect(outbound).not.toHaveProperty('store');
    expect(outbound).not.toHaveProperty('temperature');
  });

  it('maps upstream OpenAI auth failures to proxy errors instead of browser sign-out statuses', async () => {
    verifyToken.mockResolvedValue({ sub: 'cognito-sub-123' });
    const fetchMock = vi.fn(async () => new Response('bad server key', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const handler = await loadHandler();
    const stream = makeStream();

    await handler(chatEvent(validChatBody()), stream, {});

    expect(trackUsageMock).toHaveBeenCalledTimes(1);
    expect(stream.metadata?.statusCode).toBe(502);
    expect(bodyText(stream)).toContain('Upstream AI provider authentication failed');
    expect(bodyText(stream)).not.toContain('bad server key');
    const upstreamLog = logEvents().find((event) => event.evt === 'upstream_error');
    expect(upstreamLog).toMatchObject({
      evt: 'upstream_error',
      user: 'cognito-sub-123',
      upstreamStatus: 401,
      status: 502,
    });
    expect(upstreamLog).not.toHaveProperty('bodyPrefix');
    expect(JSON.stringify(upstreamLog)).not.toContain('bad server key');
  });

  it('does not leak upstream OpenAI error bodies to clients or logs', async () => {
    verifyToken.mockResolvedValue({ sub: 'cognito-sub-123' });
    const upstreamError = 'sensitive upstream detail: policy trace id sk-live-secret';
    const fetchMock = vi.fn(async () => new Response(upstreamError, { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const handler = await loadHandler();
    const stream = makeStream();

    await handler(chatEvent(validChatBody()), stream, {});

    expect(trackUsageMock).toHaveBeenCalledTimes(1);
    expect(stream.metadata?.statusCode).toBe(500);
    expect(bodyText(stream)).toContain('Upstream AI provider error.');
    expect(bodyText(stream)).not.toContain(upstreamError);
    expect(bodyText(stream)).not.toContain('policy trace id');
    const upstreamLog = logEvents().find((event) => event.evt === 'upstream_error');
    expect(upstreamLog).toMatchObject({
      evt: 'upstream_error',
      user: 'cognito-sub-123',
      upstreamStatus: 500,
      status: 500,
    });
    expect(upstreamLog).not.toHaveProperty('bodyPrefix');
    expect(JSON.stringify(upstreamLog)).not.toContain(upstreamError);
    expect(JSON.stringify(upstreamLog)).not.toContain('policy trace id');
  });
});
