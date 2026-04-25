/**
 * Per-user daily token-usage store.
 *
 * Audit M-4: the original in-memory `Map` reset on every Lambda cold
 * start, so a user near the daily ceiling could simply wait a few minutes
 * for a fresh container to refill. The DynamoDB-backed implementation
 * keeps the counter durable and shared across concurrent invocations.
 *
 * The handler picks `DynamoDbUsageStore` when `USAGE_TABLE_NAME` is set,
 * otherwise falls back to `InMemoryUsageStore` so a deployment without
 * the DDB table provisioned still works (with the cold-start caveat).
 */
import {
  DynamoDBClient,
  UpdateItemCommand,
  type UpdateItemCommandInput,
} from '@aws-sdk/client-dynamodb';

export interface UsageStore {
  /**
   * Add `tokens` to the running total for `sub` on `day` (UTC `YYYY-MM-DD`).
   * Returns the new running total and whether it remains under the ceiling.
   * The ceiling is the caller's policy — the store just reports the total.
   */
  trackUsage(sub: string, day: string, tokens: number): Promise<number>;
}

export class InMemoryUsageStore implements UsageStore {
  private readonly buckets = new Map<string, { day: string; tokens: number }>();

  async trackUsage(sub: string, day: string, tokens: number): Promise<number> {
    const existing = this.buckets.get(sub);
    const bucket = existing && existing.day === day ? existing : { day, tokens: 0 };
    bucket.tokens += tokens;
    this.buckets.set(sub, bucket);
    return bucket.tokens;
  }
}

export interface DynamoDbUsageStoreConfig {
  tableName: string;
  /** TTL in seconds from "now" before the row is auto-deleted. Default 48h. */
  ttlSeconds?: number;
  /** Injectable for tests. */
  client?: Pick<DynamoDBClient, 'send'>;
  /** Injectable for tests; defaults to Date.now(). */
  now?: () => number;
}

/**
 * DynamoDB schema:
 *   PK `sub`        (S, partition key)
 *   SK `day`        (S, sort key — UTC date)
 *   attr `tokens`   (N, atomic ADD'd per call)
 *   attr `ttl`      (N, epoch seconds — table TTL set on `ttl`)
 *
 * The `ADD tokens :n` update expression both creates the row when missing
 * and increments atomically when present, so we only need a single round
 * trip per call and never deal with conditional writes / retries.
 */
export class DynamoDbUsageStore implements UsageStore {
  private readonly client: Pick<DynamoDBClient, 'send'>;
  private readonly tableName: string;
  private readonly ttlSeconds: number;
  private readonly now: () => number;

  constructor(config: DynamoDbUsageStoreConfig) {
    this.client = config.client ?? new DynamoDBClient({});
    this.tableName = config.tableName;
    this.ttlSeconds = config.ttlSeconds ?? 48 * 60 * 60;
    this.now = config.now ?? (() => Date.now());
  }

  async trackUsage(sub: string, day: string, tokens: number): Promise<number> {
    const ttlEpochSeconds = Math.floor(this.now() / 1000) + this.ttlSeconds;
    const input: UpdateItemCommandInput = {
      TableName: this.tableName,
      Key: {
        sub: { S: sub },
        day: { S: day },
      },
      UpdateExpression: 'ADD tokens :n SET #ttl = :ttl',
      ExpressionAttributeNames: {
        '#ttl': 'ttl',
      },
      ExpressionAttributeValues: {
        ':n': { N: String(tokens) },
        ':ttl': { N: String(ttlEpochSeconds) },
      },
      ReturnValues: 'UPDATED_NEW',
    };
    const result = await this.client.send(new UpdateItemCommand(input));
    const totalText = result.Attributes?.tokens?.N;
    if (!totalText) {
      // Should not happen with ReturnValues=UPDATED_NEW on an ADD. Fall
      // back to the increment alone so the caller still gets a number.
      return tokens;
    }
    return Number(totalText);
  }
}
