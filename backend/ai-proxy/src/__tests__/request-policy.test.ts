import { describe, expect, it } from 'vitest';
import {
  applyBodyPolicy,
  decodeBody,
  estimateInputTokens,
  extractBearer,
  HARDCODED_MODEL,
  MAX_OUTPUT_TOKENS,
  parseJsonBody,
  routeMatches,
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
  it('forces the hardcoded model, clamps max_tokens, and sets user to the verified sub', () => {
    const out = applyBodyPolicy(
      { model: 'gpt-9000', max_tokens: 99_999, user: 'imposter', messages: [] },
      'real-sub-from-cognito'
    );
    expect(out.model).toBe(HARDCODED_MODEL);
    expect(out.max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(out.user).toBe('real-sub-from-cognito');
    expect(out.messages).toEqual([]);
  });

  it('accepts a smaller max_tokens (clamp is downward only)', () => {
    const out = applyBodyPolicy({ max_tokens: 100 }, 'sub');
    expect(out.max_tokens).toBe(100);
  });

  it('defaults max_tokens to the cap when not supplied or not numeric', () => {
    expect(applyBodyPolicy({}, 'sub').max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(
      applyBodyPolicy({ max_tokens: 'not-a-number' as unknown as number }, 'sub').max_tokens
    ).toBe(MAX_OUTPUT_TOKENS);
  });

  it('does not mutate the input body', () => {
    const input = { model: 'foo' };
    const out = applyBodyPolicy(input, 'sub');
    expect(input.model).toBe('foo');
    expect(out).not.toBe(input);
  });
});
