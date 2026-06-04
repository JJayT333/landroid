# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Current Title Ledger Runtime Lifecycle Handoff - 2026-06-04

Branch: `feat/title-ledger-runtime-lifecycle`

Worktree: `/private/tmp/landroid-title-ledger-lifecycle`

Workstream: T2b runtime ledger lifecycle, branched from T2a
`feat/title-ledger-runtime-storage`. T0 rebuild-first posture and the T1
remediation merge train (#111-#117) are complete on `main`; T2a is open as PR
#119.

Completed in this branch:

- `useTitleActionLog` now has lifecycle helpers to flush the live title ledger
  to Dexie, hydrate from Dexie, hydrate from a v9 file ledger, or baseline when
  no ledger exists.
- App startup hydrates the loaded workspace from Dexie and continues the audit
  chain from the persisted head. If no stored rows exist, it baselines the
  loaded snapshot and mirrors that baseline to Dexie.
- Debounced workspace autosave now mirrors the title ledger after a successful
  current-generation shard save. A generation guard skips stale flushes when a
  newer edit arrives while an async save is in flight.
- `.landroid` imports hydrate from the file `actionLedger` over stale Dexie rows
  and mirror the chosen file/baseline ledger back to Dexie. CSV and demo loads
  baseline from the loaded workspace and mirror back.
- Lifecycle tests cover persist-refresh-hydrate equality, continued audit chain,
  workspace swap rehydrate, and v9 file-ledger precedence over stale Dexie.
- `ARCHITECTURE.md`, `ROADMAP.md`,
  `docs/phase-4-v9-durable-format-scope.md`, and
  `docs/phase-4-title-cutover-notes.md` now describe the ledger as durable
  shadow evidence, not in-memory-only instrumentation.

Explicitly not included:

- No production read flip and no change to canonical reads. Zustand/snapshot
  reads remain authoritative until the separate T3 governed/default-off
  read-flip readiness gate is reviewed.
- No math/precision behavior change.
- No real `.landroid` files or `scripts/springhill/` changes.

Rollback / recovery:

- Before destructive migration or rollback testing, export a `.landroid` backup
  and note the branch/commit under test.
- To revert T2b while keeping Dexie v12, revert this lifecycle commit/PR. The
  app returns to T2a storage-only shadow behavior; current reads still come from
  the store/snapshot path.
- If a browser profile has opened Dexie v12 and a reverted v11 build cannot
  open the newer IndexedDB version, delete the `landroid-v2` IndexedDB database
  for that profile only after exporting a `.landroid` backup, then import the
  backup into the reverted build.
- If staying on v12, clearing `titleActionRecords` and `titleAuditEvents` purges
  the additive mirror rows.

Latest validation:

- `npm ci` - passed in this worktree, with the local Node 26 engine warning and
  the pre-existing npm audit finding.
- `npm test -- src/store/__tests__/title-action-log-persistence.test.ts src/storage/__tests__/title-ledger-persistence.test.ts src/store/__tests__/title-action-log.test.ts`
  - passed, 3 files / 21 tests.
- `npm run lint` - passed.
- `git diff --check` - passed.
- `npm test` - passed, 129 files / 894 tests. Existing intentional stderr
  appeared for simulated Dexie failures, title divergence, and post-v8 backup
  failure paths.
- `npm run build` - passed with existing Vite dynamic/static import warnings,
  the Node `module.register()` deprecation warning, and large-chunk warning.
- `./node_modules/.bin/tsx scripts/title-soak.ts` - passed on the synthetic
  Vulcan Mesa fixture: replay == adapter and math parity both PASS.

Open risks / deliberately deferred:

- T2b touches the subtle hydrate/precedence boundary and should get close
  review. The file path intentionally wins over stale Dexie rows; startup
  resident workspaces hydrate from Dexie.
- Read-flip remains a separate reviewed decision after T3 proves the gates:
  MathInputView parity, `.landroid` round-trip/replay, live divergence, and the
  flip-to-shadow revert path.
- No e2e run was performed for T2b because the behavior is covered by lifecycle
  unit tests and no visible browser workflow changed. Run e2e if review wants a
  full app smoke before merge.

Likely next steps:

1. Review and push `feat/title-ledger-runtime-lifecycle`.
2. Open the T2b PR against the T2a branch/PR, with close-review callouts for
   hydrate/precedence/file-vs-Dexie behavior.
3. After T2a/T2b merge, start T3 `feat/title-read-flip-governance`: convert the
   existing hard-disabled read-flip machinery to governed/default-off, with no
   production enablement.

Paste-ready next chat prompt:

> Read `/Users/abstractmapping/projects/landroid/AGENTS.md`,
> `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`, and
> `/private/tmp/landroid-title-ledger-lifecycle/CONTINUATION-PROMPT.md`.
> Continue T2b from branch `feat/title-ledger-runtime-lifecycle` in
> `/private/tmp/landroid-title-ledger-lifecycle`. The branch adds runtime title
> ledger flush/hydrate/continue-chain behavior, file-ledger precedence over stale
> Dexie rows, lifecycle tests, and source-of-truth doc updates. Validation
> passed with targeted lifecycle tests, `npm run lint`, `git diff --check`,
> `npm test`, `npm run build`, and `./node_modules/.bin/tsx scripts/title-soak.ts`.

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
