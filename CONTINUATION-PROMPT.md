# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Active Handoff - 2026-06-09

Current workstream: title-tree read cutover, Scope A (governed record-layer read flip).

Branch: `feat/title-tree-record-cutover` (off `origin/main`).

Worktree: `/tmp/landroid-title-cutover`.

Base: `origin/main` at `9b1b7d8` (PR #137 LPR full-abstract + multi-tract merged).

### What this delivers

Scope A makes the action/record layer a governed, reversible read source for the
project-records projection, with the readiness gates computed and proven green at
runtime. See `docs/title-tree-read-cutover.md` for the full writeup.

- `src/project-records/action-layer/title-cutover-readiness.ts` — runtime gate
  evaluator (`computeTitleParityGates` = MathInputView parity + `.landroid`
  export-import-replay round trip; `deriveTitleCutoverReadiness`).
- `src/store/title-action-log.ts` — governed `readPathMode` +
  `flipToCutover`/`revertReadPathToShadow` (enabled for `title_tree` only;
  `DEFAULT_TITLE_READ_PATH_MODE` stays `shadow`) + `selectTitleReadPathInput` seam.
- `src/components/shared/TitleLedgerStatusBanner.tsx` — real reversible flip,
  auto-advance on the rising edge of readiness, live mode indicator.

### Invariant

The live Desk Map and math still read `useWorkspaceStore.nodes` in every mode; only
the project-records read source flips. Springhill and the Phase 0 goldens are
unchanged. The flip reverts via `revertReadPathToShadow()`.

### Validation

`npm run lint`, `npm test`, `npm run build`, `git diff --check` all pass in the
worktree (node_modules symlinked from the root checkout). New suites:
`title-cutover-readiness.test.ts`, `title-read-flip-control.test.ts`, plus the updated
`TitleLedgerStatusBanner.test.tsx`.

### Next steps

1. Review PR for `feat/title-tree-record-cutover`; squash-merge.
2. Scope B (deferred): route the live Desk Map / Leasehold reads + math through the
   ledger projection. Highest-risk surface — invert divergence handling to
   block/rollback, add a cached/ordered projection, reconcile desk-map membership, keep
   the `deleteNode` undo boundary consistent. Build on Scope A's proven-green gate.

### Process note

A prior session pushed to `main` by accident (commands ran in the root checkout on
`main`). Work only in the dedicated worktree via explicit `git -C <worktree>`; never run
a bare `git push`; push only the feature branch; open a PR and stop for review.
