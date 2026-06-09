/**
 * Phase 4 title cutover — runtime readiness evaluation.
 *
 * The {@link TitleTreeCutoverGate} needs four inputs: how many real mutations
 * passed inline parity, whether MathInputView parity is clean, whether the
 * `.landroid` export-import-replay round trip is clean, and whether a runtime
 * divergence is active. The first and last are cheap counters the live ledger
 * already tracks; the middle two require recomputing the action-derived
 * projection and comparing it to the live store, so they are computed here
 * (reusing the proven parity/replay helpers — never reimplementing the math or
 * the adapter) and fed back into the gate.
 *
 * This module is the bridge between the live ledger and the gate; it changes no
 * read path on its own (the flip lives in the read-path flag + the consumer).
 */
import type {
  ActionRecord,
  AuditEventRecord,
  BackendSpineCoreRecord,
} from '../../backend-spine/contracts';
import type { OwnerWorkspaceData } from '../../storage/owner-persistence';
import {
  exportLandroidFile,
  importLandroidFile,
  type LandroidFileData,
  type WorkspaceData,
} from '../../storage/workspace-persistence';
import { canonicalJson } from './canonical-json';
import type { ParityReport } from './parity';
import {
  MIN_PASSED_TITLE_PARITIES,
  TitleTreeCutoverGate,
  type TitleCutoverReadiness,
} from './title-cutover-gate';
import { titleRecordsFromWorkspace } from './title-projection';
import { runTitleMathParity } from './title-math-parity';
import { replayTitleProjection } from './title-replay';

type OwnerSlice = Pick<OwnerWorkspaceData, 'owners' | 'leases'>;

/** A clean single-mutation parity report (one per recorded mutation). */
const CLEAN_TITLE_PARITY_REPORT: ParityReport = {
  workflow: 'title_tree',
  clean: true,
  expectedCount: 1,
  derivedCount: 1,
  divergences: [],
};

export interface TitleReadinessSnapshotInput {
  recordedMutationCount: number;
  mathParityClean?: boolean;
  landroidRoundTripClean?: boolean;
  runtimeDivergenceMessage?: string | null;
  runtimeErrorMessage?: string | null;
}

function normalizedPassedParities(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count));
}

/**
 * Compose a {@link TitleCutoverReadiness} from already-computed gate inputs.
 * Pure: the heavy parity/round-trip computation is done separately by
 * {@link computeTitleParityGates}; this just feeds a gate and reads its verdict
 * so the banner and tests share one source of truth.
 */
export function deriveTitleCutoverReadiness({
  recordedMutationCount,
  mathParityClean = false,
  landroidRoundTripClean = false,
  runtimeDivergenceMessage = null,
  runtimeErrorMessage = null,
}: TitleReadinessSnapshotInput): TitleCutoverReadiness {
  const gate = new TitleTreeCutoverGate(undefined, MIN_PASSED_TITLE_PARITIES, () => ({
    divergenceMessage: runtimeDivergenceMessage,
    errorMessage: runtimeErrorMessage,
  }));
  const passedParities = normalizedPassedParities(recordedMutationCount);
  for (let index = 0; index < passedParities; index += 1) {
    gate.recordPassedParity([CLEAN_TITLE_PARITY_REPORT]);
  }
  gate.setMathParityClean(mathParityClean);
  gate.setLandroidRoundTripClean(landroidRoundTripClean);
  return gate.readiness();
}

export interface TitleParityGateInputs {
  liveWorkspace: WorkspaceData;
  ownerData?: OwnerSlice;
  actionRecords: readonly ActionRecord[];
  auditEvents: readonly AuditEventRecord[];
  generatedAt?: string;
}

export interface TitleParityGates {
  mathParityClean: boolean;
  landroidRoundTripClean: boolean;
}

const NOT_CLEAN: TitleParityGates = {
  mathParityClean: false,
  landroidRoundTripClean: false,
};

/**
 * Recompute the two heavy gate inputs from the live workspace + durable ledger.
 *
 * - mathParityClean: MathInputView from the action-derived node set equals the
 *   live store's, key by key ({@link runTitleMathParity}).
 * - landroidRoundTripClean: the ledger survives a real `.landroid`
 *   export → import and still replays to exactly the live adapter title
 *   projection.
 *
 * Async (the round trip serializes a `.landroid`). Any throw is treated as NOT
 * clean — readiness must be provably green, never assumed. Callers should only
 * invoke this once enough mutations exist (below the parity threshold the gate
 * is red regardless, so the work is skippable).
 */
export async function computeTitleParityGates(
  input: TitleParityGateInputs
): Promise<TitleParityGates> {
  if (input.actionRecords.length === 0) return NOT_CLEAN;
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  let mathParityClean = false;
  try {
    mathParityClean = runTitleMathParity({
      liveWorkspace: input.liveWorkspace,
      records: input.actionRecords as readonly BackendSpineCoreRecord[],
      ownerData: input.ownerData,
      generatedAt,
    }).clean;
  } catch {
    mathParityClean = false;
  }

  let landroidRoundTripClean = false;
  try {
    const fileData: LandroidFileData = { ...input.liveWorkspace };
    const blob = await exportLandroidFile(fileData, {
      actionRecords: input.actionRecords,
      auditEvents: input.auditEvents,
    });
    const file = new File([await blob.text()], 'readiness-roundtrip.landroid', {
      type: 'application/json',
    });
    const imported = await importLandroidFile(file);
    const importedLedger = imported.actionLedger?.records ?? [];
    const replayed = replayTitleProjection(importedLedger);
    const adapter = titleRecordsFromWorkspace({
      workspace: input.liveWorkspace,
      ownerData: input.ownerData,
      generatedAt,
    });
    landroidRoundTripClean = canonicalJson(replayed) === canonicalJson(adapter);
  } catch {
    landroidRoundTripClean = false;
  }

  return { mathParityClean, landroidRoundTripClean };
}

export { MIN_PASSED_TITLE_PARITIES };
