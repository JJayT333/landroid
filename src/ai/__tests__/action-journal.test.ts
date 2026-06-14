import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildAIApprovalDetails,
  formatAIActionJournalForModel,
  markLatestAppliedJournalEntryUndone,
  recordAIActionResult,
  useAIActionJournalStore,
} from '../action-journal';

describe('AI action journal', () => {
  beforeEach(() => {
    useAIActionJournalStore.getState().clear();
  });

  it('builds structured details for approval cards', () => {
    expect(
      buildAIApprovalDetails('createNpri', {
        parentNodeId: 'node-parent',
        share: '1/16',
        royaltyKind: 'fixed',
        fixedRoyaltyBasis: 'whole_tract',
        form: { grantee: 'Royalty Co', docNo: 'NPRI-1' },
      })
    ).toEqual(
      expect.arrayContaining([
        { label: 'Parent node', value: 'node-parent' },
        { label: 'Share', value: '1/16' },
        { label: 'Royalty kind', value: 'fixed' },
        { label: 'Fixed basis', value: 'whole_tract' },
        { label: 'Grantee', value: 'Royalty Co' },
        { label: 'Document', value: 'NPRI-1' },
      ])
    );
  });

  it('records approved results and formats concise model context', () => {
    const entry = recordAIActionResult({
      proposalId: 'proposal-1',
      toolName: 'createOwner',
      summary: 'Create owner Alpha Minerals',
      input: { name: 'Alpha Minerals' },
      result: {
        ok: true,
        ownerId: 'owner-alpha',
        validation: { valid: true, issueCount: 0, issues: [] },
      },
      undoLabel: 'Approved AI: Create owner Alpha Minerals',
    });

    expect(entry).toMatchObject({
      proposalId: 'proposal-1',
      toolName: 'createOwner',
      status: 'applied',
      resultSummary: expect.stringContaining('owner-alpha'),
    });
    expect(useAIActionJournalStore.getState().entries).toHaveLength(1);

    const context = formatAIActionJournalForModel(
      useAIActionJournalStore.getState().entries
    );
    expect(context).toContain('Approved LANDroid AI action/result journal');
    expect(context).toContain('proposal-1');
    expect(context).toContain('owner-alpha');
    expect(context).toContain('Use exact IDs');

    markLatestAppliedJournalEntryUndone('Approved AI: Create owner Alpha Minerals');

    const updatedContext = formatAIActionJournalForModel(
      useAIActionJournalStore.getState().entries
    );
    expect(updatedContext).toContain('UNDONE');
    expect(updatedContext).toContain('do not treat as current workspace state');
  });

  it('undoes only the entry whose undoLabel matches, not a later label-less one (DA-L6)', () => {
    recordAIActionResult({
      proposalId: 'p-labeled',
      toolName: 'createOwner',
      summary: 'Create owner Alpha',
      input: { name: 'Alpha' },
      result: {
        ok: true,
        ownerId: 'owner-alpha',
        validation: { valid: true, issueCount: 0, issues: [] },
      },
      undoLabel: 'Approved AI: Create owner Alpha',
    });
    // A later applied entry with NO undo label must not be undone in place of
    // the labelled one when an unrelated undo label is requested.
    recordAIActionResult({
      proposalId: 'p-unlabeled',
      toolName: 'createLease',
      summary: 'Create lease Beta',
      input: {},
      result: { ok: true, validation: { valid: true, issueCount: 0, issues: [] } },
    });

    markLatestAppliedJournalEntryUndone('Approved AI: Create owner Alpha');

    const entries = useAIActionJournalStore.getState().entries;
    expect(entries.find((e) => e.proposalId === 'p-labeled')?.status).toBe('undone');
    expect(entries.find((e) => e.proposalId === 'p-unlabeled')?.status).toBe('applied');
  });
});
