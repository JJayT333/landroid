# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Active Handoff - 2026-06-09

Current workstream: title-tree read cutover, Scope B (ledger-authoritative live reads).

Branch: `feat/title-tree-read-source-cutover` (off `origin/main`).

Worktree: `/tmp/landroid-title-cutover`.

Base: `origin/main` at `d88244e` (Scope A, PR #138, merged).

### What this delivers

Scope B makes the durable ledger authoritative for what the live UI shows, with no
per-screen rewrite. In cutover, the single title journal chokepoint runs the synchronous
parity check and rolls the store back to the pre-mutation snapshot on divergence, so the
store can never hold state the ledger rejected (the store stays provably equal to the
ledger projection and every screen reads it unchanged). Shadow mode is untouched. See
`docs/title-tree-read-cutover.md`.

- `src/project-records/action-layer/title-command-sourcing.ts` — `checkTitleInlineParity`
  (synchronous, non-throwing; reuses the recorder's own parity logic).
- `src/store/workspace-store.ts` — `restoreTitleSlice(before)` (non-journaling title-slice
  rollback).
- `src/store/title-action-log.ts` — cutover-only rollback-on-divergence in the journal hook.

### Invariant

`DEFAULT_TITLE_READ_PATH_MODE` stays `shadow`; the flip is reversible
(`revertReadPathToShadow()`). The engine/math and `deskmap-coverage.ts` /
`leasehold-summary.ts` are untouched; Springhill stays 0.225/0.775 and the Phase 0 goldens
hold. Desk maps / leasehold / owners stay store-owned; rollback restores `nodes` +
`deskMaps` from the journaled before-snapshot.

### Validation

`npm run lint`, `npm test`, `npm run build`, `git diff --check` all pass in the worktree
(`node_modules` from a real `npm ci --offline`). New/extended suites:
`title-action-log.test.ts` (cutover rollback vs shadow surface, clean-cutover store ==
ledger projection, revert), `title-cutover-readiness.test.ts` (`checkTitleInlineParity`).

### Known follow-ups (not blocking)

- A diverged `deleteNode` rolls back the title slice but not its already-fired async
  owner/document cascade (divergence is not expected once the gates are green).
- The sync check recomputes records the async recorder also builds (minor duplication).
- A cached/ordered projection only matters if reads ever move off the store.

### Process note

A prior session pushed to `main` by accident (commands ran in the root checkout on
`main`). Work only in the dedicated worktree via explicit `git -C <worktree>`; never run a
bare `git push`; push only the feature branch; open a PR and stop for review.
