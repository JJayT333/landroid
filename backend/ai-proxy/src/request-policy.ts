/**
 * Pure policy decisions for the AI proxy.
 *
 * Extracted from `handler.ts` so the routing, auth, body, and token-policy
 * logic can be unit-tested without mocking the Lambda streaming runtime
 * or the `awslambda` global. The handler still owns the actual stream
 * plumbing.
 */

export const HARDCODED_MODEL = 'gpt-4o-mini';
export const MAX_OUTPUT_TOKENS = 2048;
export const DAILY_TOKEN_CEILING = 500_000;
// Rough tokens-per-character ratio for English text. Used to size-estimate
// the request before forwarding so we can enforce the daily ceiling on a
// real number instead of the completion-tokens header that OpenAI doesn't
// actually emit. Deliberately slightly generous (3.5 vs ~4) to over-count.
export const CHARS_PER_TOKEN = 3.5;

export function routeMatches(method: string, path: string): boolean {
  return method === 'POST' && path.endsWith('/chat/completions');
}

/**
 * Returns the bearer token if the headers carry a properly formatted
 * Authorization value, otherwise null. Header lookup is case-tolerant
 * (Lambda URL events sometimes preserve original casing, sometimes lower).
 */
export function extractBearer(headers: Record<string, string>): string | null {
  const auth = headers['authorization'] ?? headers['Authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export function decodeBody(body: string | undefined, isBase64Encoded: boolean | undefined): string {
  if (!body) return '';
  if (isBase64Encoded) return Buffer.from(body, 'base64').toString('utf8');
  return body;
}

export function estimateInputTokens(rawBody: string): number {
  return Math.ceil(rawBody.length / CHARS_PER_TOKEN) + MAX_OUTPUT_TOKENS;
}

/**
 * Server-side policy applied to every accepted request before it leaves
 * the proxy. The model is hardcoded so a client can't escalate to a more
 * expensive model. `max_tokens` is clamped down — never up — so a client
 * cannot ask for more than the per-request cap. `user` is overwritten
 * with the verified Cognito sub so OpenAI's abuse signals are tied to a
 * real identity rather than whatever the client claimed.
 */
export function applyBodyPolicy(
  body: Record<string, unknown>,
  sub: string
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  out.model = HARDCODED_MODEL;
  const requested = typeof out.max_tokens === 'number' ? out.max_tokens : MAX_OUTPUT_TOKENS;
  out.max_tokens = Math.min(requested, MAX_OUTPUT_TOKENS);
  out.user = sub;
  return out;
}

export function parseJsonBody(rawBody: string): { ok: true; body: Record<string, unknown> } | { ok: false } {
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, body: parsed as Record<string, unknown> };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
