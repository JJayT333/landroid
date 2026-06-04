# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Current Rebuild-First Master Handoff - 2026-06-04

Current docs repair branch: `docs/rebuild-handoff-repair`

Worktree for this repair: `/private/tmp/landroid-rebuild-handoff-repair`

### Current Posture

LANDroid is in active rebuild with a single operator and no production users.
The priority is correct architecture with reviewable, reversible commits. The
mandatory guardrails are:

- `.landroid` export/import remains the escape hatch.
- No destructive migration ships without backup and recovery notes.
- No math or precision behavior changes without Phase 0 golden-master coverage.
- `MathInputView` parity and `.landroid` round-trip gates stay green or are
  updated deliberately and reviewably.
- No real-data leakage, no `scripts/springhill/` leakage, and no hidden behavior
  changes.
- The title read-flip is a near-term governed gate, but production enablement is
  still a separate reviewed decision.

### Checkout Warning

The visible root checkout at `/Users/abstractmapping/projects/landroid` is not a
clean `main` checkout. It is on `fix/lla-l02-warning-dots` with unrelated
untracked local paths:

- `.worktrees/`
- `docs/archive/audits/LINE_BY_LINE_AUDIT_2026-05-31.md`
- `scripts/springhill/`

Do not stage or edit those paths unless the user explicitly asks for that work.

### Current PR Stack

- T0: PR #118, `docs: adopt rebuild-first posture`, merged.
- T1: PRs #111-#117, remediation merge train, merged.
- T2a: PR #119, `feat(storage): add title ledger runtime tables`, open from
  `feat/title-ledger-runtime-storage` to `main`.
- T2b: PR #120, `feat(storage): persist title ledger lifecycle`, open from
  `feat/title-ledger-runtime-lifecycle` to
  `feat/title-ledger-runtime-storage`; stacked on T2a.
- T3: PR #121, `feat(records): govern title read flip`, open from
  `feat/title-read-flip-governance` to
  `feat/title-ledger-runtime-lifecycle`; stacked on T2b. This must not enable
  production reads.
- T4: PR #122, `feat(ai): add project summary context`, open from
  `feat/ai-project-summary-context` to `main`; independent from the T2/T3 stack.
- T5: optional and deferred.

### Audit Status

- Handoff integrity was the defect: branch-local handoffs were current, but the
  root handoff had been overwritten by branch-specific state. This branch exists
  only to repair the root handoff.
- No amendment is currently required for PRs #119-#122 based on the latest
  audit. PR #120 remains the highest-risk open review item because it owns title
  ledger hydrate, precedence, and file-vs-Dexie behavior.
- Producers 88/template replacement is a pending user redirect, not part of
  PR #122 and not part of this docs repair.

### Validation Status By Open PR

- #119 T2a validation: targeted title-ledger/reset tests passed; `npm run lint`
  passed; `git diff --check` passed; `npm test` passed; `npm run build` passed.
  It adds Dexie v12 tables and reset wiring only. No flush, hydrate, read-path
  change, or production flip is included.
- #120 T2b validation: targeted lifecycle/storage/title-action tests passed;
  `npm run lint` passed; `git diff --check` passed; `npm test` passed;
  `npm run build` passed; `./node_modules/.bin/tsx scripts/title-soak.ts`
  passed. Review file-ledger precedence over stale Dexie rows closely.
- #121 T3 validation: targeted cutover/read-path/read-flip/math-parity tests
  passed; `npm run lint` passed; `git diff --check` passed; `npm test` passed;
  `npm run build` passed; `./node_modules/.bin/tsx scripts/title-soak.ts`
  passed. Production read-flip is not enabled.
- #122 T4 validation: targeted AI context tests passed; `npm run lint` passed;
  `npm test` passed; `npm run build` passed; `git diff --check` passed. Hosted
  minimal context remains counts/structure only; richer rollups remain behind
  the full-context disclosure gate.

### Producers 88 Pending Redirect

Treat Producers 88 as its own branch after clarification. Candidate file sets
found during the audit:

- `docs/lease-generator/Producers_88.docx`, `Producers_88.pdf`, and `README.md`.
- `scripts/springhill-scrub.ts`, which uses the Producers 88 PDF as the blank
  replacement source.
- `public/samples/springhill-dr-elmore.landroid`, which embeds scrubbed blank
  document replacements.

Ask the user what "those files" refers to before planning Producers 88 edits.
Do not edit real `.landroid` payloads or `scripts/springhill/` unless explicitly
authorized.

### Likely Next Steps

1. Review and merge this tiny docs branch so future chats see the master rebuild
   state first.
2. Review the open T2/T3/T4 PRs in dependency order: #119, #120, #121, and #122.
3. Keep Producers 88 separate until the user chooses the target file set.

Paste-ready next chat prompt:

> Read `/Users/abstractmapping/projects/landroid/AGENTS.md`,
> `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`,
> `/Users/abstractmapping/projects/landroid/docs/README.md`, and the repaired
> `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`. Continue
> from the rebuild-first master handoff. T0 #118 and T1 #111-#117 are merged;
> T2a #119, T2b #120, T3 #121, and T4 #122 are open; T3 does not include a
> production read flip; Producers 88 is a separate pending redirect requiring
> clarification before edits.

### Audit Handoff Prompt For Claude

Use this prompt for a cold audit of the current rebuild sequence:

> Audit LANDroid from the rebuild-first master handoff. Start read-only. Read
> `AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and
> `CONTINUATION-PROMPT.md`. Verify the actual GitHub PR state before trusting
> branch-local notes. Expected state on 2026-06-04: T0 PR #118 is merged; T1
> PRs #111-#117 are merged; T2a PR #119 is open from
> `feat/title-ledger-runtime-storage` to `main`; T2b PR #120 is open from
> `feat/title-ledger-runtime-lifecycle` to
> `feat/title-ledger-runtime-storage`; T3 PR #121 is open from
> `feat/title-read-flip-governance` to
> `feat/title-ledger-runtime-lifecycle`; T4 PR #122 is open from
> `feat/ai-project-summary-context` to `main`; docs repair PR #123 is open from
> `docs/rebuild-handoff-repair` to `main`.
>
> Audit in this order: #123 handoff repair, merged train #111-#118, T2a #119,
> T2b #120, T3 #121, and T4 #122. Confirm #120 file-vs-Dexie precedence and
> hydrate/flush behavior especially carefully. Confirm T3 does not enable
> production title reads. Confirm T4 hosted minimal AI context does not disclose
> project names, party names, fractions, lease economics, remarks, document
> references, or record IDs. Keep Producers 88 separate: determine candidate
> file sets, then ask the user what "those files" means before edits. Do not
> modify `scripts/springhill/`, real `.landroid` files, math/precision behavior,
> production read-flip settings, or open PR branches unless a concrete defect is
> found and the user authorizes the correction.

## Historical Branch Notes

The following notes are historical only. The active state is the master handoff
above.

`feat/v9-landroid-durable-format` - completed v9 `.landroid` action-ledger
durability branch from 2026-06-02. It added optional `actionLedger` export/import
while keeping the snapshot authoritative. Runtime Dexie storage, lifecycle
hydrate/flush, and read-flip work moved into later T2/T3 branches.

`chore/audit-cleanup` - main-line audit cleanup branch based on `main` at
`3768ff5` on 2026-06-02.

Do not commit directly to `main`. The historical audit-cleanup branch was
intended for a PR back to `main`.

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

Historical next steps from that branch handoff:

- Push `chore/audit-cleanup`.
- Open a PR against `main`.
- Review PR #98 separately before continuing title-action cutover work.
