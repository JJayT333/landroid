# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Current Title Ledger Runtime Storage Handoff - 2026-06-04

Branch: `feat/title-ledger-runtime-storage`

Worktree: `/private/tmp/landroid-title-ledger-storage`

Workstream: T2a runtime ledger storage. T0 rebuild-first posture and the T1
remediation merge train (#111-#117) are complete on `main`.

Completed in this branch:

- Dexie v12 adds `titleActionRecords` and `titleAuditEvents` for backend-spine
  `action_record` and `audit_event` rows.
- Runtime ledger rows are scoped by `dbKey + workspaceId`; stored `id`,
  `dbKey`, and `position` are Dexie-only metadata. Canonical `recordId`,
  `previousHash`, and `eventHash` values stay unchanged for later chain
  verification.
- `src/storage/title-ledger-persistence.ts` can list, replace, clear one active
  workspace, and clear all ledger rows for the active db key.
- Workspace replacement now clears active-key title-ledger rows alongside shard
  rows and transient AI approval/undo state.
- `ARCHITECTURE.md`, `ROADMAP.md`, and
  `docs/phase-4-v9-durable-format-scope.md` document the storage/lifecycle
  split and the exact Dexie rollback recipe.

Explicitly not included:

- No autosave flush, hydrate, continue-chain, `.landroid` file-vs-Dexie
  precedence, read-path change, read-flip enablement, or production flip.
- No math/precision behavior change.
- No real `.landroid` files or `scripts/springhill/` changes.

Rollback / recovery:

- Before any destructive migration, export a `.landroid` backup and note the
  branch/commit under test.
- T2a is additive storage only; reverting the T2a code removes the runtime use
  of the new tables because no read/flush/hydrate path depends on them yet.
- If a browser profile has opened Dexie v12 and a reverted v11 build cannot
  open the newer IndexedDB version, delete the `landroid-v2` IndexedDB database
  for that profile only after exporting a `.landroid` backup, then import the
  backup into the reverted build.
- If staying on v12, clearing `titleActionRecords` and `titleAuditEvents` is
  enough to purge the additive ledger rows.

Latest validation:

- `npm ci` - passed earlier in this worktree, with the local Node 26 engine
  warning and the pre-existing npm audit finding.
- `npm test -- src/storage/__tests__/title-ledger-persistence.test.ts src/storage/__tests__/workspace-side-store-reset.test.ts`
  - passed, 2 files / 9 tests.
- `npm run lint` - passed.
- `git diff --check` - passed.
- `npm test` - passed, 128 files / 890 tests. Existing intentional stderr
  appeared for simulated Dexie failures, title divergence, and post-v8 backup
  failure paths.
- `npm run build` - passed with existing Vite dynamic/static import warnings,
  the Node `module.register()` deprecation warning, and large-chunk warning.

Open risks / deliberately deferred:

- T2b is the close-review lifecycle slice: autosave flush, hydrate,
  continue-chain, workspace swap rehydrate, and v9 file-ledger precedence over
  stale Dexie rows.
- The read-flip remains default-off and is not part of T2a. Production
  enablement remains a separate reviewed decision after persistence, parity,
  `.landroid` round-trip, divergence, and revert gates are green.
- No e2e run was performed for T2a because this branch changes additive storage
  tables/reset helpers and no browser workflow surface.

Likely next steps:

1. Review and push `feat/title-ledger-runtime-storage`.
2. Open the T2a PR with the rollback recipe in the body.
3. Build T2b from this branch or from merged T2a: autosave flush, hydrate,
   continue-chain, and file-vs-Dexie precedence.

Paste-ready next chat prompt:

> Read `/Users/abstractmapping/projects/landroid/AGENTS.md`,
> `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`, and
> `/private/tmp/landroid-title-ledger-storage/CONTINUATION-PROMPT.md`. Continue
> T2a from branch `feat/title-ledger-runtime-storage` in
> `/private/tmp/landroid-title-ledger-storage`. The branch adds Dexie v12
> title-ledger storage tables scoped by `dbKey + workspaceId`, active-key reset
> wiring, tests, and rollback docs. Validation passed with targeted storage
> tests, `npm run lint`, `git diff --check`, `npm test`, and `npm run build`.

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
