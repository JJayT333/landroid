# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

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
