import { describe, expect, it } from 'vitest';
import {
  applyBodyPolicy,
  bodyByteLength,
  decodeBody,
  estimateInputTokens,
  extractBearer,
  HARDCODED_MODEL,
  LANDROID_CHAT_REQUEST_V1,
  LANDROID_PROXY_GUARD_SYSTEM,
  MAX_OUTPUT_TOKENS,
  MAX_REQUEST_BODY_BYTES,
  parseJsonBody,
  routeMatches,
  validateBodyPolicy,
} from '../request-policy.js';

describe('routeMatches', () => {
  it('accepts POST /v1/chat/completions and POST /chat/completions', () => {
    expect(routeMatches('POST', '/v1/chat/completions')).toBe(true);
    expect(routeMatches('POST', '/chat/completions')).toBe(true);
  });
  it('rejects non-POST methods', () => {
    expect(routeMatches('GET', '/chat/completions')).toBe(false);
    expect(routeMatches('OPTIONS', '/chat/completions')).toBe(false);
  });
  it('rejects unknown paths', () => {
    expect(routeMatches('POST', '/')).toBe(false);
    expect(routeMatches('POST', '/healthz')).toBe(false);
  });
});

describe('extractBearer', () => {
  it('reads either lower-case or capitalised Authorization header', () => {
    expect(extractBearer({ authorization: 'Bearer abc' })).toBe('abc');
    expect(extractBearer({ Authorization: 'Bearer xyz' })).toBe('xyz');
  });
  it('returns null when missing', () => {
    expect(extractBearer({})).toBeNull();
  });
  it('returns null when not a Bearer scheme', () => {
    expect(extractBearer({ authorization: 'Basic dGVzdA==' })).toBeNull();
    expect(extractBearer({ authorization: 'token' })).toBeNull();
  });
  it('returns null when the bearer body is empty', () => {
    expect(extractBearer({ authorization: 'Bearer ' })).toBeNull();
    expect(extractBearer({ authorization: 'Bearer    ' })).toBeNull();
  });
});

describe('decodeBody', () => {
  it('returns plain text when not base64', () => {
    expect(decodeBody('hello', false)).toBe('hello');
  });
  it('base64-decodes when flagged', () => {
    const encoded = Buffer.from('{"x":1}').toString('base64');
    expect(decodeBody(encoded, true)).toBe('{"x":1}');
  });
  it('returns empty string for missing body', () => {
    expect(decodeBody(undefined, false)).toBe('');
    expect(decodeBody(undefined, true)).toBe('');
  });
});

describe('bodyByteLength', () => {
  it('measures UTF-8 request bodies before parsing', () => {
    expect(bodyByteLength('hello', false)).toBe(5);
    expect(bodyByteLength(undefined, false)).toBe(0);
  });

  it('measures decoded bytes for base64 request bodies', () => {
    const encoded = Buffer.from('{"x":1}').toString('base64');
    expect(bodyByteLength(encoded, true)).toBe(7);
  });

  it('documents the explicit proxy request cap', () => {
    expect(MAX_REQUEST_BODY_BYTES).toBe(256 * 1024);
  });
});

describe('estimateInputTokens', () => {
  it('over-counts vs OpenAI tokenizer (ceiling-safe direction)', () => {
    // 70 chars / 3.5 = 20 input + 2048 output = 2068
    expect(estimateInputTokens('a'.repeat(70))).toBe(20 + MAX_OUTPUT_TOKENS);
  });
  it('counts the full max-output cap on every request', () => {
    expect(estimateInputTokens('')).toBe(MAX_OUTPUT_TOKENS);
  });
});

describe('parseJsonBody', () => {
  it('accepts a JSON object and returns the parsed body', () => {
    const result = parseJsonBody('{"messages":[]}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.messages).toEqual([]);
  });
  it('rejects malformed JSON', () => {
    expect(parseJsonBody('{not json').ok).toBe(false);
    expect(parseJsonBody('').ok).toBe(false);
  });
  it('rejects JSON arrays and primitives (only objects accepted)', () => {
    expect(parseJsonBody('[1,2,3]').ok).toBe(false);
    expect(parseJsonBody('"hello"').ok).toBe(false);
    expect(parseJsonBody('42').ok).toBe(false);
    expect(parseJsonBody('null').ok).toBe(false);
  });
});

describe('applyBodyPolicy', () => {
  it('accepts the real hosted client shape and prepends the server guard message', () => {
    const out = applyBodyPolicy(
      {
        model: 'client-choice-will-be-overwritten',
        stream: true,
        messages: [
          { role: 'system', content: 'LANDroid browser context' },
          { role: 'user', content: 'Summarize title status.' },
          { role: 'assistant', content: 'Prior assistant context.' },
        ],
      },
      'real-sub-from-cognito'
    );

    expect(out.model).toBe(HARDCODED_MODEL);
    expect(out.max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(out.user).toBe('real-sub-from-cognito');
    expect(out.stream).toBe(true);
    expect(out.messages).toEqual([
      { role: 'system', content: LANDROID_PROXY_GUARD_SYSTEM },
      { role: 'system', content: 'LANDroid browser context' },
      { role: 'user', content: 'Summarize title status.' },
      { role: 'assistant', content: 'Prior assistant context.' },
    ]);
  });

  it('clamps max_tokens downward when a trusted server branch supplies it', () => {
    const out = applyBodyPolicy(
      {
        model: 'client-choice-will-be-overwritten',
        stream: true,
        max_tokens: 99_999,
        messages: [{ role: 'user', content: 'hello' }],
      },
      'sub'
    );

    expect(out.max_tokens).toBe(MAX_OUTPUT_TOKENS);
  });

  it('accepts a smaller max_tokens from a trusted server branch', () => {
    const out = applyBodyPolicy({ max_tokens: 100 }, 'sub');
    expect(out.max_tokens).toBe(100);
  });

  it('defaults max_tokens to the cap when not supplied or not numeric', () => {
    expect(applyBodyPolicy({}, 'sub').max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(
      applyBodyPolicy({ max_tokens: 'not-a-number' as unknown as number }, 'sub').max_tokens
    ).toBe(MAX_OUTPUT_TOKENS);
  });

  it('defaults max_tokens to the cap when supplied value is non-finite or non-positive', () => {
    expect(applyBodyPolicy({ max_tokens: Number.NaN }, 'sub').max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(applyBodyPolicy({ max_tokens: -1 }, 'sub').max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(applyBodyPolicy({ max_tokens: 0 }, 'sub').max_tokens).toBe(MAX_OUTPUT_TOKENS);
  });

  it('does not pass through non-contract top-level fields', () => {
    const out = applyBodyPolicy(
      {
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
        temperature: 0.2,
        tools: [],
        store: true,
        metadata: { caseId: 'should-not-pass-through' },
      },
      'sub'
    );

    expect(out).toMatchObject({
      stream: true,
      model: HARDCODED_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      user: 'sub',
    });
    expect(out.messages).toEqual([
      { role: 'system', content: LANDROID_PROXY_GUARD_SYSTEM },
      { role: 'user', content: 'hello' },
    ]);
    expect(out).not.toHaveProperty('temperature');
    expect(out).not.toHaveProperty('tools');
    expect(out).not.toHaveProperty('store');
    expect(out).not.toHaveProperty('metadata');
  });

  it('keeps the v1 contract intentionally narrow', () => {
    expect([...LANDROID_CHAT_REQUEST_V1.allowedTopLevelFields]).toEqual([
      'model',
      'stream',
      'messages',
    ]);
    expect(LANDROID_CHAT_REQUEST_V1.maxMessages).toBe(50);
  });

  it('does not mutate the input body', () => {
    const input = {
      model: 'foo',
      stream: true,
      messages: [{ role: 'user', content: 'hello' }],
    };
    const out = applyBodyPolicy(input, 'sub');
    expect(input.model).toBe('foo');
    expect(out).not.toBe(input);
    expect(out.messages).not.toBe(input.messages);
  });
});

describe('validateBodyPolicy', () => {
  it('accepts the current hosted read-only chat body shape', () => {
    expect(
      validateBodyPolicy({
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
        model: 'client-choice-will-be-overwritten',
      })
    ).toEqual({ ok: true });
  });

  it.each([
    ['temperature', { temperature: 0.2 }],
    ['tools', { tools: [] }],
    ['tool_choice', { tool_choice: 'auto' }],
    ['max_tokens', { max_tokens: 100 }],
    ['user', { user: 'spoofed' }],
  ])('rejects extra top-level field %s', (_name, extra) => {
    expect(
      validateBodyPolicy({
        model: 'client-choice-will-be-overwritten',
        stream: true,
        messages: [{ role: 'user', content: 'hello' }],
        ...extra,
      })
    ).toMatchObject({
      ok: false,
      status: 400,
      reason: 'client_field_not_allowed',
      message: 'Hosted LANDroid AI request body is invalid.',
    });
  });

  it.each([
    ['tool role', [{ role: 'tool', content: 'hello' }]],
    ['function role', [{ role: 'function', content: 'hello' }]],
    ['unknown role', [{ role: 'developer', content: 'hello' }]],
    ['array content', [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]],
    ['non-string content', [{ role: 'user', content: { text: 'hello' } }]],
    ['missing content', [{ role: 'user' }]],
    ['empty content', [{ role: 'user', content: '   ' }]],
    ['extra message field', [{ role: 'user', content: 'hello', name: 'caller' }]],
  ])('rejects invalid v1 message shape: %s', (_name, messages) => {
    expect(
      validateBodyPolicy({
        model: 'client-choice-will-be-overwritten',
        stream: true,
        messages,
      })
    ).toMatchObject({
      ok: false,
      status: 400,
      message: 'Hosted LANDroid AI request body is invalid.',
    });
  });

  it('rejects an empty messages array', () => {
    expect(
      validateBodyPolicy({
        model: 'client-choice-will-be-overwritten',
        stream: true,
        messages: [],
      })
    ).toMatchObject({
      ok: false,
      status: 400,
      reason: 'empty_messages',
    });
  });

  it('rejects more than 50 messages', () => {
    expect(
      validateBodyPolicy({
        model: 'client-choice-will-be-overwritten',
        stream: true,
        messages: Array.from({ length: 51 }, () => ({ role: 'user', content: 'hello' })),
      })
    ).toMatchObject({
      ok: false,
      status: 400,
      reason: 'too_many_messages',
    });
  });
});
