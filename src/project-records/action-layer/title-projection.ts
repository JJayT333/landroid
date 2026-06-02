/**
 * Phase 4 title cutover — title projection + delta helpers (SHADOW).
 *
 * The current store/adapter stays the field-mapping authority (guardrail 1): the
 * title surface's records are whatever `buildProjectRecordsFromWorkspace` emits
 * for `instrument_record` + `interest_reference`. This module never re-derives
 * those fields — it only (a) extracts the title slice of the adapter output and
 * (b) diffs two title slices into the record-level effects a typed command
 * carries. Keeping the math/field mapping in the adapter is what makes the
 * action layer a ledger rather than a second copy of the title engine.
 *
 * The math, however, reads node fields the adapter does NOT round-trip into the
 * title records (`royaltyKind`, `fixedRoyaltyBasis`, `linkedOwnerId`, `type`),
 * so a command must also snapshot the affected node(s). The store/engine remains
 * the producer of those nodes; we only record what it produced (see
 * `title-command-sourcing.ts`).
 */
import {
  type BackendSpineCoreRecord,
  type BackendSpineRecordType,
} from '../../backend-spine/contracts';
import { LANDROID_FILE_VERSION } from '../../storage/landroid-file-version';
import type { OwnershipNode } from '../../types/node';
import { normalizeOwnershipNode } from '../../types/node';
import type { OwnerWorkspaceData } from '../../storage/owner-persistence';
import type {
  CurativeWorkspaceData,
} from '../../storage/curative-persistence';
import type {
  DocumentWorkspaceData,
  WorkspaceData,
} from '../../storage/workspace-persistence';
import { buildProjectRecordsFromWorkspace } from '../workspace-record-adapter';
import { canonicalJson } from './canonical-json';
import type { RecordEffect } from './commands';

/** The record types the title_tree surface owns (mirrors SURFACE_RECORD_TYPES). */
export const TITLE_RECORD_TYPES: readonly BackendSpineRecordType[] = [
  'instrument_record',
  'interest_reference',
];

const TITLE_RECORD_TYPE_SET = new Set<BackendSpineRecordType>(TITLE_RECORD_TYPES);

export function isTitleRecord(record: BackendSpineCoreRecord): boolean {
  return TITLE_RECORD_TYPE_SET.has(record.recordType);
}

export interface TitleAdapterInput {
  workspace: WorkspaceData;
  ownerData?: Pick<OwnerWorkspaceData, 'owners' | 'leases'>;
  documentData?: DocumentWorkspaceData;
  curativeData?: CurativeWorkspaceData;
  projectId?: string;
  generatedAt: string;
}

/**
 * The title slice of the current adapter output. Runs the canonical adapter and
 * keeps only `instrument_record` + `interest_reference`. This is exactly the set
 * `runSurfaceParity('title_tree', …)` compares against, so a command built from
 * this slice cannot drift from the parity harness.
 */
export function titleRecordsFromWorkspace(
  input: TitleAdapterInput
): BackendSpineCoreRecord[] {
  const bundle = buildProjectRecordsFromWorkspace({
    workspace: input.workspace,
    ownerData: input.ownerData,
    documentData: input.documentData,
    curativeData: input.curativeData,
    projectId: input.projectId,
    generatedAt: input.generatedAt,
    landroidFileVersion: LANDROID_FILE_VERSION,
  });
  return bundle.records.filter(isTitleRecord);
}

export interface TitleMutationDelta {
  /** Record-level effects (full upserts + tombstones) for the typed command. */
  effects: RecordEffect[];
  /** Full node snapshots for nodes whose title records were upserted. */
  upsertedNodes: OwnershipNode[];
  /** Node ids whose title records were tombstoned. */
  deletedNodeIds: string[];
  /** Title record ids upserted (instrument + interest). */
  affectedRecordIds: string[];
  /** Title record ids tombstoned. */
  tombstonedRecordIds: string[];
}

function indexById(
  records: readonly BackendSpineCoreRecord[]
): Map<string, BackendSpineCoreRecord> {
  return new Map(records.map((record) => [record.recordId, record]));
}

/**
 * Map node id → the two title record ids it owns. Robust to id hashing: the
 * interest record carries `interestId === node.id` and points at its instrument
 * via `instrumentRecordId`, so we never parse record-id strings.
 */
function titleRecordIdsByNodeId(
  records: readonly BackendSpineCoreRecord[]
): Map<string, string[]> {
  const byNode = new Map<string, string[]>();
  for (const record of records) {
    if (record.recordType !== 'interest_reference') continue;
    const ids = [record.recordId];
    if (record.instrumentRecordId) ids.push(record.instrumentRecordId);
    byNode.set(record.interestId, ids);
  }
  return byNode;
}

/**
 * Diff a before/after title slice into the effects a single command carries,
 * aligned to the affected node snapshots. A node is "affected" when either of
 * its title records (instrument / interest) is new or changed; it is "deleted"
 * when it is present before and absent after. Snapshots are taken from the node
 * sets the store/engine produced — never re-derived here.
 */
export function diffTitleMutation(input: {
  beforeRecords: readonly BackendSpineCoreRecord[];
  afterRecords: readonly BackendSpineCoreRecord[];
  beforeNodes: readonly OwnershipNode[];
  afterNodes: readonly OwnershipNode[];
}): TitleMutationDelta {
  const beforeById = indexById(input.beforeRecords);
  const afterById = indexById(input.afterRecords);
  const afterNodeById = new Map(input.afterNodes.map((node) => [node.id, node]));
  const afterRecordIdsByNode = titleRecordIdsByNodeId(input.afterRecords);

  const effects: RecordEffect[] = [];
  const upsertedNodes: OwnershipNode[] = [];
  const deletedNodeIds: string[] = [];
  const affectedRecordIds = new Set<string>();
  const tombstonedRecordIds: string[] = [];

  // Upserts / changes, grouped per node so a node snapshot accompanies its
  // record effects.
  for (const node of input.afterNodes) {
    const recordIds = afterRecordIdsByNode.get(node.id) ?? [];
    let nodeChanged = false;
    for (const recordId of recordIds) {
      const record = afterById.get(recordId);
      if (!record) continue;
      const prior = beforeById.get(record.recordId);
      if (!prior || canonicalJson(prior) !== canonicalJson(record)) {
        effects.push({ op: 'upsert', record });
        affectedRecordIds.add(record.recordId);
        nodeChanged = true;
      }
    }
    if (nodeChanged) {
      upsertedNodes.push(normalizeOwnershipNode(node));
    }
  }

  // Any changed record not tied to a surviving node (defensive — title records
  // are 1:1 with nodes, so this normally finds nothing) is still captured.
  for (const record of input.afterRecords) {
    if (affectedRecordIds.has(record.recordId)) continue;
    const prior = beforeById.get(record.recordId);
    if (!prior || canonicalJson(prior) !== canonicalJson(record)) {
      effects.push({ op: 'upsert', record });
      affectedRecordIds.add(record.recordId);
    }
  }

  // Tombstones: records present before, absent after.
  for (const record of input.beforeRecords) {
    if (afterById.has(record.recordId)) continue;
    effects.push({
      op: 'delete',
      recordType: record.recordType,
      recordId: record.recordId,
    });
    tombstonedRecordIds.push(record.recordId);
  }

  // Deleted nodes: present before, absent after.
  for (const node of input.beforeNodes) {
    if (!afterNodeById.has(node.id)) deletedNodeIds.push(node.id);
  }

  return {
    effects,
    upsertedNodes,
    deletedNodeIds,
    affectedRecordIds: [...affectedRecordIds],
    tombstonedRecordIds,
  };
}
