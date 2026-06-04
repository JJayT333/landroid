# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Current Rebuild-First Posture Handoff - 2026-06-04

Branch: `docs/rebuild-first-posture`

Workstream: T0 rebuild-first posture update.

LANDroid is now governed by this posture: as of 2026-06-04, LANDroid is in
active rebuild with a single operator and no production users. Priority is
correct architecture, not continuous runnability; temporary breakage during a
rebuild step is acceptable. Safety comes from reversibility and validation, not
from preserving live behavior at every step. Required of every change: branch
isolation with revertible commits; `.landroid` export/import is the escape hatch
and no destructive migration ships without a backup plus documented recovery; no
math/precision change without the Phase 0 golden masters; `MathInputView` parity
and `.landroid` round-trip stay green or are updated deliberately and
reviewably; no real-data or `scripts/springhill/` leakage; no hidden behavior
changes; name behavior changes and update the relevant source-of-truth doc; no
speculative features added just because breakage is cheap. The action/record
layer becoming the canonical read source, the read-flip, is now a near-term
designed gate, not deferred. This supersedes prior additive, snapshot-first, or
keep-live-behavior guidance where they conflict.

Current implementation order:

1. Finish this docs posture branch and merge it through PR.
2. Complete the open remediation merge train (#111-#117) without broadening it.
3. Build title-ledger runtime storage, then flush/hydrate lifecycle.
4. Convert the existing title read-flip machinery from hard-disabled to
   governed/default-off; production enablement remains a separate reviewed
   decision after the gates are green.
5. Add AI whole-project summary context with hosted minimal privacy preserved.

Do not touch real `.landroid` files or `scripts/springhill/` in Codex tickets.
The load-bearing invariants through the read-flip work are `MathInputView`
goldens and `.landroid` export/import round-trip.

## Current V9 Durable Format Handoff - 2026-06-02

Branch: `feat/v9-landroid-durable-format`

Workstream: v9 `.landroid` action-ledger durability, based on `origin/main` in
the isolated worktree `/private/tmp/landroid-v9-landroid`.

Completed in this branch:

- `LANDROID_FILE_VERSION` is now 9.
- Manual `.landroid` save can embed a validated `actionLedger` bundle containing
  only title `action_record` and `audit_event` rows from `useTitleActionLog`.
- `ACTION_LAYER_EXPORT_GATE` uses the explicit
  `RECORD_BEARING_LANDROID_VERSION = 9`, so v8 still rejects records and v9
  allows them.
- `.landroid` import keeps the snapshot authoritative. Valid ledgers are
  attached to returned `LandroidFileData`; schema-invalid or chain-broken
  ledgers are dropped with `console.warn` and the snapshot still loads.
- Autosave/backup callers keep using the optional export parameter and write v9
  snapshots without an embedded ledger.
- Docs/backlog now mark DEF-ACT-04 fixed by the v9 file format and ACT-H03 only
  partially fixed because runtime Dexie ledger persistence remains deferred.
- Added `scripts/title-soak.ts` as a synthetic-only soak harness for replay and
  math parity.

Latest validation:

- `npm ci` - passed in the isolated worktree, with an engine warning because the
  local shell reports Node 26 while the repo declares Node 22-25, plus the
  pre-existing npm audit finding.
- `npm run lint` - passed.
- `npm test -- src/project-records/__tests__/action-persistence.test.ts src/storage/__tests__/workspace-persistence.test.ts src/phase0/__tests__/vulcan-mesa-fixtures.test.ts`
  - passed, 3 files / 36 tests.
- `npm test` - passed, 121 files / 844 tests. Existing intentional stderr
  appeared for simulated Dexie failures, title divergence, and post-v8 backup
  failure paths.
- `npx tsx scripts/title-soak.ts` - passed with `RESULT: PASS` after an
  escalated rerun because the sandbox blocked tsx's local IPC pipe.
- `npm run build` - passed with existing Vite warnings for missing TORS PDF
  runtime URLs, dynamic/static import chunking, the Node `module.register()`
  deprecation warning, and large chunks.
- `git diff --check` - passed.

Open risks / deliberately deferred:

- This is file-format work only. No Dexie tables, runtime ledger hydration,
  autosave ledger persistence, read-path flip, divergence UX, snapshot
  compaction, or full projected-bundle embedding is included.
- v9 files are forward-incompatible with older v8-only builds by design.
- The Navbar reads `useTitleActionLog.getState()` only inside `handleSave`.
  Review should confirm no render-time subscription or autosave wiring was
  introduced.
- The original checkout at `/Users/abstractmapping/projects/landroid` still has
  unrelated local noise from the prior branch; this worktree did not touch it.

Likely next steps:

1. Review the v9 file-format diff, especially `workspace-persistence.ts`,
   `Navbar.tsx`, and the storage/action tests.
2. Push `feat/v9-landroid-durable-format`.
3. Open a PR to `main` with the required review-risk callouts.

Paste-ready next chat prompt:

> Read `/Users/abstractmapping/projects/landroid/AGENTS.md`,
> `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`, and
> `/private/tmp/landroid-v9-landroid/CONTINUATION-PROMPT.md`. Continue the v9
> `.landroid` durable-format branch `feat/v9-landroid-durable-format` from the
> isolated worktree `/private/tmp/landroid-v9-landroid`. The branch implements
> v9 `actionLedger` export/import while keeping the snapshot authoritative;
> validation passed with `npm run lint`, targeted tests, `npm test`,
> `npx tsx scripts/title-soak.ts`, `npm run build`, and `git diff --check`.

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
