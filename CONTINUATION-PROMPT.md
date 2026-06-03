# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Current LLA-M01 Handoff - 2026-06-03

Branch: `fix/lla-m01-rollback-determinism`

Workstream: storage/import rollback determinism, based on `main`.

Completed in this branch:

- LLA-M01: `.landroid` side-store rollback now waits for all target
  side-store replacements to settle before rollback begins.
- Rollback replacement also uses a settled barrier, so no late target write can
  land after rollback and leave a mixed old/new side-store state.
- `replaceWorkspaceSideStores` keeps its public signature and success behavior:
  successful replacement still writes owner, document, map, research, and
  curative side stores, then clears workspace shards plus AI approval, journal,
  and undo state.
- Added side-store reset tests for direct success, rollback-wrapper success,
  failed replacement rollback, and the delayed-target-write regression.
- `docs/audit-backlog.md` marks LLA-M01 fixed with a note that broader
  storage isolation/write-fence work remains LLA-H01/H02.

Latest validation:

- `npm run lint`
  - passed.
- `npm test -- src/storage/__tests__/workspace-side-store-reset.test.ts`
  - passed, 1 file / 5 tests.
- `npm test -- src/storage/__tests__/workspace-persistence.test.ts`
  - passed, 1 file / 19 tests.
- `npm test`
  - passed, 121 files / 843 tests. Existing intentional stderr appeared for
    simulated Dexie failures, title divergence, and post-v8 backup failure.
  - first full run in the fresh worktree failed because `elkjs` resolved from
    the original checkout's `node_modules`; after `npm ci` installed
    worktree-local dependencies, the full suite passed.
- `npm run build`
  - passed with existing Vite warnings for missing `TORS_Documents` runtime
    PDFs, dynamic/static import chunking, large chunks, and Node
    `module.register()` deprecation.

Open risks / deliberately deferred:

- LLA-H01/H02, LLA-M06, and all other backlog items remain out of scope.
- This branch does not change math, title/action-layer behavior, AI mutation
  behavior, store APIs, or `.landroid` parsing.
- `npm ci` in the worktree reported the existing Node 26 engine warning and one
  critical audit item; no dependency files changed.

Likely next steps:

1. Commit the LLA-M01 storage/test/docs changes.
2. Push `fix/lla-m01-rollback-determinism`.
3. Open a PR to `main` titled
   `fix(storage): deterministic side-store rollback on failed import (LLA-M01)`.

Paste-ready next chat prompt:

> Read `/Users/abstractmapping/projects/landroid/AGENTS.md`,
> `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`, and
> `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`. Continue
> LLA-M01 on branch `fix/lla-m01-rollback-determinism`. The branch makes
> `.landroid` side-store rollback deterministic by waiting for target
> replacement branches to settle before rollback and passed lint, targeted
> storage tests, full `npm test`, and build.

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
