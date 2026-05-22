# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and
`DEPLOYMENT_STATE.md` before touching code. Keep long history in
`CHANGELOG.md`.

## Current Branch

Current checked-out branch:
`codex/audit-pass-a-2026-05-20`.

Do not commit directly to `main` unless the user explicitly asks for a direct
main push/deploy.

## Current Workstream

AI/security/structure/performance audit remediation has started. Phase 0 plus
the first Phase 1 AI safety chunks are implemented on this branch.

Rebuild planning is now documented and amended, but implementation has not
started. The current planning source of truth is `docs/rebuild-plan.md`. It
consolidates the incremental rebuild direction: inventory current page/workflow
behavior first, then Phase 0.5 workspace sharding, project record schema,
evidence-grade document vault, source attestations, import sessions, action
plans/action records, citation-verified AI, project-wide party identity,
well/unit/obligation reference records, and only later gated math expansion.
It also adds the title-opinion-as-root workflow, the Springhill-style Excel plus
document folder package workflow, attorney/eDiscovery packet sidecars,
`MathInputView`, `CitationVerifier`, `OpinionDraft`, `ObligationCalendar`, and
`AbstractorPackage` as rebuild planning requirements. The plan explicitly
reconciles the outside rebuild proposal, the repo-grounded analysis, and the
side-by-side review PDF, while locking dual decimal plus fraction display,
print fidelity, in-flight migration safety, multi-tab conflict handling, and
source citation proof as rebuild contracts.
Proposed ADRs were added for storage trajectory, AI citation verification, and
the action/audit schema. A proposed backend-spine ADR was added after the user
decided the next deep review should focus on Phase 0 and that backend
future-proofing should be decided immediately after Phase 0.

Current agreed rebuild sequence:

1. Run a Phase 0 ultra-review focused only on current-behavior capture,
   inventory lanes, fixture plan, golden masters, performance baselines, and
   Phase 0 exit criteria.
2. Execute Phase 0 lane by lane under one lead source-of-truth thread. Secondary
   agents may perform read-only lane reviews, but they should not create
   competing master plans.
3. Revisit the rebuild direction after Phase 0 because current-state findings
   may change the best sequence.
4. Run Phase 0.75 backend architecture decision before Phase 0.5 storage work
   or Phase 1 schema implementation. If approved, add a backend spine for
   durable records, object storage, OCR/index/export jobs, search, AI/RAG
   policy, audit logs, backup/sync, and future permissions while keeping
   `.landroid` package export mandatory.
5. Continue to Phase 0.5 storage sharding or backend-spine foundation depending
   on the Phase 0.75 decision.

Primary report:

- `docs/archive/audits/AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`

Pass A remains the backbone. Phase 0 pulled in the verified Pass B overlaps the
user listed:

- AI undo snapshot capture now fails closed if document side-store export fails.
- `.landroid` import rejects future schema versions.
- `.landroid` side-store replacement rolls back to previous active side stores
  if replacement fails before core workspace swap.
- Focused Leasehold decimal rows filter unit-scoped ORRI/WI by the focused
  tract's unit and `includedInMath`.
- CSV row staging no longer defaults ambiguous NPRI rows to fixed /
  burdened-branch. Unknown fixed/floating or fixed-basis answers mark the row
  `needs_question` / `needs answer` and block node creation until answered.

The next AI foundation chunk is also implemented:

- Approved AI proposals now capture structured approval details before the user
  applies them.
- Approval cards now show typed before/after previews and graph-validation
  previews where LANDroid can simulate the proposal.
- Proposals with blocked previews cannot be approved and do not take undo
  snapshots.
- Applied / failed / undone AI proposal results are recorded in an in-memory
  session action journal.
- Future local AI turns receive a concise approved-action journal so chained
  edits can reuse exact IDs and validation results from earlier approved work.
- The AI panel exposes the recent approved-action journal, and replacing a
  workspace clears approval, undo, and action-journal state.
- The hosted AI proxy now rejects client-supplied `tools` / `tool_choice`
  fields before usage charging or upstream forwarding.
- Map asset uploads now use an explicit passive-file allowlist and validate PDF
  magic bytes before saving or previewing PDF maps.

The full runsheet walkthrough wizard has not been started.

## Latest Validation

Commands run on this branch:

- `npm run lint` - passed.
- Red/green targeted checks:
  - `npm test -- src/components/leasehold/__tests__/leasehold-summary.test.ts`
    initially failed on wrong-unit ORRI/WI focused rows, then passed after the
    filter fix.
  - `npm test -- src/ai/__tests__/undo-store.test.ts` initially failed because
    document export errors were swallowed, then passed after the fail-closed
    change.
  - `npm test -- src/storage/__tests__/workspace-persistence.test.ts src/storage/__tests__/workspace-side-store-reset.test.ts`
    initially failed for unsupported future version / missing rollback helper,
    then passed after the storage fixes.
  - `npm test -- src/ai/wizard/__tests__/row-staging.test.ts` initially failed
    on NPRI fixed / burdened-branch defaults, then passed after the
    `needs_question` staging change.
- `npm test -- src/ai/wizard` - passed, 3 files / 27 tests.
- `npm test -- src/ai/__tests__/action-journal.test.ts src/ai/__tests__/chat-context.test.ts src/ai/__tests__/tools.test.ts src/storage/__tests__/workspace-side-store-reset.test.ts`
  - passed, 4 files / 18 tests.
- `npm test -- src/ai/__tests__/approval-preview.test.ts src/ai/__tests__/tools.test.ts src/ai/__tests__/action-journal.test.ts`
  - passed, 3 files / 17 tests.
- `cd backend/ai-proxy && npm test` - passed, 3 files / 41 tests.
- `cd backend/ai-proxy && npm run build` - passed.
- `npm test -- src/maps/__tests__/map-asset-upload.test.ts src/utils/__tests__/file-validation.test.ts src/store/__tests__/map-store.test.ts`
  - passed, 3 files / 23 tests.
- `npm test -- src/ai src/storage src/components/leasehold` - passed, 25 files /
  177 tests. An initial run failed after the undo fail-closed change because AI
  tool tests did not mock document snapshot export; the tests now provide an
  explicit empty document snapshot.
- `npm test` - passed, 78 files / 627 tests. Existing intentional stderr
  coverage for simulated Dexie failures appeared.
- `npm run build` - passed with existing Vite dynamic/static import warnings,
  chunk-size warning, and Node `module.register()` deprecation warning.
- `npm run test:e2e` - passed, 11 Playwright tests.
- `git diff --check` - passed.
- `git diff --check -- *.md docs/**/*.md` - passed after the rebuild-plan
  amendment docs-only pass.

## Top Findings To Carry Forward

- P0 before rebuild: Phase 0 must now produce frozen reference workspaces,
  atomic behavior catalog rows, measured performance baselines, and CI-running
  golden masters before Phase 1 implementation starts.
- P0.5 before rebuild schema work: workspace persistence needs sharding inside
  Dexie before broad record-schema work, so Raven Forest scale does not depend
  on one large autosaved workspace payload, unless Phase 0.75 approves a
  backend path that changes the storage foundation.
- P0.75: Backend should be decided after Phase 0, not guessed before it. The
  backend can improve durability, OCR/jobs, search, AI/RAG, audit, backup/sync,
  and future permissions, but it also adds APIs, migrations, auth, deployment,
  cost, monitoring, and security responsibilities.
- P1: The Document Vault plan now means evidence-grade durability: immutable
  originals, hashes, document versions, extraction runs, citation anchors,
  deterministic manifests, and audit-event continuity.
- P1: AI document-text answers are not allowed before OCR/text extraction
  creates citation anchors and `CitationVerifier` can reject unsupported
  claims.
- P1: The desired runsheet assistant is not built end to end. Current pieces
  parse/stage rows or create desk maps, but not the full guided import,
  question, attachment, owner, lease, and graph workflow.
- P1/P2: AI approval previews now cover the current mutating tools, but they are
  still session-local UI safety surfaces rather than durable audit records.
- P2: Document attachment ordering is still not fully scoped by workspace.

## Open Risks And Assumptions

- This branch now contains Phase 0 source/docs remediation plus the original
  audit report artifact, AI approval-preview/action-journal foundation work, and
  map upload hardening, plus an undeployed hosted proxy policy hardening change,
  plus a docs-only rebuild-plan amendment pass.
- `docs/landroid-rebuild-plan-reviews.pdf` is currently untracked local input
  from the user; do not delete or commit it unless the user explicitly asks.
- The action journal is in-memory session context, not a durable audit log.
- Approval previews are deterministic, typed summaries for the current proposal;
  they do not persist as formal audit records.
- Lambda source changes under `backend/ai-proxy` still require a manual bundle
  and upload to affect the hosted proxy.
- The full runsheet import-session / walkthrough wizard is still open and should
  not be started without explicit direction.
- SQLite/OPFS, Tauri 2, cloud object storage, and cloud OCR are documented
  decision gates only; they are not approved implementation defaults.
- Backend implementation is not approved until Phase 0 evidence is captured and
  Phase 0.75 produces a written go/no-go plus updated security/deployment/test
  docs.
- MCP servers are relevant later for external systems such as county records,
  OCR, GIS, storage vaults, or backend-only connectors, but should not bypass
  LANDroid approval/undo/audit boundaries.

## Likely Next Steps

- If continuing rebuild planning, run the Phase 0 ultra-review next. Do not run
  another broad rebuild audit first.
- If starting rebuild work after the Phase 0 ultra-review, start with the Phase
  0 inventory in
  `docs/rebuild-plan.md`: document each page's current workflows, backing
  stores/helpers, existing tests, missing tests, migration risks, manual smoke
  checks, reference workspace fixtures, and performance baselines before
  changing behavior.
- After Phase 0, run Phase 0.75 backend architecture decision and then revisit
  the rebuild plan before Phase 0.5 or Phase 1 implementation.
- Continue the Phase 1 AI foundation in small steps:
  - make result summaries more domain-specific where tool outputs are richer,
  - decide whether any action-journal records should become durable audit
    records later.
- Then choose the next hardening item:
  - document attachment ordering scoped by workspace,
  - structured runsheet import-session model.
- Do not start the full runsheet walkthrough wizard unless the user explicitly
  redirects to that scope.

## Paste-Ready Next Chat Prompt

Resume in `/Users/abstractmapping/projects/landroid` on
`codex/audit-pass-a-2026-05-20`. Read `AGENTS.md`, `PROJECT_CONTEXT.md`,
`docs/README.md`, `DEPLOYMENT_STATE.md`, and `CONTINUATION-PROMPT.md` first.
Pass A is `docs/archive/audits/AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`.
Phase 0 is implemented: AI undo fail-closed, future `.landroid` version
rejection, rollback-safe `.landroid` side-store replacement, focused Leasehold
ORRI/WI unit filtering, and NPRI `needs_question` row staging. The first Phase 1
AI foundation chunk is also implemented: structured approval details,
typed before/after approval previews, graph-validation previews, blocked-preview
approval refusal, in-memory applied/failed/undone action journal, future local
model context from approved results, journal visibility in the AI panel, and
journal clearing on workspace replacement. Hosted proxy source now rejects
client-supplied `tools` / `tool_choice` fields before usage charging; Lambda
changes still need manual bundle/upload to deploy. Map uploads now enforce a
passive allowlist and validate PDF bytes before save/preview.
Rebuild planning has been amended in `docs/rebuild-plan.md`, `ROADMAP.md`,
`IDEAS.md`, `ARCHITECTURE.md`, `TESTING.md`, `SECURITY.md`, `docs/README.md`,
and proposed ADRs 0005-0008 after reading the side-by-side review PDF and the
user's Phase 0/backend sequencing decision. The amended plan keeps the
incremental approach but renames the target to project record schema, adds the
Phase 0 ultra-review process, sectioned Phase 0 execution, Phase 0.75 backend
architecture decision, Phase 0.5 workspace sharding, stronger Phase 0 exit
gates, the Evidence Vault contract, `MathInputView`, `CitationVerifier`,
OCR/citation-anchor sequencing, attorney/eDiscovery packet sidecars,
print/migration/multi-tab contracts, and explicit SQLite/Tauri/cloud/backend
decision gates. Latest validation passed:
`npm run lint`, targeted Phase 0/action-journal/approval-preview tests,
backend proxy tests/build, targeted map upload tests, `npm test`,
`npm run build`, `npm run test:e2e`, and
`git diff --check -- *.md docs/**/*.md`.
Do not start the full runsheet walkthrough wizard unless explicitly directed.
Recommended next step is the Phase 0 ultra-review, then sectioned Phase 0
inventory/golden-master work, then Phase 0.75 backend go/no-go.
