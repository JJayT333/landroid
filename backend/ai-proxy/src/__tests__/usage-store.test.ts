import { describe, expect, it, vi } from 'vitest';
import {
  DynamoDbUsageStore,
  InMemoryUsageStore,
} from '../usage-store.js';

describe('InMemoryUsageStore', () => {
  it('accumulates same-day tokens for a user', async () => {
    const store = new InMemoryUsageStore();
    expect(await store.trackUsage('alice', '2026-04-25', 100)).toBe(100);
    expect(await store.trackUsage('alice', '2026-04-25', 50)).toBe(150);
    expect(await store.trackUsage('alice', '2026-04-25', 1)).toBe(151);
  });

  it('isolates totals across users on the same day', async () => {
    const store = new InMemoryUsageStore();
    await store.trackUsage('alice', '2026-04-25', 100);
    expect(await store.trackUsage('bob', '2026-04-25', 7)).toBe(7);
    expect(await store.trackUsage('alice', '2026-04-25', 0)).toBe(100);
  });

  it('rolls a fresh bucket on day change', async () => {
    const store = new InMemoryUsageStore();
    await store.trackUsage('alice', '2026-04-25', 999);
    expect(await store.trackUsage('alice', '2026-04-26', 1)).toBe(1);
  });
});

describe('DynamoDbUsageStore (audit M-4)', () => {
  it('issues an atomic ADD to the configured table and returns the new total', async () => {
    const send = vi.fn().mockResolvedValue({
      Attributes: { tokens: { N: '350' } },
    });
    const store = new DynamoDbUsageStore({
      tableName: 'landroid-ai-usage',
      ttlSeconds: 48 * 60 * 60,
      now: () => 1_000_000_000_000, // fixed epoch ms for deterministic ttl
      client: { send },
    });

    const total = await store.trackUsage('alice', '2026-04-25', 200);
    expect(total).toBe(350);
    expect(send).toHaveBeenCalledTimes(1);

    const command = send.mock.calls[0][0];
    expect(command.input).toMatchObject({
      TableName: 'landroid-ai-usage',
      Key: {
        sub: { S: 'alice' },
        day: { S: '2026-04-25' },
      },
      UpdateExpression: 'ADD tokens :n SET #ttl = :ttl',
      ExpressionAttributeNames: { '#ttl': 'ttl' },
      ExpressionAttributeValues: {
        ':n': { N: '200' },
        // 1_000_000_000 + 48*60*60 = 1_000_172_800
        ':ttl': { N: '1000172800' },
      },
      ReturnValues: 'UPDATED_NEW',
    });
  });

  it('falls back to the increment alone when DDB returns no Attributes', async () => {
    const send = vi.fn().mockResolvedValue({});
    const store = new DynamoDbUsageStore({
      tableName: 't',
      now: () => 0,
      client: { send },
    });
    expect(await store.trackUsage('alice', '2026-04-25', 42)).toBe(42);
  });

  it('uses the default 48h ttl when not overridden', async () => {
    const send = vi.fn().mockResolvedValue({
      Attributes: { tokens: { N: '1' } },
    });
    const store = new DynamoDbUsageStore({
      tableName: 't',
      now: () => 0, // epoch
      client: { send },
    });
    await store.trackUsage('alice', '2026-04-25', 1);
    const command = send.mock.calls[0][0];
    expect(command.input.ExpressionAttributeValues[':ttl']).toEqual({
      N: String(48 * 60 * 60),
    });
  });

  it('propagates errors from the DDB client (caller decides how to fail)', async () => {
    const send = vi.fn().mockRejectedValue(new Error('throttled'));
    const store = new DynamoDbUsageStore({
      tableName: 't',
      now: () => 0,
      client: { send },
    });
    await expect(store.trackUsage('alice', '2026-04-25', 1)).rejects.toThrow('throttled');
  });
});
