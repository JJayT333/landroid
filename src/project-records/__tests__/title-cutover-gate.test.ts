/**
 * Phase 4 title cutover — continuous parity gate (item 3). title_tree cannot
 * advance shadow→candidate until >=10 real mutations have passed inline parity
 * AND math parity is clean. Reversible; live cutover stays hard-blocked.
 */
import { describe, expect, it } from 'vitest';
import {
  CutoverRegistry,
  CutoverDisabledError,
  LIVE_CUTOVER_DISABLED,
} from '../action-layer/cutover';
import {
  MIN_PASSED_TITLE_PARITIES,
  TitleTreeCutoverGate,
} from '../action-layer/title-cutover-gate';
import type { ParityReport } from '../action-layer/parity';

const cleanReport: ParityReport = {
  workflow: 'title_tree',
  clean: true,
  expectedCount: 2,
  derivedCount: 2,
  divergences: [],
};
const dirtyReport: ParityReport = {
  workflow: 'title_tree',
  clean: false,
  expectedCount: 2,
  derivedCount: 1,
  divergences: [
    { kind: 'missing_record', recordId: 'x', recordType: 'interest_reference', detail: 'gone' },
  ],
};

function passN(gate: TitleTreeCutoverGate, n: number): void {
  for (let i = 0; i < n; i += 1) gate.recordPassedParity([cleanReport]);
}

describe('Phase 4 title cutover gate', () => {
  it('refuses candidacy before the parity threshold is met', () => {
    const gate = new TitleTreeCutoverGate();
    gate.setMathParityClean(true);
    passN(gate, MIN_PASSED_TITLE_PARITIES - 1);
    expect(gate.readiness().ready).toBe(false);
    expect(() => gate.proposeCandidate(cleanReport)).toThrow(/Not enough proven mutations/);
    expect(gate.getState()).toBe('shadow');
  });

  it('refuses candidacy when math parity is not clean', () => {
    const gate = new TitleTreeCutoverGate();
    passN(gate, MIN_PASSED_TITLE_PARITIES);
    gate.setMathParityClean(false);
    expect(gate.readiness().ready).toBe(false);
    expect(() => gate.proposeCandidate(cleanReport)).toThrow(/Math parity is not clean/);
    expect(gate.getState()).toBe('shadow');
  });

  it('advances to candidate after >=10 parities + clean math, and reverts', () => {
    const gate = new TitleTreeCutoverGate();
    passN(gate, MIN_PASSED_TITLE_PARITIES);
    gate.setMathParityClean(true);
    expect(gate.readiness().ready).toBe(true);

    gate.proposeCandidate(cleanReport);
    expect(gate.getState()).toBe('candidate');

    gate.revertToShadow();
    expect(gate.getState()).toBe('shadow'); // reversible
  });

  it('refuses candidacy while a runtime title-ledger divergence is active', () => {
    const gate = new TitleTreeCutoverGate();
    passN(gate, MIN_PASSED_TITLE_PARITIES);
    gate.setMathParityClean(true);
    gate.setRuntimeDivergence(true, 'createRootNode diverged');

    const readiness = gate.readiness();

    expect(readiness.ready).toBe(false);
    expect(readiness.runtimeDivergence).toBe(true);
    expect(readiness.reason).toMatch(/Runtime title-ledger divergence is active/);
    expect(() => gate.proposeCandidate(cleanReport)).toThrow(/Runtime title-ledger divergence/);
    expect(gate.getState()).toBe('shadow');
  });

  it('refuses to count a diverged parity toward candidacy', () => {
    const gate = new TitleTreeCutoverGate();
    expect(() => gate.recordPassedParity([dirtyReport])).toThrow(/diverged/);
    expect(gate.getPassedParities()).toBe(0);
  });

  it('keeps live cutover hard-blocked for this run', () => {
    expect(LIVE_CUTOVER_DISABLED).toBe(true);
    const registry = new CutoverRegistry();
    registry.proposeCandidate('title_tree', cleanReport);
    expect(() =>
      registry.cutOver('title_tree', { reviewerApprovalToken: 'reviewer-ok' })
    ).toThrow(CutoverDisabledError);
  });
});
