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
export const MAX_REQUEST_BODY_BYTES = 256 * 1024;
export const DAILY_TOKEN_CEILING = 500_000;
export const LANDROID_PROXY_GUARD_SYSTEM =
  'You are the LANDroid title assistant. Use only the provided LANDroid project context; do not act as a general-purpose assistant.';
// Rough tokens-per-character ratio for English text. Used to size-estimate
// the request before forwarding so we can enforce the daily ceiling on a
// real number instead of the completion-tokens header that OpenAI doesn't
// actually emit. Deliberately slightly generous (3.5 vs ~4) to over-count.
export const CHARS_PER_TOKEN = 3.5;

type ChatPolicyValidation =
  | { ok: true }
  | { ok: false; status: 400; reason: string; message: string };

const INVALID_LANDROID_CHAT_REQUEST_MESSAGE =
  'Hosted LANDroid AI request body is invalid.';

const LANDROID_CHAT_V1_ALLOWED_TOP_LEVEL_FIELDS = new Set([
  'model',
  'stream',
  'messages',
]);
const LANDROID_CHAT_V1_ALLOWED_MESSAGE_FIELDS = new Set(['role', 'content']);
const LANDROID_CHAT_V1_ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);
const LANDROID_CHAT_V1_MAX_MESSAGES = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rejectV1(reason: string): ChatPolicyValidation {
  return {
    ok: false,
    status: 400,
    reason,
    message: INVALID_LANDROID_CHAT_REQUEST_MESSAGE,
  };
}

// To add a future hosted AI mode, add a new named request shape + branch here;
// do not loosen v1.
export const LANDROID_CHAT_REQUEST_V1 = {
  allowedTopLevelFields: LANDROID_CHAT_V1_ALLOWED_TOP_LEVEL_FIELDS,
  maxMessages: LANDROID_CHAT_V1_MAX_MESSAGES,
  validate(body: Record<string, unknown>): ChatPolicyValidation {
    for (const key of Object.keys(body)) {
      if (!LANDROID_CHAT_V1_ALLOWED_TOP_LEVEL_FIELDS.has(key)) {
        return rejectV1('client_field_not_allowed');
      }
    }

    if (typeof body.model !== 'string' || body.model.trim().length === 0) {
      return rejectV1('invalid_model');
    }
    if (body.stream !== true) {
      return rejectV1('invalid_stream');
    }
    if (!Array.isArray(body.messages)) {
      return rejectV1('invalid_messages');
    }
    if (body.messages.length === 0) {
      return rejectV1('empty_messages');
    }
    if (body.messages.length > LANDROID_CHAT_V1_MAX_MESSAGES) {
      return rejectV1('too_many_messages');
    }

    for (const message of body.messages) {
      if (!isRecord(message)) {
        return rejectV1('invalid_message_shape');
      }
      const messageKeys = Object.keys(message);
      if (
        messageKeys.length !== LANDROID_CHAT_V1_ALLOWED_MESSAGE_FIELDS.size ||
        !messageKeys.every((key) => LANDROID_CHAT_V1_ALLOWED_MESSAGE_FIELDS.has(key))
      ) {
        return rejectV1('invalid_message_shape');
      }
      if (
        typeof message.role !== 'string' ||
        !LANDROID_CHAT_V1_ALLOWED_ROLES.has(message.role)
      ) {
        return rejectV1('invalid_message_role');
      }
      if (typeof message.content !== 'string' || message.content.trim().length === 0) {
        return rejectV1('invalid_message_content');
      }
    }

    return { ok: true };
  },
} as const;

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

export function bodyByteLength(body: string | undefined, isBase64Encoded: boolean | undefined): number {
  if (!body) return 0;
  return Buffer.byteLength(body, isBase64Encoded ? 'base64' : 'utf8');
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
  const out: Record<string, unknown> = {};
  if (body.stream !== undefined) out.stream = body.stream;
  out.messages = [
    { role: 'system', content: LANDROID_PROXY_GUARD_SYSTEM },
    ...(Array.isArray(body.messages)
      ? body.messages.map((message) => {
          const item = isRecord(message) ? message : {};
          return { role: item.role, content: item.content };
        })
      : []),
  ];
  out.model = HARDCODED_MODEL;
  const requested =
    typeof body.max_tokens === 'number' && Number.isFinite(body.max_tokens) && body.max_tokens > 0
      ? Math.floor(body.max_tokens)
      : MAX_OUTPUT_TOKENS;
  out.max_tokens = Math.min(requested, MAX_OUTPUT_TOKENS);
  out.user = sub;
  return out;
}

export function validateBodyPolicy(
  body: Record<string, unknown>
):
  | { ok: true }
  | { ok: false; status: number; reason: string; message: string } {
  return LANDROID_CHAT_REQUEST_V1.validate(body);
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
