/**
 * Phase 4 — per-workflow parity harness (SHADOW).
 *
 * For each mutation surface, parity reduces the encoded command log and compares
 * the resulting action-derived projection against the current store output for
 * that surface. Any difference — a missing record, an extra record, a changed
 * field, or a tombstone mismatch — is a divergence, and a divergence is a BUG
 * (guardrail 3): `assertParityClean` throws rather than emitting a warning.
 *
 * What clean parity proves for a workflow: every record the current store
 * produces is representable as a typed command, and the reducer replays the log
 * back to exactly that record set with no loss, duplication, or reordering —
 * the precondition a reviewer needs before considering cutover.
 */
import type { BackendSpineCoreRecord } from '../../backend-spine/contracts';
import { canonicalJson } from './canonical-json';
import {
  SURFACE_RECORD_TYPES,
  type ActionCommand,
  type ActionSurface,
} from './commands';
import { encodeSurfaceRecordsAsCommandLog } from './encoders';
import { reduceCommandLog } from './reducer';

export type ParityDivergenceKind = 'missing_record' | 'extra_record' | 'changed_record';

export interface ParityDivergence {
  kind: ParityDivergenceKind;
  recordId: string;
  recordType: string | null;
  detail: string;
}

export interface ParityReport {
  workflow: ActionSurface;
  clean: boolean;
  expectedCount: number;
  derivedCount: number;
  divergences: ParityDivergence[];
}

function sortById<T extends { recordId: string }>(records: readonly T[]): T[] {
  return [...records].sort((a, b) =>
    a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0
  );
}

/**
 * Structurally diff an expected vs derived record set. Pure and reusable.
 */
export function diffRecordSets(
  expected: readonly BackendSpineCoreRecord[],
  derived: readonly BackendSpineCoreRecord[]
): ParityDivergence[] {
  const expectedById = new Map(expected.map((record) => [record.recordId, record]));
  const derivedById = new Map(derived.map((record) => [record.recordId, record]));
  const divergences: ParityDivergence[] = [];

  for (const record of sortById(expected)) {
    const match = derivedById.get(record.recordId);
    if (!match) {
      divergences.push({
        kind: 'missing_record',
        recordId: record.recordId,
        recordType: record.recordType,
        detail: 'present in current store output but missing from action-derived projection',
      });
    } else if (canonicalJson(match) !== canonicalJson(record)) {
      divergences.push({
        kind: 'changed_record',
        recordId: record.recordId,
        recordType: record.recordType,
        detail: 'record fields differ between current store output and action-derived projection',
      });
    }
  }
  for (const record of sortById(derived)) {
    if (!expectedById.has(record.recordId)) {
      divergences.push({
        kind: 'extra_record',
        recordId: record.recordId,
        recordType: record.recordType,
        detail: 'present in action-derived projection but absent from current store output',
      });
    }
  }
  return divergences;
}

/** Run parity for a single surface against the current store's records. */
export function runSurfaceParity(input: {
  surface: Exclude<ActionSurface, 'ai_proposal'>;
  currentStoreRecords: readonly BackendSpineCoreRecord[];
  origin?: ActionCommand['origin'];
}): ParityReport {
  const surfaceTypes = new Set(SURFACE_RECORD_TYPES[input.surface]);
  const expected = input.currentStoreRecords.filter((record) =>
    surfaceTypes.has(record.recordType)
  );
  const commands = encodeSurfaceRecordsAsCommandLog(input.surface, expected, {
    origin: input.origin,
  });
  const derived = reduceCommandLog(commands).records;
  const divergences = diffRecordSets(expected, derived);

  return {
    workflow: input.surface,
    clean: divergences.length === 0,
    expectedCount: expected.length,
    derivedCount: derived.length,
    divergences,
  };
}

const PARITY_SURFACES: Array<Exclude<ActionSurface, 'ai_proposal'>> = [
  'title_tree',
  'document',
  'owner',
  'lease',
  'curative',
  'import',
];

/** Run parity across every record-bearing mutation surface. */
export function runWorkflowParity(input: {
  currentStoreRecords: readonly BackendSpineCoreRecord[];
  origin?: ActionCommand['origin'];
  surfaces?: Array<Exclude<ActionSurface, 'ai_proposal'>>;
}): ParityReport[] {
  return (input.surfaces ?? PARITY_SURFACES).map((surface) =>
    runSurfaceParity({
      surface,
      currentStoreRecords: input.currentStoreRecords,
      origin: input.origin,
    })
  );
}

export class ParityDivergenceError extends Error {
  constructor(readonly reports: ParityReport[]) {
    const lines = reports
      .filter((report) => !report.clean)
      .flatMap((report) =>
        report.divergences.map(
          (divergence) =>
            `  [${report.workflow}] ${divergence.kind} ${divergence.recordId}` +
            `${divergence.recordType ? ` (${divergence.recordType})` : ''}: ${divergence.detail}`
        )
      );
    super(`Parity divergence is a bug; resolve before cutover:\n${lines.join('\n')}`);
    this.name = 'ParityDivergenceError';
  }
}

/** Throw if any report has a divergence. Parity warnings are bugs, not noise. */
export function assertParityClean(reports: readonly ParityReport[]): void {
  const dirty = reports.filter((report) => !report.clean);
  if (dirty.length > 0) {
    throw new ParityDivergenceError([...reports]);
  }
}

export function isParityClean(reports: readonly ParityReport[]): boolean {
  return reports.every((report) => report.clean);
}
