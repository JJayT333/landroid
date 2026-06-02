# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Current Title-Ledger Baseline Handoff - 2026-06-02

Branch: `fix/act-h01-title-baseline`

Workstream: title-ledger lazy baseline, based on `main`.

Completed in this branch:

- ACT-H01: added a lazy, idempotent `title.baseline` command kind for loaded
  workspaces whose live title store already has nodes but whose action ledger is
  empty.
- `ensureTitleBaseline(workspace, ownerData)` is exported from
  `src/store/title-action-log.ts`. Future title-ledger read callers must call it
  with the current workspace snapshot and loaded owner data, then await
  `settleTitleActionLog()` before reading `actionRecords`.
- The live journal hook now baselines the mutation's `beforeWorkspace` before
  recording the first mutation, serialized on the existing recording chain and
  guarded by the existing workspace-generation reset behavior.
- Baselines use the same `recordTitleMutation` path, parity handling, audit
  chain append, and divergence surfacing as normal title mutations.
- Added focused acceptance coverage for first-mutation baseline, direct
  baseline/replay, idempotence, empty workspaces, loaded-owner party IDs, and
  workspace-switch reset behavior.

Latest validation:

- `npm test -- src/store/__tests__/title-action-log.test.ts`
  - passed, 1 file / 12 tests. Existing intentional title-divergence stderr
    appeared.
- `npm run lint`
  - passed.
- `npm run test`
  - passed, 121 files / 846 tests. Existing intentional stderr coverage for
    title divergence, simulated Dexie failures, and post-v8 backup failure
    appeared.
- `git diff --check`
  - passed.

Open risks / deliberately deferred:

- No read-flip enablement, live read caller, `.landroid` persistence work,
  divergence UX, load-flow wiring, math-engine work, `scripts/springhill/`
  changes, or real-data changes were made.
- ACT-H03 and ACT-H05 remain separate work. Do not claim title-ledger cutover
  readiness until their gates are complete.
- Existing untracked local artifacts remain intentionally uncommitted unless
  the user asks otherwise:
  `docs/.audit-backlog.md.swp`,
  `docs/archive/audits/LINE_BY_LINE_AUDIT_2026-05-31.md`, and
  `scripts/springhill/`.

Likely next steps:

1. Commit `fix(act): add lazy title baseline`.
2. Push `fix/act-h01-title-baseline`.
3. Open a PR against `main` and keep it unmerged pending review.

Paste-ready next chat prompt:

> Read `/Users/abstractmapping/projects/landroid/AGENTS.md`,
> `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`, and
> `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`. Continue
> the title-ledger baseline work on `fix/act-h01-title-baseline`. ACT-H01 adds
> lazy `title.baseline` recording and passed `npm test --
> src/store/__tests__/title-action-log.test.ts`, `npm run lint`, `npm run test`,
> and `git diff --check`. ACT-H03 and ACT-H05 remain deferred.

## Historical Branch Notes

`chore/audit-cleanup` - main-line audit cleanup branch based on `main` at
`3768ff5` on 2026-06-02.

Do not commit directly to `main`. This branch is intended for a PR back to
`main`.

Sibling branch already pushed for the title-action feature line:

- `fix/title-action-cleanup` -> PR #98 against `feat/phase-4-title-cutover`:
  <https://github.com/JJayT333/landroid/pull/98>

## Historical Workstream Notes

Audit cleanup from `docs/audit-backlog.md` and the 2026-05-31 line-by-line
audit. This branch closes the main-line backlog IDs without touching math
semantics, `.landroid` package versioning, title read-path enablement, or
Springhill source data.

Completed on this branch:

- LLA-H04: AI NPRI creation now requires explicit royalty characterization and
  fixed-royalty basis instead of silently defaulting to fixed/burdened terms.
- LLA-M03: document attachment ordering, append, and detach compaction are
  scoped by workspace.
- LLA-M02: strict `.landroid` import hydration clears stale attachment badges
  when side-store rows are missing.
- LLA-M05: the lease attachment modal blocks non-Texas math leases before
  mutating owner, lease, or node state.
- LLA-M13: CI push filters now match the approved branch-prefix taxonomy.
- LLA-M14: root `validate` and `validate:backend` scripts expose aggregate
  local validation across root and backend packages; README/TESTING document
  them.
- LLA-L01: local Ollama CORS guidance recommends explicit localhost origins
  instead of wildcard origins.
- LLA-L04: stale `PATCH_PLAN.md` was archived under `docs/archive/2026/` and
  removed from the active docs map.
- LLA-L05: AI settings comments now match the session-only cloud key policy,
  backed by a persisted settings shape assertion.

Validation passed:

- `npm run lint` - passed.
- `npm run test` - passed, 102 files / 751 tests. Existing intentional stderr
  appeared for simulated Dexie and backup failures.
- `npm run build` - passed with existing Vite dynamic/static import warnings,
  chunk-size warning, and Node `module.register()` deprecation warning.
- `npm run validate:backend` - passed after a network-enabled rerun for npm
  audits; it covers backend spine audit/tests/typecheck and AI proxy
  audit/tests/build.
- Targeted tests and `git diff --check` were run for each audit item before
  committing.

Not run:

- `npm run test:e2e` and the aggregate root `npm run validate` were not run.
  The pasted branch gate required lint and tests; this branch does not change
  browser workflow behavior beyond guarded text and modal blocking covered by
  unit/component tests.

Open local noise to leave untouched unless explicitly requested:

- `docs/.audit-backlog.md.swp`
- `docs/archive/audits/LINE_BY_LINE_AUDIT_2026-05-31.md`
- `scripts/springhill/`

Likely next steps:

- Push `chore/audit-cleanup`.
- Open a PR against `main`.
- Review PR #98 separately before continuing title-action cutover work.
