import { ZodError, z } from 'zod';
import {
  BACKEND_SPINE_CONTRACT_VERSION,
  BackendSpineHealthResponseSchema,
  BackendSpineRecordValidationRequestSchema,
  BackendSpineRecordValidationResponseSchema,
  BackendSpineSessionResponseSchema,
  type BackendSpineHealthResponse,
  type BackendSpineRecordValidationResponse,
  type BackendSpineSessionResponse,
  type BackendSpineValidationIssue,
} from '../../../src/backend-spine/contracts.js';

export const MAX_BACKEND_SPINE_REQUEST_BODY_BYTES = 256 * 1024;

export interface BackendSpineHttpEvent {
  requestContext?: { http?: { method?: string; path?: string } };
  httpMethod?: string;
  rawPath?: string;
  path?: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

export interface BackendSpineHttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface BackendSpineTokenPayload {
  sub: string;
}

export type BackendSpineLogEvent = Record<string, unknown>;
export type BackendSpineLogger = (event: BackendSpineLogEvent) => void;

export interface BackendSpineHandlerDeps {
  verifyToken: (token: string) => Promise<BackendSpineTokenPayload>;
  logEvent?: BackendSpineLogger;
  now?: () => Date;
}

const JsonBodySchema = z.object({
  records: z.array(z.unknown()).max(500),
}).strict();

export function createBackendSpineHandler(
  deps: BackendSpineHandlerDeps
): (event: BackendSpineHttpEvent) => Promise<BackendSpineHttpResponse> {
  const now = deps.now ?? (() => new Date());
  const logEvent = deps.logEvent ?? ((event) => {
    // Keep CloudWatch logs structured without ever logging request bodies.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ts: now().toISOString(), ...event }));
  });

  return async (event) => {
    const method = readMethod(event);
    const path = normalizePath(readPath(event));

    if (method === 'GET' && path === '/health') {
      logEvent({ evt: 'request', route: 'health', method, path, status: 200 });
      return jsonResponse(200, health(now));
    }

    if (method === 'GET' && path === '/session') {
      const auth = await authenticate(event, deps.verifyToken);
      if (!auth.ok) {
        logEvent({
          evt: 'reject',
          route: 'session',
          method,
          path,
          reason: auth.reason,
          status: auth.response.statusCode,
        });
        return auth.response;
      }
      logEvent({
        evt: 'request',
        route: 'session',
        method,
        path,
        user: auth.payload.sub,
        status: 200,
      });
      return jsonResponse(200, session(now, auth.payload.sub));
    }

    if (method === 'POST' && path === '/validate-records') {
      const requestBodyBytes = bodyByteLength(event.body, event.isBase64Encoded);
      if (requestBodyBytes > MAX_BACKEND_SPINE_REQUEST_BODY_BYTES) {
        logEvent({
          evt: 'reject',
          route: 'validate-records',
          method,
          path,
          reason: 'body_too_large',
          requestBodyBytes,
          limit: MAX_BACKEND_SPINE_REQUEST_BODY_BYTES,
          status: 413,
        });
        return jsonError(413, 'Request body is too large.');
      }

      const auth = await authenticate(event, deps.verifyToken);
      if (!auth.ok) {
        logEvent({
          evt: 'reject',
          route: 'validate-records',
          method,
          path,
          reason: auth.reason,
          status: auth.response.statusCode,
        });
        return auth.response;
      }

      const body = decodeBody(event);
      const parsedJson = parseJson(body);
      if (!parsedJson.ok) {
        logEvent({
          evt: 'reject',
          route: 'validate-records',
          method,
          path,
          user: auth.payload.sub,
          reason: 'bad_json',
          status: 400,
        });
        return jsonError(400, 'Body must be JSON.');
      }

      const records = JsonBodySchema.safeParse(parsedJson.value);
      if (!records.success) {
        logEvent({
          evt: 'reject',
          route: 'validate-records',
          method,
          path,
          user: auth.payload.sub,
          reason: 'bad_validation_request',
          issueCount: records.error.issues.length,
          status: 400,
        });
        return jsonResponse(400, validation(now, false, 0, zodIssuesToValidationIssues(records.error)));
      }

      const result = BackendSpineRecordValidationRequestSchema.safeParse(records.data);
      if (!result.success) {
        logEvent({
          evt: 'reject',
          route: 'validate-records',
          method,
          path,
          user: auth.payload.sub,
          reason: 'record_schema_invalid',
          issueCount: result.error.issues.length,
          status: 400,
        });
        return jsonResponse(400, validation(now, false, 0, zodIssuesToValidationIssues(result.error)));
      }

      logEvent({
        evt: 'request',
        route: 'validate-records',
        method,
        path,
        user: auth.payload.sub,
        acceptedCount: result.data.records.length,
        status: 200,
      });
      return jsonResponse(200, validation(now, true, result.data.records.length, []));
    }

    logEvent({ evt: 'reject', route: 'unknown', method, path, reason: 'not_found', status: 404 });
    return jsonError(404, 'Not found.');
  };
}

function health(now: () => Date): BackendSpineHealthResponse {
  return BackendSpineHealthResponseSchema.parse({
    ok: true,
    service: 'landroid-backend-spine',
    contractVersion: BACKEND_SPINE_CONTRACT_VERSION,
    mode: 'hosted',
    serverTime: now().toISOString(),
  });
}

function session(now: () => Date, userSub: string): BackendSpineSessionResponse {
  return BackendSpineSessionResponseSchema.parse({
    ...health(now),
    authenticated: true,
    userSub,
  });
}

function validation(
  now: () => Date,
  valid: boolean,
  acceptedCount: number,
  issues: BackendSpineValidationIssue[]
): BackendSpineRecordValidationResponse {
  return BackendSpineRecordValidationResponseSchema.parse({
    ...health(now),
    valid,
    acceptedCount,
    issues,
  });
}

async function authenticate(
  event: BackendSpineHttpEvent,
  verifyToken: BackendSpineHandlerDeps['verifyToken']
): Promise<
  | { ok: true; payload: BackendSpineTokenPayload }
  | { ok: false; reason: 'missing_bearer' | 'invalid_token'; response: BackendSpineHttpResponse }
> {
  const token = extractBearer(event.headers ?? {});
  if (!token) {
    return {
      ok: false,
      reason: 'missing_bearer',
      response: jsonError(401, 'Missing Authorization bearer token.'),
    };
  }
  try {
    const payload = await verifyToken(token);
    if (!payload.sub.trim()) {
      return {
        ok: false,
        reason: 'invalid_token',
        response: jsonError(401, 'Invalid or expired token.'),
      };
    }
    return { ok: true, payload };
  } catch {
    return {
      ok: false,
      reason: 'invalid_token',
      response: jsonError(401, 'Invalid or expired token.'),
    };
  }
}

function readMethod(event: BackendSpineHttpEvent): string {
  return (event.requestContext?.http?.method ?? event.httpMethod ?? 'GET').toUpperCase();
}

function readPath(event: BackendSpineHttpEvent): string {
  return event.requestContext?.http?.path ?? event.rawPath ?? event.path ?? '/';
}

function normalizePath(path: string): string {
  const withoutPrefix = path.replace(/^\/api\/spine(?=\/|$)/, '');
  return withoutPrefix === '' ? '/' : withoutPrefix;
}

function extractBearer(headers: Record<string, string | undefined>): string | null {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === 'authorization');
  const value = entry?.[1]?.trim();
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() || null;
}

function bodyByteLength(body: string | null | undefined, isBase64Encoded?: boolean): number {
  if (!body) return 0;
  if (isBase64Encoded) {
    const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
  }
  return Buffer.byteLength(body, 'utf8');
}

function decodeBody(event: BackendSpineHttpEvent): string {
  if (!event.body) return '';
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64').toString('utf8');
  }
  return event.body;
}

function parseJson(body: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return { ok: false };
  }
}

function zodIssuesToValidationIssues(error: ZodError): BackendSpineValidationIssue[] {
  return error.issues.slice(0, 25).map((issue, index) => ({
    index,
    path: issuePath(issue),
    message: issue.message,
  }));
}

function issuePath(issue: ZodError['issues'][number]): Array<string | number> {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys;
  }
  return issue.path.filter((entry): entry is string | number =>
    typeof entry === 'string' || typeof entry === 'number'
  );
}

function jsonResponse(statusCode: number, value: unknown): BackendSpineHttpResponse {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(value),
  };
}

function jsonError(statusCode: number, message: string): BackendSpineHttpResponse {
  return jsonResponse(statusCode, {
    error: {
      message,
      type: 'landroid_backend_spine_error',
    },
  });
}
