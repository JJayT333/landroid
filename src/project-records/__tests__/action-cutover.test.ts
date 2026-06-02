import { describe, expect, it } from 'vitest';
import {
  CutoverDisabledError,
  CutoverRegistry,
  evaluateCutoverCandidate,
  LIVE_CUTOVER_DISABLED,
  reportCutoverCandidates,
  type ParityReport,
} from '../action-layer';

function cleanReport(workflow: ParityReport['workflow'] = 'owner'): ParityReport {
  return { workflow, clean: true, expectedCount: 3, derivedCount: 3, divergences: [] };
}

function dirtyReport(workflow: ParityReport['workflow'] = 'lease'): ParityReport {
  return {
    workflow,
    clean: false,
    expectedCount: 2,
    derivedCount: 1,
    divergences: [
      { kind: 'missing_record', recordId: 'lease-1', recordType: 'lease', detail: 'missing' },
    ],
  };
}

describe('Phase 4 cutover mechanism (built, never flipped)', () => {
  it('keeps live cutover hard-disabled for this run', () => {
    expect(LIVE_CUTOVER_DISABLED).toBe(true);
  });

  it('defaults every workflow to shadow', () => {
    const registry = new CutoverRegistry();
    expect(registry.getState('owner')).toBe('shadow');
    expect(registry.getState('title_tree')).toBe('shadow');
    expect(registry.liveWorkflows()).toEqual([]);
  });

  it('judges candidacy only by clean parity', () => {
    expect(
      evaluateCutoverCandidate({ workflow: 'owner', parityReport: cleanReport() }).eligible
    ).toBe(true);
    expect(
      evaluateCutoverCandidate({ workflow: 'lease', parityReport: dirtyReport() }).eligible
    ).toBe(false);
  });

  it('proposes a candidate only with clean parity and is reversible', () => {
    const registry = new CutoverRegistry();
    registry.proposeCandidate('owner', cleanReport());
    expect(registry.getState('owner')).toBe('candidate');
    expect(registry.candidates()).toEqual(['owner']);

    registry.revertToShadow('owner');
    expect(registry.getState('owner')).toBe('shadow');

    expect(() => registry.proposeCandidate('lease', dirtyReport())).toThrow(/parity diverges/);
  });

  it('cannot flip a workflow live in this run', () => {
    const registry = new CutoverRegistry();
    registry.proposeCandidate('owner', cleanReport());

    expect(() => registry.cutOver('owner', { reviewerApprovalToken: 'reviewer-token' })).toThrow(
      CutoverDisabledError
    );
    // state is unchanged — nothing was cut over
    expect(registry.getState('owner')).toBe('candidate');
    expect(registry.liveWorkflows()).toEqual([]);
  });

  it('reports clean workflows as candidates without performing any cutover', () => {
    const candidates = reportCutoverCandidates([
      cleanReport('owner'),
      cleanReport('curative'),
      dirtyReport('lease'),
    ]);
    expect(candidates.map((candidate) => candidate.workflow)).toEqual(['owner', 'curative']);
    expect(candidates.every((candidate) => candidate.liveCutoverPerformed === false)).toBe(true);
  });
});
