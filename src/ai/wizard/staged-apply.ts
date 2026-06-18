import type { ActionPlanRecord } from '../../backend-spine/contracts';
import { withMutationOrigin } from '../../store/workspace-store';
import {
  approveImportSessionCandidates,
  type ImportApprovalDraft,
} from '../../project-records/import-sessions';
import type { OwnershipNode } from '../../types/node';
import type { StagedImportActionPlanPreview } from './import-session-preview';

export interface StagedImportWorkspaceApplyActions {
  createRootNode: (
    newNodeId: string,
    initialFraction: string,
    form: Partial<OwnershipNode>
  ) => boolean;
  getLastError?: () => string | null;
}

export interface AppliedStagedImportRow {
  rowId: string;
  candidateId: string;
  nodeId: string;
}

export interface ApprovedStagedImportApplyResult {
  approvedActionPlan: ActionPlanRecord;
  approval: ImportApprovalDraft;
  appliedRows: readonly AppliedStagedImportRow[];
}

export async function applyApprovedStagedImportActionPlan(input: {
  preview: StagedImportActionPlanPreview;
  actions: StagedImportWorkspaceApplyActions;
  existingNodeIds?: readonly string[];
  approvedAt?: string;
  approvedBy: 'user';
  candidateIds?: readonly string[];
}): Promise<ApprovedStagedImportApplyResult> {
  assertPreviewReadyForApproval(input.preview.actionPlan);
  const candidateIds = input.candidateIds ?? readPlanCandidateIds(input.preview.actionPlan);
  const approvedAt = input.approvedAt ?? new Date().toISOString();
  const selected = selectPreviewCandidates(input.preview, candidateIds);
  const mutations = selected.map((candidate) => {
    if (candidate.proposedAction.actionKind !== 'create_interest_reference') {
      throw new Error(
        `Unsupported staged import action: ${candidate.proposedAction.actionKind}.`
      );
    }
    return {
      candidateId: candidate.candidateId,
      nodeId: candidate.proposedAction.targetRecordId,
      form: nodeFormFromActionInput(candidate.proposedAction.input),
      fraction: readRequiredText(candidate.proposedAction.input, 'fraction'),
      rowIds: rowKeysForCandidate(input.preview, candidate.sourceRowIds),
    };
  });
  assertNoNodeCollisions(mutations.map((mutation) => mutation.nodeId), input.existingNodeIds ?? []);

  const approval = await approveImportSessionCandidates({
    session: input.preview.session,
    dryRunActionPlan: input.preview.actionPlan,
    candidateIds,
    approvedAt,
    approvedBy: input.approvedBy,
  });

  const appliedRows: AppliedStagedImportRow[] = [];
  for (const mutation of mutations) {
    // DA-M3: staged-import applies are `import`-origin in the durable ledger.
    // `createRootNode` runs the title journal hook synchronously, so the origin
    // scope wraps exactly the recording call (no `aiToolName` — import is not an
    // AI tool and must not engage the AI gate).
    const ok = withMutationOrigin('import', () =>
      input.actions.createRootNode(
        mutation.nodeId,
        mutation.fraction,
        mutation.form
      )
    );
    if (!ok) {
      throw new Error(
        `Approved staged import candidate ${mutation.candidateId} was rejected by the workspace store: ${
          input.actions.getLastError?.() ?? 'createRootNode failed'
        }`
      );
    }
    for (const rowId of mutation.rowIds) {
      appliedRows.push({
        rowId,
        candidateId: mutation.candidateId,
        nodeId: mutation.nodeId,
      });
    }
  }

  return {
    approvedActionPlan: approval.approvedActionPlan,
    approval,
    appliedRows,
  };
}

function assertPreviewReadyForApproval(actionPlan: ActionPlanRecord): void {
  if (actionPlan.actionKind !== 'import_session_dry_run') {
    throw new Error('Workbook imports require a staged ImportSession ActionPlan preview.');
  }
  if (actionPlan.status !== 'needs_review') {
    throw new Error('Workbook imports can only apply an ActionPlan that is awaiting review.');
  }
  if (actionPlan.input.dryRun !== true) {
    throw new Error('Workbook imports require a dry-run ActionPlan preview before apply.');
  }
}

function readPlanCandidateIds(actionPlan: ActionPlanRecord): string[] {
  const candidateIds = actionPlan.input.candidateIds;
  if (!Array.isArray(candidateIds) || !candidateIds.every((id) => typeof id === 'string')) {
    throw new Error('Workbook import ActionPlan preview is missing candidate IDs.');
  }
  return candidateIds;
}

function selectPreviewCandidates(
  preview: StagedImportActionPlanPreview,
  candidateIds: readonly string[]
) {
  const candidatesById = new Map(
    preview.session.candidates.map((candidate) => [candidate.candidateId, candidate])
  );
  return candidateIds.map((candidateId) => {
    const candidate = candidatesById.get(candidateId);
    if (!candidate) {
      throw new Error(`Unknown staged import candidate: ${candidateId}.`);
    }
    return candidate;
  });
}

function assertNoNodeCollisions(
  nodeIds: readonly string[],
  existingNodeIds: readonly string[]
): void {
  const existing = new Set(existingNodeIds);
  const duplicate = nodeIds.find((nodeId, index) =>
    existing.has(nodeId) || nodeIds.indexOf(nodeId) !== index
  );
  if (duplicate) {
    throw new Error(`Approved staged import target already exists: ${duplicate}.`);
  }
}

function rowKeysForCandidate(
  preview: StagedImportActionPlanPreview,
  sourceRowIds: readonly string[]
): string[] {
  const sourceRowsById = new Map(
    preview.session.sourceRows.map((row) => [row.sourceRowId, row])
  );
  return sourceRowIds.map((sourceRowId) => {
    const sourceRow = sourceRowsById.get(sourceRowId);
    if (!sourceRow) {
      throw new Error(`Approved staged import candidate references missing row ${sourceRowId}.`);
    }
    return sourceRow.rowKey;
  });
}

function nodeFormFromActionInput(input: Record<string, unknown>): Partial<OwnershipNode> {
  const recordingReference = readObject(input.recordingReference);
  return {
    grantor: readText(input.grantorName),
    grantee: readText(input.partyName),
    instrument: readText(input.instrumentType),
    docNo: readText(recordingReference.instrumentNumber),
    vol: readText(recordingReference.volume),
    page: readText(recordingReference.page),
    date: readText(input.instrumentDate),
    fileDate: readText(input.recordingDate),
    landDesc: readText(input.legalDescription),
    remarks: readText(input.remarks),
    interestClass: readInterestClass(input.interestClass),
    royaltyKind: readRoyaltyKind(input.royaltyKind),
    fixedRoyaltyBasis: readFixedRoyaltyBasis(input.fixedRoyaltyBasis),
  };
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readRequiredText(input: Record<string, unknown>, key: string): string {
  const value = readText(input[key]).trim();
  if (!value) {
    throw new Error(`Approved staged import action is missing ${key}.`);
  }
  return value;
}

function readInterestClass(value: unknown): OwnershipNode['interestClass'] {
  return value === 'npri' ? 'npri' : 'mineral';
}

function readRoyaltyKind(value: unknown): OwnershipNode['royaltyKind'] {
  return value === 'fixed' || value === 'floating' ? value : null;
}

function readFixedRoyaltyBasis(value: unknown): OwnershipNode['fixedRoyaltyBasis'] {
  return value === 'whole_tract' || value === 'burdened_branch' ? value : null;
}
