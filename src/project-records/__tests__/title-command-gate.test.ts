/**
 * DA-M3: `assertTitleCommandRoutesThroughGate` only became live once the journal
 * hook started threading the real mutation origin (before, every mutation was
 * recorded `origin:'user'`, so the gate always took the trivial branch). These
 * tests pin the now-reachable behavior: AI-origin title mutations must route
 * through a gated tool, a single gated tool may legitimately journal a
 * non-headline `'update'` (e.g. `createDeskMap` seeding a tract), and anything
 * ungated fails closed.
 */
import { describe, expect, it } from 'vitest';
import { assertTitleCommandRoutesThroughGate } from '../action-layer/title-command-sourcing';

// A representative gate set (the real default is HOSTED_BLOCKED_TOOL_NAMES from
// the AI tool registry); passing it explicitly keeps the unit test isolated.
const GATE = new Set([
  'createRootNode',
  'convey',
  'createNpri',
  'precede',
  'graftToParent',
  'deleteNode',
  'attachLease',
  'createDeskMap',
]);

describe('assertTitleCommandRoutesThroughGate (DA-M3 gate is now live)', () => {
  it('passes user-origin mutations and rejects a user-origin aiToolName', () => {
    expect(() =>
      assertTitleCommandRoutesThroughGate('convey', 'user', undefined, GATE)
    ).not.toThrow();
    expect(() =>
      assertTitleCommandRoutesThroughGate('convey', 'user', 'convey', GATE)
    ).toThrow(/only meaningful for AI/);
  });

  it('passes import-origin mutations (no AI gate, no aiToolName)', () => {
    expect(() =>
      assertTitleCommandRoutesThroughGate('createRootNode', 'import', undefined, GATE)
    ).not.toThrow();
  });

  it('passes ai-origin headline mutations through their matching gated tool', () => {
    expect(() =>
      assertTitleCommandRoutesThroughGate('convey', 'ai', 'convey', GATE)
    ).not.toThrow();
    expect(() =>
      assertTitleCommandRoutesThroughGate('deleteNode', 'ai', 'deleteNode', GATE)
    ).not.toThrow();
  });

  it('passes a gated tool that journals a non-headline update (createDeskMap → update)', () => {
    // This is the case the old rigid `aiToolName !== expected` check wrongly
    // rejected, which would have dropped AI desk-map creations from the ledger.
    expect(() =>
      assertTitleCommandRoutesThroughGate('update', 'ai', 'createDeskMap', GATE)
    ).not.toThrow();
  });

  it('fails closed for an ungated ai tool', () => {
    expect(() =>
      assertTitleCommandRoutesThroughGate('convey', 'ai', 'updateNode', GATE)
    ).toThrow(/not gated/);
    expect(() =>
      assertTitleCommandRoutesThroughGate('convey', 'ai', 'definitelyNotATool', GATE)
    ).toThrow(/not gated/);
  });

  it('fails closed for an unnamed ai-origin update (falls back to ungated updateNode)', () => {
    expect(() =>
      assertTitleCommandRoutesThroughGate('update', 'ai', undefined, GATE)
    ).toThrow(/not gated/);
  });
});
