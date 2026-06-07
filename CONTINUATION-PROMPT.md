# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Current Springhill/LCT Correctness Handoff - 2026-06-07

Active branch: `fix/springhill-lct-lease`

Worktree for this branch:
`/Users/abstractmapping/projects/landroid/.worktrees/springhill-lct-local`

Base state: remote post-#130 `main`. PR #129 was squash-merged to `main` as
`feat(storage): add storage health indicator and Backup Now`. PR #130 was
force-with-lease updated to the locally rebased `83af1aa`, passed GitHub CI,
and was squash-merged to `main` as
`02e9e9b feat(storage): add rolling auto-export`. This branch was then rebased
cleanly onto `github/main`; the current local commit should be checked with
`git log --oneline -1` because the branch was amended after PR #132 opened.

PR state: PR #132 is the Springhill/LCT branch. Keep it held/draft until the
new source-proven update is pushed and GitHub CI passes; then mark it ready for
review/merge.

### Phase Goal

Make Springhill/LCT correctness the launch gate before any Springhill live work.
Feature work T8-T19, demo polish, branch pruning, federal/private math, and the
future drill-site tract designation remain deferred.

### Current Implementation State

- `public/samples/springhill-dr-elmore.landroid` now includes the LCT Revocable
  Trust / Charlyn K. Tyra owner lease row for `OGML-LCT-Trust`, with 1/4
  royalty, active Texas jurisdiction, a Tract 1 related lease node under the
  existing LCT owner node, and a scrubbed document registry entry.
- `scripts/springhill/build_landroid.py` is now tracked on this branch and has
  configurable private input/output/report paths, raw-output guards that refuse
  repository writes, a named LCT OGML source override, and a source-to-output
  reconciliation report section. Normal rows still follow the NRI status sheet;
  `OGML-LCT-Trust` is allowed from verified OGML packet evidence because the
  NRI/leasehold spreadsheet is working evidence, not permanent source
  authority.
- `src/phase0/__tests__/springhill-sample.test.ts` guards the LCT owner, lease
  row, lease node, Tract 1 leased/unleased coverage, Tract 1 royalty/NRI
  constants, and `.landroid` import/export preservation.
- `docs/springhill-sample-workflow.md`, `TESTING.md`, `CHANGELOG.md`,
  `README.md`, and `USER_MANUAL.md` document the stricter Springhill sample
  workflow: private raw generation -> scrub -> public `.landroid` sample ->
  validation.

### Evidence / Source Boundary

- Repo-local OCR of `TORS_Documents/OGML-LCT-Trust.pdf` showed LCT Revocable
  Trust / Charlyn K. Tyra, Trustee as lessor, Magnolia Petroleum Company, LLC as
  lessee, November 19, 2025 lease date, one-year primary term, and one-fourth
  royalty.
- The user provided readable original NRI and DOTO runsheet workbook copies from
  the Springhill Dropbox folder. The raw generator ran from those originals plus
  repo-local `TORS_Documents`, wrote private raw output under `/private/tmp`,
  and reported `source-to-output executed rows missing generated lease: 0`.
- The scrubber regenerated `public/samples/springhill-dr-elmore.landroid` from
  the private raw output. It faked 100 owner addresses, replaced 122 embedded
  PDF blobs, and left no non-PDF blobs.
- The raw generator initially surfaced a bad LCT workbook remark (`3 years`);
  OCR of `OGML-LCT-Trust.pdf` confirmed the lease has a one-year primary term.
  `scripts/springhill/build_landroid.py` now overrides the LCT notes from the
  OGML packet, and `src/phase0/__tests__/springhill-sample.test.ts` asserts the
  one-year primary term and rejects the bad three-year note.

### Latest Validation

Passed in this worktree after rebasing onto post-#130 `github/main`:

- `/Users/abstractmapping/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/springhill/build_landroid.py --help`
  passed.
- `/Users/abstractmapping/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m py_compile scripts/springhill/build_landroid.py`
  passed.
- Unsafe generator output paths inside the repo are refused for both raw
  `.landroid` output and reconciliation reports.
- Raw generator run from the user-provided original workbook copies passed:
  358 nodes, 100 owners, 7 desk maps, 122 documents, 630 attachments, 60 leases,
  all tract mineral sums OK, 0 missing executed lease rows, LCT assertion PASS.
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/springhill-scrub.ts`
  regenerated the public sample from private raw output; output size was 36.2
  MB.
- `npm test -- src/phase0/__tests__/springhill-sample.test.ts src/components/deskmap/__tests__/deskmap-coverage.test.ts src/components/leasehold/__tests__/leasehold-summary.test.ts src/storage/__tests__/workspace-persistence.test.ts`
  passed, 4 files / 67 tests.
- `npm run lint` passed.
- `npm test` passed, 134 files / 919 tests. Existing intentional stderr
  appeared for simulated Dexie/title divergence failure paths.
- `npm run build` passed with existing Vite dynamic/static import warnings,
  chunk-size warnings, and Node `module.register()` deprecation warning.
- `git diff --check` passed.

Earlier validation on the same logical branch also passed `npm ci --offline`,
the Springhill sample target, adjacent Desk Map / Leasehold / storage
persistence targets, the #130 multi-tab read-only e2e smoke, and Python syntax
parse for `scripts/springhill/build_landroid.py`.

Source-to-public-sample regeneration is now completed for this branch.

### Likely Next Steps

1. Push the source-proven update to PR #132.
2. Wait for GitHub CI.
3. If CI stays green, mark PR #132 ready for review/merge.
4. Keep #131 held until its project-index import bug is addressed separately.
5. Do not start T8-T19, demo polish, branch pruning, federal/private math, or
   drill-site tract designation in this branch.

Paste-ready next chat prompt:

> Read `/Users/abstractmapping/projects/landroid/AGENTS.md`,
> `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`,
> `/Users/abstractmapping/projects/landroid/docs/README.md`, and
> `/Users/abstractmapping/projects/landroid/.worktrees/springhill-lct-local/CONTINUATION-PROMPT.md`.
> Continue branch `fix/springhill-lct-lease` in
> `/Users/abstractmapping/projects/landroid/.worktrees/springhill-lct-local`.
> First audit the live Springhill PR and remote `main` state. #129 and #130 are
> both merged; this branch is rebased onto post-#130 `main`. The user-provided
> original Springhill workbooks were readable and the source generator -> scrub
> -> public sample workflow completed. Preserve the LCT `OGML-LCT-Trust` gate
> and the one-year primary term assertion, keep the NRI/leasehold spreadsheet as
> evidence rather than permanent authority, keep #131 held, and do not start
> drill-site tract designation unless explicitly redirected.

## Current Rolling Auto-Export Handoff - 2026-06-05

Active branch: `feat/rolling-auto-export`

Worktree for this branch:
`/private/tmp/landroid-rolling-auto-export`

Base branch: stacked on open PR #129 (`feat/storage-health-and-backup-now`) so
the `Backup Now` / storage-health surface is available. PRs #128 and #129 had
green CI and clean merge state when checked, but `gh auth status` reported an
invalid local token and neither PR showed recorded `latestReviews`, so this
chat did not remote-merge them.

### Phase Goal

Add opt-in rolling `.landroid` auto-export to a local user-selected folder where
the browser File System Access API supports it, while preserving manual
`Backup Now` fallback and avoiding any cloud sync, alternate export format, or
math behavior change.

### Current Implementation State

- `src/app/current-landroid-export.ts` centralizes the current `.landroid`
  payload/options builder so manual save, `Backup Now`, and rolling
  auto-export use the same serializer inputs.
- `src/storage/rolling-auto-export.ts` isolates File System Access folder
  handles, IndexedDB handle persistence, permission checks, timestamped
  filename generation, and `.landroid` blob writes through `exportLandroidFile`.
- `src/storage/rolling-auto-export-runtime.ts` loads the stored handle on
  startup, writes an immediate snapshot after folder selection, schedules
  debounced snapshots after successful workspace/canvas autosaves, and warns
  when export is overdue or folder permission is unavailable.
- The storage health panel now shows rolling auto-export status (`off`, queued,
  writing, manual-only, overdue) plus `Auto Export` / `Change Folder` and `Off`
  controls.
- Unsupported browsers or revoked folder permission degrade to the existing
  manual `Backup Now` path with a visible warning.

### Latest Validation

Validation passed in the isolated worktree:

- `npm ci` passed with the known Node 26 engine warning and one pre-existing
  critical npm audit finding.
- `npm test -- src/storage/__tests__/rolling-auto-export.test.ts src/store/__tests__/storage-health-store.test.ts src/components/shared/__tests__/StorageHealthIndicator.test.tsx`
  passed, 3 files / 13 tests.
- `npm run lint` passed.
- `npm run build` passed with the existing Node `module.register()`
  deprecation warning, Vite dynamic/static import chunking warnings, and
  large-chunk warning.
- In-app Browser smoke against `http://127.0.0.1:5176/` confirmed the storage
  panel renders `Auto off` plus `Backup Now` and `Auto Export`.
- Playwright smoke with an injected File System Access test folder handle
  captured one immediate `.landroid` snapshot and one debounced post-edit
  snapshot in `/private/tmp/landroid-rolling-auto-export-smoke`, then simulated
  revoked permission and confirmed no third file was written while the panel
  showed manual fallback with the warning title
  `Auto-export folder permission is unavailable. Use Backup Now or choose the folder again.`
- Round-trip import of
  `/private/tmp/landroid-rolling-auto-export-smoke/Rolling Smoke Workspace-2026-06-05T23-56-37-539Z.landroid`
  through `importLandroidFile` passed with project name
  `Rolling Smoke Workspace`, 0 nodes, and 1 desk map.

Remaining before PR: `git diff --check`, commit, push, and PR creation.

### Open Risks / Deliberately Deferred

- This branch is stacked on #129. If #129 merges before PR creation, rebase this
  branch onto updated `origin/main` before opening the PR.
- Folder-handle persistence depends on browser File System Access and IndexedDB
  structured-clone support. Unsupported browsers remain manual-only.
- Auto-export writes only `.landroid` snapshots to a user-selected local
  folder. No cloud/Dropbox sync, non-`.landroid` format, dependency, math
  behavior, title read-flip enablement, real `.landroid` data, or
  `scripts/springhill/` work is included.

### Likely Next Steps

1. Run `git diff --check`.
2. Review the final diff for scope and no generated-artifact changes.
3. Commit, push `feat/rolling-auto-export`, open the PR, and stop for Claude
   review. If GitHub auth is still invalid, re-authenticate before push/PR.

Paste-ready next chat prompt:

> Read `/Users/abstractmapping/projects/landroid/AGENTS.md`,
> `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`,
> `/Users/abstractmapping/projects/landroid/docs/README.md`, and
> `/private/tmp/landroid-rolling-auto-export/CONTINUATION-PROMPT.md`. Continue
> branch `feat/rolling-auto-export` in worktree
> `/private/tmp/landroid-rolling-auto-export`. The task is opt-in rolling local
> `.landroid` auto-export where File System Access API supports it, stacked on
> PR #129's storage-health/Backup Now surface. Preserve Texas-only math, do not
> touch real `.landroid` data or `scripts/springhill/`, do not add cloud sync or
> alternate formats, finish validation, open the PR, and stop for Claude review.

## Current Post-Stack Master Handoff - 2026-06-05

Current docs handoff branch: `docs/post-stack-handoff`

Worktree for this handoff refresh: `/private/tmp/landroid-stack-119-rebase`

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

### Landed Stack

The title-ledger rebuild stack and AI project-summary context have landed on
`main` through squash merges:

- PR #123, `docs: repair rebuild handoff`, landed at
  `f9b300726b257d7067b8cdc902f7b1b3857fe8ad`.
- PR #119, `feat(storage): add title ledger runtime tables`, landed at
  `1f6e7d4ef9eb124f121a7b699036af4e05eb7076`.
- PR #120, `feat(storage): persist title ledger lifecycle`, landed at
  `9ea1e60a41e09cd214cc065b4f450874a77a324f`.
- PR #124, `feat(records): govern title read flip`, replaced closed unmerged
  PR #121 and landed at `f210227d12420e829fccffd97b64caf7aa062068`.
- PR #122, `feat(ai): add project summary context`, landed at
  `fa73aefe1705e091d6ef629607b18faae84a10ac`.

The original stacked bases captured before branch deletion were:

- `SHA_119=a393f9bcf2620b38c7b43779dfa4d40caa38d6e9`
- `SHA_120=b8fd448c39c3e9db5e51c63bda3ff43466de9f54`

### Current Implementation State

- Dexie v12 now has runtime title-ledger storage tables for `action_record` and
  `audit_event` rows scoped by `dbKey + workspaceId`.
- Runtime title-ledger lifecycle now flushes, hydrates, continues the audit
  chain, prefers valid v9 file ledgers over stale Dexie rows on import, and
  mirrors selected file/baseline ledgers back to Dexie.
- Title read-flip governance is implemented but remains default-off:
  `DEFAULT_LIVE_CUTOVER_ENABLED === false` and
  `DEFAULT_TITLE_READ_PATH_GOVERNANCE.cutoverEnabled === false`.
- The only production read source remains the existing store/snapshot path.
  Test-only governance proves cutover and flip-to-shadow revert behavior.
- Full/local AI context now includes a bounded whole-project summary for
  cross-tract questions. Hosted minimal AI context remains counts/structure only
  and must not disclose project names, party names, fractions, lease economics,
  remarks, document references, or record IDs.

### Latest Validation

Before each rebased PR was pushed, local validation passed in the isolated clone:

- #119 T2a: `npm ci`, `npm run lint`, `npm test`, `npm run build`,
  `./node_modules/.bin/tsx scripts/title-soak.ts`, and `git diff --check`
  passed. The title soak replay and math parity both passed.
- #120 T2b: `npm run lint`, `npm test`, `npm run build`,
  `./node_modules/.bin/tsx scripts/title-soak.ts`, and `git diff --check`
  passed. The title soak replay and math parity both passed.
- #124 T3 replacement for #121: `npm run lint`, `npm test`, `npm run build`,
  `./node_modules/.bin/tsx scripts/title-soak.ts`, `git diff --check`, and
  default-off/call-site scans passed.
- #122 T4: targeted hosted-minimal privacy/context tests, `npm run lint`,
  `npm test`, `npm run build`, and `git diff --check` passed.

GitHub checks were green before each merge. Existing local warnings remained the
known Node 26 engine warning, the pre-existing npm audit finding, intentional
test stderr for simulated Dexie/title divergence/post-v8 backup paths, Vite
dynamic/static import warnings, the Node `module.register()` deprecation
warning, and large-chunk warnings.

### Open Risks / Deliberately Deferred

- Production title read-flip enablement is not landed. Any enablement remains a
  separate reviewed decision after review of the landed storage/lifecycle/gate
  behavior.
- No federal/private math, lease-generator, Producers 88 replacement,
  retrieval/vector-search, SourceAttestation, real `.landroid`, or
  `scripts/springhill/` work was included in the stack.
- If rollback testing touches a browser profile that opened Dexie v12, export a
  `.landroid` backup first. If a reverted v11 build cannot open the newer
  IndexedDB version, delete that profile's `landroid-v2` database only after the
  backup, then import the backup into the reverted build.

### Checkout Warning

The visible root checkout at `/Users/abstractmapping/projects/landroid` is not a
clean `main` checkout. It is on `fix/lla-l02-warning-dots` with unrelated
untracked local paths:

- `.worktrees/`
- `docs/archive/audits/LINE_BY_LINE_AUDIT_2026-05-31.md`
- `scripts/springhill/`

Do not stage or edit those paths unless the user explicitly asks for that work.

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

1. Review and merge `docs/post-stack-handoff` so future chats see the landed
   stack state first.
2. Run final `main` validation after the docs handoff lands if the ticket needs
   a final post-merge closeout: `npm run lint`, `npm test`, `npm run build`,
   `./node_modules/.bin/tsx scripts/title-soak.ts`, and `git diff --check`.
3. Review the landed T2/T3 behavior together before any production read-flip
   enablement work.
4. Keep Producers 88 separate until the user chooses the target file set.

Paste-ready next chat prompt:

> Read `/Users/abstractmapping/projects/landroid/AGENTS.md`,
> `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`,
> `/Users/abstractmapping/projects/landroid/docs/README.md`, and
> `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`. Continue
> from the post-stack master handoff. The title-ledger storage/lifecycle stack,
> governed default-off read-flip readiness, and AI project-summary context have
> landed through PRs #119, #120, #124, and #122 after #123 repaired the master
> handoff. Production title reads remain on the store/snapshot path; do not
> enable the read flip without a separate reviewed decision. Producers 88 is a
> separate pending redirect requiring clarification before edits.

### Audit Handoff Prompt For Claude

Use this prompt for a cold audit of the current rebuild sequence:

> Audit LANDroid from the rebuild-first master handoff. Start read-only. Read
> `AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and
> `CONTINUATION-PROMPT.md`. Verify the actual GitHub PR state before trusting
> branch-local notes. Expected state on 2026-06-05: PRs #119, #120, #124, and
> #122 are merged on `main`; original PR #121 is closed unmerged and was
> replaced by #124; this docs handoff branch is `docs/post-stack-handoff`.
>
> Audit the landed stack in this order: #123 handoff repair, #119 T2a runtime
> ledger storage, #120 T2b lifecycle persistence and file-vs-Dexie precedence,
> #124 T3 default-off read-flip governance, and #122 hosted/full AI context
> behavior. Confirm #120 file-ledger precedence over stale Dexie rows and
> hydrate/flush behavior especially carefully. Confirm #124 does not enable
> production title reads. Confirm #122 hosted minimal AI context does not
> disclose project names, party names, fractions, lease economics, remarks,
> document references, or record IDs. Keep Producers 88 separate: determine
> candidate file sets, then ask the user what "those files" means before edits.
> Do not modify `scripts/springhill/`, real `.landroid` files, math/precision
> behavior, or production read-flip settings unless a concrete defect is found
> and the user authorizes the correction.

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
