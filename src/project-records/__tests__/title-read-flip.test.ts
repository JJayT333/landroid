/**
 * Phase 4 title cutover — the read-path flip wired into the live record consumer
 * (evidence-vault). Default shadow sources title records from the adapter;
 * 'cutover' sources them from the durable action-layer ledger. The flip is
 * reversible and, when the ledger is complete, byte-for-byte faithful (modulo
 * the generation timestamp). No live caller sets 'cutover'. Synthetic only.
 */
import { describe, expect, it } from 'vitest';
import { LANDROID_FILE_VERSION } from '../../storage/landroid-file-version';
import { buildProjectRecordsWithEvidenceVault } from '../evidence-vault';
import { recordTitleMutation } from '../action-layer/title-command-sourcing';
import { canonicalJson } from '../action-layer/canonical-json';
import {
  emptyTitleWorkspace,
  TITLE_NOW,
  TITLE_WS,
  titleContext,
  titleOwnerData,
  titleWorkspace,
} from './title-cutover-fixtures';
import type { BackendSpineCoreRecord } from '../../backend-spine/contracts';

const TITLE_TYPES = new Set(['instrument_record', 'interest_reference']);

function ownerWorkspaceData() {
  const { owners, leases } = titleOwnerData();
  return { owners, leases, contacts: [], docs: [] };
}

function split(records: readonly BackendSpineCoreRecord[]) {
  return {
    title: records.filter((r) => TITLE_TYPES.has(r.recordType)),
    other: records.filter((r) => !TITLE_TYPES.has(r.recordType)),
  };
}

function domainJson(records: readonly BackendSpineCoreRecord[]): string {
  return canonicalJson(
    records
      .map((r) => ({ ...r, lastModified: '<normalized>' }))
      .sort((a, b) => (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0))
  );
}

async function buildLedger() {
  const result = await recordTitleMutation({
    mutation: 'createRootNode',
    origin: 'system',
    approvedBy: 'system',
    context: titleContext(),
    appliedAt: TITLE_NOW,
    beforeWorkspace: emptyTitleWorkspace(),
    afterWorkspace: titleWorkspace(),
    ownerData: titleOwnerData(),
  });
  return [result.actionRecord];
}

function baseInput() {
  return {
    workspace: titleWorkspace(),
    ownerData: ownerWorkspaceData(),
    projectId: TITLE_WS,
    generatedAt: TITLE_NOW,
    landroidFileVersion: LANDROID_FILE_VERSION,
  };
}

describe('Phase 4 title read-path flip at evidence-vault', () => {
  it('defaults to shadow (adapter) when titleReadPath is omitted', async () => {
    const ledger = await buildLedger();
    const shadow = await buildProjectRecordsWithEvidenceVault(baseInput());
    const explicitShadow = await buildProjectRecordsWithEvidenceVault({
      ...baseInput(),
      titleReadPath: { mode: 'shadow', actionRecords: ledger },
    });
    expect(domainJson(shadow.records)).toBe(domainJson(explicitShadow.records));
  });

  it('cutover sources title records from the ledger, faithfully (ledger complete)', async () => {
    const ledger = await buildLedger();
    const shadow = await buildProjectRecordsWithEvidenceVault(baseInput());
    const cutover = await buildProjectRecordsWithEvidenceVault({
      ...baseInput(),
      titleReadPath: { mode: 'cutover', actionRecords: ledger },
    });

    const shadowSplit = split(shadow.records);
    const cutoverSplit = split(cutover.records);

    // title records are present in both and domain-identical (faithful flip)
    expect(cutoverSplit.title.length).toBeGreaterThan(0);
    expect(domainJson(cutoverSplit.title)).toBe(domainJson(shadowSplit.title));
    // every non-title record is untouched by the flip
    expect(domainJson(cutoverSplit.other)).toBe(domainJson(shadowSplit.other));
  });

  it('is reversible: shadow → cutover → shadow yields the same bundle', async () => {
    const ledger = await buildLedger();
    const first = await buildProjectRecordsWithEvidenceVault(baseInput());
    await buildProjectRecordsWithEvidenceVault({
      ...baseInput(),
      titleReadPath: { mode: 'cutover', actionRecords: ledger },
    });
    const reverted = await buildProjectRecordsWithEvidenceVault(baseInput());
    expect(domainJson(reverted.records)).toBe(domainJson(first.records));
  });
});
