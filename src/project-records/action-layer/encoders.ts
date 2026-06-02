/**
 * Phase 4 — shadow encoders: current store output → typed command log.
 *
 * The encoders take the records the *current* store/adapter projects and express
 * them as a typed command log. They are the shadow translation layer: the store
 * stays canonical (guardrail 1), and the encoded log is reduced and COMPARED to
 * that same store output by the parity harness.
 *
 * Encoding every adapter record through `parseActionCommand` also proves a real
 * invariant: every record the current store produces for a mutation surface is
 * representable by a typed command and survives strict schema + surface-ownership
 * validation. A record the action layer could not carry would fail here.
 */
import type {
  BackendSpineCoreRecord,
  BackendSpineRecordType,
} from '../../backend-spine/contracts';
import {
  parseActionCommand,
  surfaceForRecordType,
  type ActionCommand,
  type ActionCommandKind,
  type ActionSurface,
} from './commands';

/** The command kind used to encode an upsert for each surface. */
export const UPSERT_COMMAND_KIND_BY_SURFACE: Record<
  Exclude<ActionSurface, 'ai_proposal'>,
  ActionCommandKind
> = {
  title_tree: 'title.convey',
  document: 'document.link',
  owner: 'owner.create',
  lease: 'lease.create',
  curative: 'curative.create',
  import: 'import.apply_candidate',
};

export interface PartitionedRecords {
  bySurface: Record<ActionSurface, BackendSpineCoreRecord[]>;
  /** Records whose type is not a Phase 4 mutation surface (structural/derived). */
  structural: BackendSpineCoreRecord[];
  structuralTypes: BackendSpineRecordType[];
}

function emptyBySurface(): Record<ActionSurface, BackendSpineCoreRecord[]> {
  return {
    title_tree: [],
    document: [],
    owner: [],
    lease: [],
    curative: [],
    import: [],
    ai_proposal: [],
  };
}

/** Split a record set into per-surface buckets plus a structural remainder. */
export function partitionRecordsBySurface(
  records: readonly BackendSpineCoreRecord[]
): PartitionedRecords {
  const bySurface = emptyBySurface();
  const structural: BackendSpineCoreRecord[] = [];
  const structuralTypes = new Set<BackendSpineRecordType>();

  for (const record of records) {
    const surface = surfaceForRecordType(record.recordType);
    if (surface) {
      bySurface[surface].push(record);
    } else {
      structural.push(record);
      structuralTypes.add(record.recordType);
    }
  }

  return { bySurface, structural, structuralTypes: [...structuralTypes] };
}

/**
 * Encode a surface's records as an upsert command log. One command per record;
 * each carries the record as an upsert effect. Throws (via parseActionCommand)
 * if a record cannot be represented by the surface's typed command.
 */
export function encodeSurfaceRecordsAsCommandLog(
  surface: Exclude<ActionSurface, 'ai_proposal'>,
  records: readonly BackendSpineCoreRecord[],
  options: { origin?: ActionCommand['origin'] } = {}
): ActionCommand[] {
  const commandKind = UPSERT_COMMAND_KIND_BY_SURFACE[surface];
  const origin = options.origin ?? 'system';
  return records.map((record, index) =>
    parseActionCommand({
      commandId: `${surface}:${index}`,
      commandKind,
      surface,
      origin,
      summary: `upsert ${record.recordType} ${record.recordId}`,
      recordEffects: [{ op: 'upsert', record }],
    })
  );
}
