/**
 * LANDroid AI proxy — Lambda Function URL, response streaming.
 *
 * - Verifies the Cognito ID token on Authorization: Bearer.
 * - Enforces a simple per-user daily token-count ceiling (in-memory; resets on cold start).
 * - Forwards OpenAI-compatible /chat/completions to OpenAI with the server-held key.
 * - Streams the response body byte-for-byte back to the client.
 *
 * Hardcoded policy for POC:
 *   - Model: gpt-4o-mini (any client-supplied model is overridden).
 *   - Max output tokens: 2048.
 *   - Per-user daily ceiling: 500k tokens (cold-start resets — fine for POC).
 */
import { CognitoJwtVerifier } from 'aws-jwt-verify';

declare const awslambda: {
  streamifyResponse: (
    handler: (event: LambdaUrlEvent, responseStream: ResponseStream, context: unknown) => Promise<void>
  ) => unknown;
  HttpResponseStream: {
    from(stream: ResponseStream, metadata: { statusCode: number; headers?: Record<string, string> }): ResponseStream;
  };
};

interface LambdaUrlEvent {
  requestContext: { http: { method: string; path: string } };
  headers: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}

interface ResponseStream {
  write(chunk: string | Uint8Array): boolean;
  end(): void;
  setContentType?(type: string): void;
}

const COGNITO_USER_POOL_ID = requireEnv('COGNITO_USER_POOL_ID');
const COGNITO_CLIENT_ID = requireEnv('COGNITO_CLIENT_ID');
const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');

const HARDCODED_MODEL = 'gpt-4o-mini';
const MAX_OUTPUT_TOKENS = 2048;
const DAILY_TOKEN_CEILING = 500_000;
// Rough tokens-per-character ratio for English text. Used to size-estimate
// the request before forwarding so we can enforce the daily ceiling on a
// real number instead of the completion-tokens header that OpenAI doesn't
// actually emit. Deliberately slightly generous (3.5 vs ~4) to over-count.
const CHARS_PER_TOKEN = 3.5;

const verifier = CognitoJwtVerifier.create({
  userPoolId: COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: COGNITO_CLIENT_ID,
});

const userUsage = new Map<string, { day: string; tokens: number }>();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function trackUsage(sub: string, tokens: number): { underCeiling: boolean; dayTotal: number } {
  const day = today();
  const existing = userUsage.get(sub);
  const bucket = existing && existing.day === day ? existing : { day, tokens: 0 };
  bucket.tokens += tokens;
  userUsage.set(sub, bucket);
  return { underCeiling: bucket.tokens <= DAILY_TOKEN_CEILING, dayTotal: bucket.tokens };
}

function estimateInputTokens(rawBody: string): number {
  // The request body is mostly the chat message payload. Dividing by
  // CHARS_PER_TOKEN over-counts vs OpenAI's real tokenizer — which is the
  // safe direction for a hard ceiling.
  return Math.ceil(rawBody.length / CHARS_PER_TOKEN) + MAX_OUTPUT_TOKENS;
}

function logEvent(event: Record<string, unknown>): void {
  // One JSON object per line — CloudWatch Logs Insights parses this
  // automatically. Emit to stdout instead of stderr so ERROR-level parsing
  // in AWS console doesn't flag routine events.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...event }));
}

function jsonError(stream: ResponseStream, status: number, message: string): void {
  const framed = awslambda.HttpResponseStream.from(stream, {
    statusCode: status,
    headers: { 'content-type': 'application/json' },
  });
  framed.write(JSON.stringify({ error: { message, type: 'landroid_proxy_error' } }));
  framed.end();
}

export const handler = awslambda.streamifyResponse(
  async (event: LambdaUrlEvent, responseStream: ResponseStream): Promise<void> => {
    const startedAt = Date.now();
    let userSub: string | null = null;
    try {
      const method = event.requestContext.http.method;
      const path = event.requestContext.http.path;

      if (method !== 'POST' || !path.endsWith('/chat/completions')) {
        logEvent({ evt: 'reject', reason: 'not_found', method, path, status: 404 });
        return jsonError(responseStream, 404, 'Not found.');
      }

      const auth = event.headers['authorization'] ?? event.headers['Authorization'];
      if (!auth?.startsWith('Bearer ')) {
        logEvent({ evt: 'reject', reason: 'missing_bearer', status: 401 });
        return jsonError(responseStream, 401, 'Missing Authorization bearer token.');
      }

      let payload: { sub: string };
      try {
        payload = (await verifier.verify(auth.slice('Bearer '.length))) as { sub: string };
      } catch {
        logEvent({ evt: 'reject', reason: 'invalid_token', status: 401 });
        return jsonError(responseStream, 401, 'Invalid or expired token.');
      }
      userSub = payload.sub;

      const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
        : event.body ?? '';

      const estimatedTokens = estimateInputTokens(rawBody);
      const ceilingCheck = trackUsage(payload.sub, estimatedTokens);
      if (!ceilingCheck.underCeiling) {
        logEvent({
          evt: 'reject',
          reason: 'daily_ceiling',
          user: payload.sub,
          dayTotal: ceilingCheck.dayTotal,
          ceiling: DAILY_TOKEN_CEILING,
          status: 429,
        });
        return jsonError(responseStream, 429, 'Daily token ceiling reached. Try again tomorrow.');
      }

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(rawBody);
      } catch {
        logEvent({ evt: 'reject', reason: 'bad_json', user: payload.sub, status: 400 });
        return jsonError(responseStream, 400, 'Body must be JSON.');
      }

      body.model = HARDCODED_MODEL;
      body.max_tokens = Math.min(
        typeof body.max_tokens === 'number' ? body.max_tokens : MAX_OUTPUT_TOKENS,
        MAX_OUTPUT_TOKENS
      );
      body.user = payload.sub;

      const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${OPENAI_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        logEvent({
          evt: 'upstream_error',
          user: payload.sub,
          upstreamStatus: upstream.status,
          bodyPrefix: errText.slice(0, 200),
        });
        return jsonError(responseStream, upstream.status, `Upstream error: ${errText.slice(0, 500)}`);
      }

      const framed = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          'content-type': upstream.headers.get('content-type') ?? 'text/event-stream',
          'cache-control': 'no-store',
        },
      });

      const reader = upstream.body?.getReader();
      if (!reader) {
        framed.end();
        logEvent({
          evt: 'request',
          user: payload.sub,
          status: 200,
          estimatedTokens,
          dayTotal: ceilingCheck.dayTotal,
          latencyMs: Date.now() - startedAt,
          streamed: false,
        });
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) framed.write(value);
      }
      framed.end();

      logEvent({
        evt: 'request',
        user: payload.sub,
        status: 200,
        estimatedTokens,
        dayTotal: ceilingCheck.dayTotal,
        latencyMs: Date.now() - startedAt,
        streamed: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logEvent({
        evt: 'handler_error',
        user: userSub,
        message,
        latencyMs: Date.now() - startedAt,
      });
      try {
        jsonError(responseStream, 500, `Proxy error: ${message}`);
      } catch {
        /* stream may already be closed */
      }
    }
  }
);
