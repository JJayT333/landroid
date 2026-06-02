/**
 * Phase 4 — action-layer persistence (ADDITIVE + VERSION-GATED).
 *
 * Action records and audit events are ordinary `BackendSpineCoreRecord`s, so
 * they persist additively in the record layer (a `ProjectRecordBundle`) and
 * survive a serialize/reload round trip. Per docs/project-record-migration-
 * strategy.md, the live `.landroid` format stays at v8 and is AUTHORITATIVE:
 * action-layer records may be included only in an explicit future
 * record-bearing version, never as an unannounced extension of v8.
 *
 * Appending verifies the audit chain first and refuses to persist a broken one.
 */
import {
  type ActionRecord,
  type AuditEventRecord,
} from '../../backend-spine/contracts';
import { LANDROID_FILE_VERSION } from '../../storage/landroid-file-version';
import {
  buildProjectRecordBundle,
  type ProjectRecordBundle,
} from '../record-validation';
import { verifyAuditChain } from './audit-chain';

export const ACTION_LAYER_EXPORT_GATE = {
  /** The authoritative live package version (unchanged by Phase 4). */
  authoritativeLandroidVersion: LANDROID_FILE_VERSION,
  /** v8 export never carries action-layer records. */
  includedInV8Export: false,
  /** The earliest version that MAY carry records — explicit, future, reviewer-gated. */
  firstRecordBearingVersionAtLeast: LANDROID_FILE_VERSION + 1,
  /** v8 remains the rollback source of truth; no lossy/one-way change. */
  v8StaysAuthoritative: true,
} as const;

/** Whether action-layer records may be included in an export of this version. */
export function actionLayerExportInclusion(landroidFileVersion: number): boolean {
  return landroidFileVersion >= ACTION_LAYER_EXPORT_GATE.firstRecordBearingVersionAtLeast;
}

/** Guard a writer: refuse to put action-layer records into a v8 (or older) export. */
export function assertActionLayerExportAllowed(landroidFileVersion: number): void {
  if (!actionLayerExportInclusion(landroidFileVersion)) {
    throw new Error(
      `Action-layer records cannot be written into .landroid v${landroidFileVersion}; ` +
        `v${ACTION_LAYER_EXPORT_GATE.authoritativeLandroidVersion} stays authoritative and ` +
        `record inclusion requires an explicit v${ACTION_LAYER_EXPORT_GATE.firstRecordBearingVersionAtLeast}+ format.`
    );
  }
}

/**
 * Append action records + audit events to a project-record bundle additively.
 * Returns a NEW validated bundle; the input bundle is never mutated. Verifies
 * the audit chain first and throws on a broken chain rather than persisting it.
 */
export async function appendActionLayerToRecordBundle(input: {
  bundle: ProjectRecordBundle;
  actionRecords: readonly ActionRecord[];
  auditEvents: readonly AuditEventRecord[];
  priorHeadHash?: string;
}): Promise<ProjectRecordBundle> {
  const verification = await verifyAuditChain(input.auditEvents, {
    priorHeadHash: input.priorHeadHash,
  });
  if (!verification.valid) {
    throw new Error(
      `Refusing to persist a broken audit chain (index ${verification.brokenAtIndex}: ` +
        `${verification.reason}).`
    );
  }

  return buildProjectRecordBundle({
    workspaceId: input.bundle.workspaceId,
    projectId: input.bundle.projectId,
    generatedAt: input.bundle.generatedAt,
    records: [...input.bundle.records, ...input.actionRecords, ...input.auditEvents],
  });
}
