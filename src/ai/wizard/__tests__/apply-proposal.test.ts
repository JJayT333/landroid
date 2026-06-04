import { describe, expect, it, vi } from 'vitest';
import * as applyProposal from '../apply-proposal';
import { buildApplyPlan } from '../apply-proposal';
import type { WorkspaceImportProposal } from '../schemas';
import type { DeskMap } from '../../../types/node';

function proposal(overrides: Partial<WorkspaceImportProposal> = {}): WorkspaceImportProposal {
  return {
    project: {},
    sheets: [],
    tracts: [],
    clarifyingQuestions: [],
    warnings: [],
    ...overrides,
  };
}

function deskMap(overrides: Partial<DeskMap> & { id: string; code: string }): DeskMap {
  return {
    name: `Tract ${overrides.code}`,
    tractId: null,
    grossAcres: '',
    pooledAcres: '',
    description: '',
    nodeIds: [],
    ...overrides,
  };
}

describe('buildApplyPlan', () => {
  it('proposes project rename when unitName differs from current', () => {
    const plan = buildApplyPlan(
      proposal({ project: { unitName: 'Elmore #1 Unit' } }),
      { projectName: 'Untitled Workspace', deskMaps: [], nodes: [] }
    );
    expect(plan.projectNameChange).toBe('Elmore #1 Unit');
  });

  it('does not propose rename when unitName matches current', () => {
    const plan = buildApplyPlan(
      proposal({ project: { unitName: 'Elmore #1 Unit' } }),
      { projectName: 'Elmore #1 Unit', deskMaps: [], nodes: [] }
    );
    expect(plan.projectNameChange).toBeNull();
  });

  it('falls back to operator when unitName missing', () => {
    const plan = buildApplyPlan(
      proposal({ project: { operator: 'Magnolia' } }),
      { projectName: 'Untitled Workspace', deskMaps: [], nodes: [] }
    );
    expect(plan.projectNameChange).toBe('Magnolia');
  });

  it('creates desk maps for new tract codes and skips existing ones', () => {
    const plan = buildApplyPlan(
      proposal({
        tracts: [
          { code: 'T1', grossAcres: '40' },
          { code: 'T2', grossAcres: '50' },
          { code: 'T3' },
        ],
      }),
      {
        projectName: 'P',
        deskMaps: [deskMap({ id: 'dm-existing', code: 'T2' })],
        nodes: [],
      }
    );

    expect(plan.deskMapsToCreate.map((d) => d.code)).toEqual(['T1', 'T3']);
    expect(plan.deskMapsToCreate[0].grossAcres).toBe('40');
    expect(plan.collisions).toEqual([
      { code: 'T2', existingDeskMapId: 'dm-existing' },
    ]);
  });

  it('encodes NPR groups and notes into the desk map description', () => {
    const plan = buildApplyPlan(
      proposal({
        tracts: [
          { code: 'T2', nprGroups: ['NPR 1'], notes: '106.19 ac' },
        ],
      }),
      { projectName: 'P', deskMaps: [], nodes: [] }
    );
    expect(plan.deskMapsToCreate[0].description).toBe(
      'NPR: NPR 1 — 106.19 ac'
    );
  });

  it('flags blockers when proposal would change nothing', () => {
    const plan = buildApplyPlan(proposal(), {
      projectName: 'P',
      deskMaps: [],
      nodes: [],
    });
    expect(plan.blockers.length).toBeGreaterThan(0);
    expect(plan.deskMapsToCreate).toHaveLength(0);
  });

  it('dedupes repeated tract codes from the proposal', () => {
    const plan = buildApplyPlan(
      proposal({
        tracts: [
          { code: 'T1' },
          { code: 'T1', grossAcres: '99' },
        ],
      }),
      { projectName: 'P', deskMaps: [], nodes: [] }
    );
    expect(plan.deskMapsToCreate).toHaveLength(1);
    expect(plan.deskMapsToCreate[0].code).toBe('T1');
  });
});

describe('AI proposal mutation boundary', () => {
  it('does not export a direct workspace mutation executor', () => {
    expect((applyProposal as Record<string, unknown>).executeApplyPlan).toBeUndefined();
  });
});

// silence unused vi import warning if any future change drops it
void vi;
