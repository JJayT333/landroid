import { getIdToken } from '../auth/session';
import { apiBaseUrl, isHostedMode } from '../utils/deploy-env';
import {
  createHostedBackendSpineAdapter,
  createLocalOnlyBackendSpineAdapter,
  type BackendSpineAdapter,
  type BackendSpineMode,
} from './adapter';
import {
  BACKEND_SPINE_CONTRACT_VERSION,
  ProjectRecordSchema,
  type ProjectRecord,
} from './contracts';

export type BackendSpineContractCheckStatus = 'passed' | 'failed';

export interface BackendSpineContractCheckResult {
  status: BackendSpineContractCheckStatus;
  mode: BackendSpineMode;
  checkedAt: string;
  contractVersion?: number;
  authenticated?: boolean;
  userSub?: string | null;
  acceptedCount?: number;
  error?: string;
}

interface BackendSpineContractCheckOptions {
  adapter?: BackendSpineAdapter;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  getToken?: () => Promise<string | null>;
  isHosted?: () => boolean;
  logger?: Partial<Pick<Console, 'info' | 'warn'>>;
  now?: () => Date;
}

export function createBackendSpineAdapterForApp(
  options: Pick<
    BackendSpineContractCheckOptions,
    'baseUrl' | 'fetchImpl' | 'getToken' | 'isHosted'
  > = {}
): BackendSpineAdapter {
  const hosted = (options.isHosted ?? isHostedMode)();
  if (!hosted) return createLocalOnlyBackendSpineAdapter();

  return createHostedBackendSpineAdapter({
    baseUrl: options.baseUrl ?? `${apiBaseUrl()}/spine`,
    fetchImpl: options.fetchImpl,
    getToken: options.getToken ?? getIdToken,
  });
}

export function createBackendSpineContractProbeRecord(checkedAt: string): ProjectRecord {
  return ProjectRecordSchema.parse({
    recordId: 'contract-probe-project',
    recordType: 'project',
    workspaceId: 'contract-probe-workspace',
    projectId: 'contract-probe-project',
    schemaVersion: BACKEND_SPINE_CONTRACT_VERSION,
    lastModified: checkedAt,
    revision: 0,
    source: 'system',
    syncState: 'local_only',
    name: 'LANDroid backend spine contract probe',
    createdAt: checkedAt,
    updatedAt: checkedAt,
  });
}

export async function runBackendSpineContractCheck(
  options: BackendSpineContractCheckOptions = {}
): Promise<BackendSpineContractCheckResult> {
  const adapter =
    options.adapter ??
    createBackendSpineAdapterForApp({
      baseUrl: options.baseUrl,
      fetchImpl: options.fetchImpl,
      getToken: options.getToken,
      isHosted: options.isHosted,
    });
  const checkedAt = (options.now ?? (() => new Date()))().toISOString();

  try {
    const health = await adapter.health();
    const session = await adapter.session();
    const validation = await adapter.validateRecords([
      createBackendSpineContractProbeRecord(checkedAt),
    ]);

    if (!health.ok) {
      throw new Error('Backend spine health check returned ok=false.');
    }
    if (health.contractVersion !== BACKEND_SPINE_CONTRACT_VERSION) {
      throw new Error(
        `Backend spine contract version ${health.contractVersion} does not match app contract version ${BACKEND_SPINE_CONTRACT_VERSION}.`
      );
    }
    if (session.contractVersion !== health.contractVersion) {
      throw new Error('Backend spine session contract version does not match health.');
    }
    if (validation.contractVersion !== health.contractVersion) {
      throw new Error('Backend spine validation contract version does not match health.');
    }
    if (adapter.mode === 'hosted' && (!session.authenticated || !session.userSub)) {
      throw new Error('Hosted backend spine session did not return an authenticated Cognito subject.');
    }
    if (!validation.valid) {
      throw new Error(`Backend spine rejected the synthetic contract probe (${validation.issues.length} issue(s)).`);
    }

    return {
      status: 'passed',
      mode: adapter.mode,
      checkedAt,
      contractVersion: health.contractVersion,
      authenticated: session.authenticated,
      userSub: session.userSub,
      acceptedCount: validation.acceptedCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const log = message.includes('missing a Cognito ID token')
      ? options.logger?.info
      : options.logger?.warn;
    log?.(`[landroid] backend spine contract check failed (${adapter.mode}): ${message}`);
    return {
      status: 'failed',
      mode: adapter.mode,
      checkedAt,
      error: message,
    };
  }
}
