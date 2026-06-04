# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Current Title Read-Flip Governance Handoff - 2026-06-04

Branch: `feat/title-read-flip-governance`

Worktree: `/private/tmp/landroid-title-read-flip-governance`

Workstream: T3 read-flip governance, branched from T2b
`feat/title-ledger-runtime-lifecycle`. T0 rebuild-first posture and the T1
remediation merge train (#111-#117) are complete on `main`. T2a is PR #119 and
T2b is PR #120.

Completed in this branch:

- `CutoverRegistry` now has explicit default-off governance. Default production
  posture still throws `CutoverDisabledError`; test-only registries can pass
  `{ liveCutoverEnabled: true }` to prove cutover and revert behavior.
- `TitleTreeCutoverGate` now requires the full T3 evidence set before candidacy:
  enough clean inline parities, clean MathInputView parity, clean `.landroid`
  export-import-replay round trip, and no active runtime ledger divergence/error.
- `TitleReadPathFlag` now has explicit default-off governance. Default
  `cutOver()` throws `TitleReadFlipDisabledError`; test-only flags can enable
  cutover with a reviewer token and then return to shadow.
- `title-read-flip-governance.test.ts` proves a synthetic `.landroid` v9
  export/import/replay round trip, action-derived read equivalence to the store
  projection, clean math parity, governed test-only cutover, and flip-to-shadow
  revert.
- `ARCHITECTURE.md`, `ROADMAP.md`,
  `docs/phase-4-v9-durable-format-scope.md`,
  `docs/phase-4-title-cutover-notes.md`, and
  `docs/phase-4-action-layer-notes.md` now describe T3 as governed/default-off
  readiness, not production enablement.

Explicitly not included:

- No production read flip and no change to canonical reads. Zustand/snapshot
  reads remain authoritative until a separate reviewed enablement decision.
- No math/precision behavior change.
- No real `.landroid` files or `scripts/springhill/` changes.
- No new retrieval, AI, spreadsheet export, SourceAttestation, or lease-generator
  work.

Flip-to-shadow revert recipe:

1. For T3 itself, revert this PR or leave default governance disabled. No data
   migration is required because the store/snapshot path remains canonical.
2. If a later reviewed PR enables production governance, immediately revert by
   calling `TitleReadPathFlag.revertToShadow()` and
   `TitleTreeCutoverGate.revertToShadow()`, with governance set back to disabled.
3. Keep the `.landroid` backup taken before any future production enablement
   test. If runtime ledger persistence is also being reverted, use the Dexie v12
   rollback recipe in `docs/phase-4-v9-durable-format-scope.md`.

Latest validation:

- `npm test -- src/project-records/__tests__/action-cutover.test.ts src/project-records/__tests__/title-cutover-gate.test.ts src/project-records/__tests__/title-read-path.test.ts src/project-records/__tests__/title-read-flip.test.ts src/project-records/__tests__/title-read-flip-governance.test.ts src/project-records/__tests__/title-math-parity.test.ts`
  - passed, 6 files / 27 tests.
- `npm run lint` - passed.
- `git diff --check` - passed.
- `npm test` - passed, 130 files / 899 tests. Existing intentional stderr
  appeared for simulated Dexie failures, title divergence, and post-v8 backup
  failure paths.
- `npm run build` - passed with existing Vite dynamic/static import warnings,
  the Node `module.register()` deprecation warning, and large-chunk warning.
- `./node_modules/.bin/tsx scripts/title-soak.ts` - passed on the synthetic
  Vulcan Mesa fixture: replay == adapter and math parity both PASS.

Open risks / deliberately deferred:

- Production read-flip enablement is still a separate reviewed decision after
  T2a/T2b/T3 are reviewed together. This branch proves the path and gates only.
- T2b remains the riskiest lifecycle slice in the stack because
  hydrate/precedence/file-vs-Dexie coherence decides which ledger survives a
  load/import.
- No e2e run was performed for T3 because no visible browser workflow changed;
  run e2e if review wants a full app smoke before merge.

Likely next steps:

1. Push `feat/title-read-flip-governance` and open the stacked PR against
   `feat/title-ledger-runtime-lifecycle`.
2. Review T2a/T2b/T3 in order, with close attention to T2b lifecycle coherence
   and T3's non-flip guarantee.
3. After review, decide separately whether and when a production read-flip
   enablement PR should be written.

Paste-ready next chat prompt:

> Read `/Users/abstractmapping/projects/landroid/AGENTS.md`,
> `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`, and
> `/private/tmp/landroid-title-read-flip-governance/CONTINUATION-PROMPT.md`.
> Continue T3 from branch `feat/title-read-flip-governance` in
> `/private/tmp/landroid-title-read-flip-governance`. The branch converts the
> existing title read-flip machinery to governed/default-off, proves test-only
> cutover plus flip-to-shadow revert, keeps production reads on the store, and
> updates the source-of-truth docs. Validation passed with targeted T3 tests,
> `npm run lint`, `git diff --check`, `npm test`, `npm run build`, and
> `./node_modules/.bin/tsx scripts/title-soak.ts`.

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
