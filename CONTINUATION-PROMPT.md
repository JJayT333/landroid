# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.

## Current Branch

Current checkpoint branch: `codex/phase-5-doc-storage-wrap-2026-05-15`,
created from `claude/phase-5-document-refactor-2026-05-15`, which descended
from `codex/hosted-hardening-2026-05-14`. The PR target remains
`codex/hosted-hardening-2026-05-14`, not `main`.

Do not commit directly to `main`.

## Phase 5 Status (Document/PDF Persistence Refactor)

This branch wraps the Phase 5 document/PDF persistence work plus the Phase 6
UX/accessibility and low-blast-radius hardening cleanup.

Completed:

- Phase A-C: v8 `documents` + `document_attachments`, document-store CRUD,
  sha-256 hashing, node attachment summaries, workspace-store document actions,
  v8 `.landroid` export/import with v7 dispatch, and the post-v8 one-shot v7
  backup hook.
- Phase B UI: `DeskMapDocumentChips`, shared `AttachmentsSection` in
  `NodeEditModal`, document-open callback chain, and shared modal focus trap.
- Phase D: `seed-test-data.ts` now gives selected Raven Forest conveying nodes
  the natural Texas deed + obituary + affidavit of heirship pattern through the
  new v8 attach actions.
- Phase E: Playwright coverage is restored against v8. The suite includes
  multi-document chip opening by `attachmentId`, the retargeted combinatorial
  demo chip workflow, v8 `.landroid` round-trip, branch-scoped lease delete,
  curative linkage, and research linkage.
- Phase F: doc rail updated in `CHANGELOG.md`, `USER_MANUAL.md`,
  `SECURITY.md`, `TESTING.md`, this continuation prompt, `docs/README.md`,
  ADR 0004, and `docs/phase-5-document-refactor.md`.
- Phase 6 UX/accessibility cleanup continued: app-level native `confirm()` /
  `alert()` calls have been replaced with the shared LANDroid
  confirmation/alert modal; workspace-replacing demo, `.landroid`, and CSV
  loads now require typed confirmation; Flowchart `Clear` uses the shared modal;
  and primary navigation, Desk Map tract tabs, owner tabs, Research sections,
  Federal Leasing tabs, and shared form controls expose clearer labels or
  active-state ARIA. The remaining `alert(1)` strings are security-test fixture
  data only.
- New workspace IDs now use `crypto.randomUUID()` with the existing `ws-`
  prefix; a timestamp/random fallback remains for runtimes without
  `randomUUID`.
- Hosted persistence keying now stays locked while signed out; workspace/canvas
  persistence no longer falls back to the local `default` rows unless the app is
  actually in local mode.
- Workspace persistence now treats supported title-review states
  (`missing_parent`, `over_allocated_branch`, `under_allocated_branch`) as
  warning-only for autosave/`.landroid` load, while still rejecting hard-invalid
  graph issues such as negative fractions, cycles, and related nodes with
  ownership fractions.

Final Phase 5 / Phase 6A close-out validation:

- `npm test -- src/components/deskmap/__tests__/deskmap-document-chips.test.tsx src/store/__tests__/workspace-store-doc-actions.test.ts src/storage/__tests__/workspace-persistence.test.ts` passed: 3 files, 38 tests.
- `npm run lint` passed.
- `npm test -- src/ai/wizard/__tests__/parse-workbook.test.ts` passed: 1 file,
  6 tests, after making the hostile-range guard test deterministic.
- `npm test -- src/storage/__tests__/workspace-persistence.test.ts` passed: 1
  file, 15 tests, including warning-only title review state persistence.
- `npm run test:e2e -- -g "landroid export/import|deleting a branch-scoped"`
  passed: 2 Playwright workflows.
- `npm test` passed: 67 files, 574 tests. Known/intentional noise at that
  point: one post-v8 backup error-path log and the AI settings local-storage
  warning, which Phase 6C later removed.
- `npm run build` passed. Known Vite dynamic-import/chunk-size warnings remain.
- `npm run test:e2e` passed: 10 Playwright workflows.
- Phase 6B validation:
  - `npm run lint` passed.
  - `npm test -- src/components/shared/__tests__/confirmation-provider.test.ts`
    passed: 1 file, 3 tests.
  - `npm run test:e2e -- -g "combinatorial demo loads|landroid export/import"`
    passed: 2 Playwright workflows after updating the typed-confirmation flow.
  - `npm test` passed: 68 files, 577 tests. Known/intentional noise at that
    point: the post-v8 backup error-path log and the AI settings local-storage
    warning, which Phase 6C later removed.
  - `npm run build` passed. Known Vite dynamic-import/chunk-size warnings remain.
  - `npm run test:e2e` passed: 10 Playwright workflows.
  - `git diff --check` passed.

Final checkpoint validation on
`codex/phase-5-doc-storage-wrap-2026-05-15`:

- `npm run lint` passed.
- `npm test` passed: 69 files, 579 tests. Known/intentional noise remains one
  post-v8 backup error-path log.
- `npm run build` passed. Known Vite dynamic-import/chunk-size warnings remain.
- `npm run test:e2e` passed: 10 Playwright workflows.
- `git diff --check` passed.
- Phase 6C validation:
  - `npm test -- src/utils/__tests__/workspace-id.test.ts` passed: 1 file, 2
    tests.
  - `npm test -- src/storage/__tests__/active-workspace-key.test.ts src/storage/__tests__/persistence-db-key.test.ts`
    passed: 2 files, 8 tests.
  - `npm test -- src/ai/__tests__/settings-store.test.ts` passed: 1 file, 7
    tests, without the previous local-storage warning.
  - `npm run lint` passed.
  - `npm test` passed: 69 files, 579 tests. Known/intentional noise remains the
    post-v8 backup error-path log.
  - `npm run build` passed. Known Vite dynamic-import/chunk-size warnings remain.
  - `npm run test:e2e` passed: 10 Playwright workflows.
  - `git diff --check` passed.

### What's Left

- Run `git diff --check` and `git status` immediately before final handoff or
  checkpoint.
- Check `git status` and keep generated Playwright artifacts ignored.
- Push branch `codex/phase-5-doc-storage-wrap-2026-05-15` to origin.
- Open or update a draft PR targeting `codex/hosted-hardening-2026-05-14` when
  the user wants the GitHub PR step.

**Depth-range import normalize-and-warn (deferred):** the design doc
specified that a `.landroid` carrying a non-`'all_depths'` value
surfaces a Phase 3-style warning. Today the per-record normalizer
silently coerces unknown values to `'all_depths'`; adding a warning
collector at `importLandroidFile` is a clean follow-up but is not
load-bearing for any current build (no Phase 8 producer exists yet).

### Deferred Phase 5 Scope Items (from the brainstorm follow-up)

Schema hooks that are **already landed**:

- `depthRange` on `OwnershipNode` / `Lease` / `LeaseholdOrri` /
  `LeaseholdAssignment` (commit `d92338b`).
- `externalRefs?: ExternalRef[]` on `DeskMap` and `DocumentRecord`
  (Tier 1 follow-up commit; see `src/types/external-ref.ts`). ArcGIS
  identity rule lives in the file's docstring: LANDroid UUID + ArcGIS
  GlobalID are the business link; ObjectID is convenience-only.
- `SourceCitation` type defined in `src/types/source-citation.ts`. No
  record carries `citations[]` yet — the shape exists so future
  consumers (curative issues, leasehold warnings, AI extraction,
  attorney review packets) have a canonical import target.

Hooks **intentionally deferred** until their feature work begins (all
addable later as optional fields without a Dexie migration or
`.landroid` version bump):

- **`SourceCitation[]` on records** — attaching `citations?:` to
  curative issues, leasehold warnings, etc. is feature work, not Phase
  5 schema. Add when the first consumer needs it.
- **`ReviewStatus` / `ReviewFields`** — the brainstorm itself flagged
  "be careful with this one." Curative `TitleIssue` already has
  `status` + `priority`; attaching `reviewStatus?` to documents and
  packets waits until the attorney-review workflow is designed.
- **`ExtractionMetadata`** on `DocumentRecord` — optional field, no
  consumer today, defer until extraction work starts.
- **`ReviewPacketManifest`** — schema already supports it (stable
  doc IDs, entity links, kind tags, round-trip). Type definition
  lands when packet export starts.
- **ArcGIS Level 1 export** (CSV/GeoJSON with `LAND_TRACT_ID` /
  `LAND_UNIT_ID` / etc.) and **Level 2 click-through** — feature work,
  not schema. Phase 6/7 per the brainstorm roadmap.

**Guardrail kept in force**: if implementation of any deferred item
starts expanding into ArcGIS REST sync, an ArcGIS plugin, an attorney
portal, comments/redlines, OCR/AI extraction, depth-aware math, payout
changes, or automatic title updates from documents — stop and split
into a dedicated project.

### Hard Guardrails Still In Force

- No edits to `src/engine/math-engine.ts`,
  `src/components/leasehold/leasehold-summary.ts`,
  `src/components/deskmap/deskmap-coverage.ts`, or
  `src/storage/seed-test-data.ts` beyond a defensive comment — if depth
  severance work pulls me there, split into Phase 8.
- New doc-mutating AI tools (when they land) must be in
  `HOSTED_BLOCKED_TOOL_NAMES` from the first commit that introduces them.
- Texas-only active math.

## Current Workstream

The current branch is the Phase 5 document/PDF persistence workstream. Hosted
hardening remains the parent branch context, but this branch now carries the v8
document schema, multi-document UI, Raven Forest seed migration, restored
Playwright workflows, and docs close-out.

The next workstream should be incremental and phase-based:

1. Hosted auth and proxy boundary hardening. **Implemented locally; deploy still
   needs the new Amplify env var before the next hosted build.**
2. Hosted data-loss and AI read-only safety. **Implemented locally.**
3. Leasehold strict parsing and warning surfacing. **Implemented locally.**
4. Restore skipped browser workflow coverage. **Complete on the Phase 5 branch.**
5. Design document/PDF persistence foundations before durable backend work.
   **Implemented on the Phase 5 branch; Tier 2 document features remain deferred.**
6. UX/accessibility cleanup for destructive actions and modal/form basics.
7. Docs and handoff alignment after behavior changes.

## Last Completed

- Created/switched to `codex/hosted-hardening-2026-05-14`.
- Implemented Phase 1 hosted auth/proxy hardening:
  - Added `src/auth/cognito-config.ts` and tests so frontend auth derives the
    Cognito user-pool issuer/metadata URL from `VITE_COGNITO_USER_POOL_ID`.
  - Kept authorization, token, userinfo, and logout endpoints on the Cognito
    Hosted UI domain via `metadataSeed`.
  - Added `VITE_COGNITO_USER_POOL_ID` to Vite types, Amplify build guards, and
    deployment docs/checklists.
  - Updated CSP `connect-src` for `https://cognito-idp.us-east-1.amazonaws.com`.
  - Updated hosted smoke testing to check user-pool OIDC metadata and JWKS.
  - Hardened the AI proxy to reject oversized request bodies, parse JSON before
    usage tracking, allowlist forwarded OpenAI-compatible body fields, sanitize
    `max_tokens`, and map upstream OpenAI `401/403` to proxy `502`.
  - Documented that Lambda Function URL auth type `NONE` relies on handler-side
    Cognito JWT verification and CORS is not a stolen-token replay defense.
- Updated `CHANGELOG.md`, `SECURITY.md`, `TESTING.md`, `DEPLOYMENT_PLAN.md`,
  `DEPLOYMENT_GUIDE.md`, `DEPLOY_TEST_CHECKLIST.md`, `backend/ai-proxy/README.md`,
  and this handoff.
- Preserved the intentional AI single-level undo/back-button behavior; no changes
  were made to `setActiveDeskMap` or hosted AI read-only filtering in Phase 1.
- Implemented Phase 2 hosted data-loss and AI read-only safety:
  - Hid the `Demo Data` menu in hosted mode while preserving it in local mode.
  - Added `src/components/shared/navbar-policy.ts` and tests for the hosted/local
    demo-data policy.
  - Split AI tool policy into `UNDO_MUTATING_TOOL_NAMES` and
    `HOSTED_BLOCKED_TOOL_NAMES`.
  - Kept `setActiveDeskMap` out of the undo-mutating set so focus switches do
    not burn the AI undo slot.
  - Added `setActiveDeskMap` to hosted-blocked tools so hosted read-only AI
    cannot persist active desk-map focus through autosave.
  - Updated the AI system prompt to state that `setActiveDeskMap` does not create
    an AI undo snapshot.
- Updated `README.md`, `USER_MANUAL.md`, `DEPLOYMENT_GUIDE.md`, `SECURITY.md`,
  `CHANGELOG.md`, and this handoff for Phase 2.
- Implemented Phase 3 leasehold strict parsing and warning surfacing:
  - Routed leasehold summary math for lease royalty, floating-NPRI lease-slice
    royalty reuse, ORRI burden fractions, WI assignment totals, assignment
    summary decimals, and focused transfer-order assignment rows through strict
    parsing.
  - Added `LeaseholdInputWarning` payloads on unit and tract summaries so
    malformed non-blank economic inputs are visible instead of silently coerced
    or clamped.
  - Added a leasehold deck warning panel plus graph/overview warning chips for
    affected focus areas.
  - Preserved blank optional economic fields as 0 while treating malformed
    non-blank values as warning-visible 0 in math.
  - Preserved warning-only landman review behavior for over-assignment,
    over-burdening, floating NPRI over-carves, and lease overlaps.
- Updated `README.md`, `USER_MANUAL.md`, `SECURITY.md`, `TESTING.md`,
  `CHANGELOG.md`, and this handoff for Phase 3.
- Began Phase 4 browser workflow coverage restoration:
  - Re-enabled `leasehold seed keeps PDF filenames visible and owner leases
    branch-aware`.
  - Retargeted the workflow to the current 10-tract Raven Forest combinatorial
    fixture.
  - The test now verifies Unit A/B tab grouping, exact Desk Map PDF filename
    badges, Desk Map lease-card lessor/lease facts, and Leasehold Map branch
    lease slices with distinct owner lease docs.
- Updated `README.md`, `USER_MANUAL.md`, `TESTING.md`, `CHANGELOG.md`, and this
  handoff for the Phase 4 partial.
- Captured the sequencing decision after the document-refactor/fixture brainstorm:
  finish/checkpoint hosted hardening first, then start Phase 5 document/PDF
  persistence on a fresh branch. Superseded by this Phase 5 branch: the v8
  document schema, small multi-doc Raven Forest seed migration, and deferred
  Playwright workflow retargeting are now complete.
- Completed Phase 5 D/E/F close-out on
  `claude/phase-5-document-refactor-2026-05-15`: realistic multi-document seed
  data, `attachmentId` chip selectors, restored Playwright workflows, and docs
  rail alignment.
- Continued Phase 6B UX/accessibility cleanup on the same branch: typed
  confirmations for workspace-replacing demo/import loads, shared confirmation
  for Flowchart `Clear`, and accessible labels/active-state ARIA for the primary
  nav, tract/owner/Federal Leasing tabs, Research section nav, and shared form
  controls.
- Continued Phase 6C low-blast-radius hardening: new workspace IDs are now
  generated with `crypto.randomUUID()` and still carry the `ws-` prefix.
- Added the hosted null-sub persistence guard so hosted signed-out state cannot
  read or write the local `default` workspace/canvas rows.
- Removed the recurring AI settings unit-test local-storage warning by avoiding
  a Node-only `globalThis.localStorage` probe.
- Created `ARC_REVIEW_PROMPT.md` as the paste-ready handoff for an external
  checker or ArcGIS-focused follow-up.

## Historical Hosted-Hardening Validation

Phase 1 validation performed on `codex/hosted-hardening-2026-05-14`:

- `npm test -- src/auth/__tests__/cognito-config.test.ts` passed: 1 file,
  4 tests.
- `npm test` in `backend/ai-proxy` passed: 3 files, 38 tests.
- `npm run deploy:check` passed; rewrite placeholder warning remains expected.
- `npm run lint` passed.
- `npx tsc -p tsconfig.json --noEmit` in `backend/ai-proxy` passed.
- `npm test` passed: 59 files, 464 tests.
- Initial `bash scripts/smoke-test-hosted.sh` was blocked by sandboxed network
  access and returned `000` statuses; rerun with network approval passed root,
  headers, unauthenticated AI rejection, SPA fallback, Cognito OIDC metadata,
  and JWKS checks.
- `git diff --check` passed after this handoff edit.

Phase 2 validation performed on `codex/hosted-hardening-2026-05-14`:

- `npm test -- src/ai/__tests__/read-only-tools.test.ts src/components/shared/__tests__/navbar-policy.test.ts` passed: 2 files, 8 tests.
- `npm run lint` passed.
- `npm test` passed: 60 files, 468 tests.
- `npm run build` passed; known Vite large-chunk warning remains.
- `npm run test:e2e` passed: 4 active Playwright tests, 5 skipped.
- Local browser check at `http://127.0.0.1:5174/` confirmed the local navbar
  still shows `Demo Data`, `File`, and `Desk Map`.
- `git diff --check` passed after the Phase 2 handoff edit.

Phase 3 validation performed on `codex/hosted-hardening-2026-05-14`:

- `npm test -- src/components/leasehold/__tests__/leasehold-summary.test.ts`
  passed: 1 file, 18 tests.
- `npm run lint` passed.
- `npm test` passed: 60 files, 469 tests.
- `npm run build` passed; known Vite large-chunk warning remains.
- `npm run test:e2e` passed: 4 active Playwright tests, 5 skipped.
- `git diff --check` passed after the Phase 3 handoff edit.

Phase 4 partial validation performed on `codex/hosted-hardening-2026-05-14`:

- `npm run test:e2e -- -g "leasehold seed keeps PDF filenames visible"` passed:
  1 Playwright test.
- `npm run test:e2e` passed: 5 active Playwright tests, 4 skipped.
- `npm run lint` passed.
- `git diff --check` passed after the Phase 4 partial handoff edit.

Final hosted-hardening wrap validation performed on
`codex/hosted-hardening-2026-05-14`:

- `git diff --check` passed after sequencing doc updates.
- `npm run deploy:check` passed; the Amplify rewrite placeholder warning remains
  expected in the repo template.
- `npm test` in `backend/ai-proxy` passed: 3 files, 38 tests.
- `npx tsc -p tsconfig.json --noEmit` in `backend/ai-proxy` passed.
- `npm run lint` passed.
- `npm test` passed: 60 files, 469 tests. The AI settings local-storage warning
  seen here was later removed in Phase 6C on the Phase 5 branch.
- `npm run build` passed. The known Vite large-chunk warning remains.
- `npm run test:e2e` passed: 5 active Playwright tests, 4 skipped.

## Open Risks

- The hosted Amplify app must receive the new `VITE_COGNITO_USER_POOL_ID`
  environment variable before the next hosted build using this branch.
- Manual hosted sign-in was not completed in this chat because no Cognito test
  credentials were available; smoke checks confirmed metadata/JWKS reachability.
- Lambda Function URL auth type remains `NONE`; handler-side Cognito JWT
  verification, token ceilings, body caps, and request policy are the current
  POC security boundary. CORS is documented as browser-only, not replay defense.
- Hosted `Demo Data`, hosted AI `setActiveDeskMap` exposure, and leasehold
  malformed-input warnings are fixed locally but not deployed yet.
- The AI undo/back button is intentional and already exists as a single-level
  snapshot. Do not remove it.
- `workspace-store.detachDocFromNode` currently deletes the underlying document
  after detaching from a node. That matches today's single-attachment UI usage,
  but a future shared-document UI should revisit detach-only semantics.
- Hosted null-sub persistence falls back to local `default` keys in helpers; the
  LoginGate usually prevents this, but persistence functions do not enforce it.
- `workspace-id.ts` uses `Date.now()` plus `Math.random()`.
- Missing label association and missing active nav/tab ARIA remain
  UX/accessibility cleanup items.

## Hardening Plan

### Phase 1 - Hosted Auth And Proxy Boundary

Goal: make hosted login and AI proxy behavior safe enough for supervised hosted
testing.

Status: implemented and validated locally on
`codex/hosted-hardening-2026-05-14`. Before deploying this branch, add
`VITE_COGNITO_USER_POOL_ID=us-east-1_TWeBB7xvQ` to Amplify build environment
variables.

Tasks:

- [x] Fix frontend Cognito authority/metadata so authorization/token/logout still use
  the Hosted UI domain while issuer/JWKS use the Cognito user-pool issuer.
- [x] Update CSP `connect-src` for the issuer metadata endpoint if browser metadata
  fetches require it.
- [x] Add or document the chosen Function URL origin/auth posture. Prefer stronger
  server-side protection where practical; do not assume browser CORS alone solves
  stolen-token replay.
- [x] Move JSON parsing before usage charging in the Lambda handler.
- [x] Reject oversized proxy request bodies before parsing/forwarding.
- [x] Allowlist accepted OpenAI-compatible body fields in `applyBodyPolicy`.
- [x] Map upstream OpenAI auth errors to proxy/server errors so the browser does not
  sign out the user for a bad server API key.

Validation:

- `npm run lint`
- `npm test`
- `npm test` from `backend/ai-proxy`
- `npx tsc --noEmit` from `backend/ai-proxy`
- targeted Cognito metadata check
- `bash scripts/smoke-test-hosted.sh` if network approval is available

### Phase 2 - Hosted Data-Loss And AI Read-Only Safety

Goal: keep hosted users from losing data or changing saved workspace state through
read-only AI paths.

Status: implemented and validated locally on
`codex/hosted-hardening-2026-05-14`.

Tasks:

- [x] Hide `Demo Data` in hosted mode or require a typed destructive confirmation
  before loading fixtures.
- [x] Split AI concepts:
  - `UNDO_MUTATING_TOOL_NAMES`: tools that should create an AI undo snapshot.
  - `HOSTED_BLOCKED_TOOL_NAMES` or equivalent metadata: tools blocked in hosted
    read-only mode.
- [x] Keep `setActiveDeskMap` from burning the undo slot if that is still the desired
  UX, but prevent it from appearing in hosted read-only tools while it persists
  active desk-map state.
- [x] Add regression tests proving hosted read-only tools have no persisted side
  effects.

Validation:

- `npm test`
- targeted AI tool-filter tests
- `npm run test:e2e` if UI behavior changes are covered by browser flows

### Phase 3 - Leasehold Strict Parsing And Warnings

Goal: stop malformed economic inputs from silently becoming zero.

Status: implemented and validated locally on
`codex/hosted-hardening-2026-05-14`.

Tasks:

- [x] Route imported/legacy lease royalty, ORRI burden, WI assignment, and related
  leasehold math strings through strict parsing.
- [x] Surface row-level or summary-level warnings when strict parsing fails.
- [x] Preserve warning-only landman review states for over-100 root coverage and NPRI
  over-claims unless the product decision explicitly changes.

Validation:

- `npm test -- src/components/leasehold/__tests__/leasehold-summary.test.ts`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`

### Phase 4 - Browser Workflow Coverage

Goal: restore confidence in high-value user workflows before broader beta.

Status: complete on the Phase 5 branch. The old skipped workflows were
retargeted after the document/PDF persistence refactor and now run against the
v8 schema.

Tasks:

- [x] Retarget leasehold seed/PDF filenames/branch awareness to the current
  combinatorial Raven Forest fixture.
- [x] Retarget `.landroid` export/import with PDFs after the document refactor.
- [x] Retarget branch-scoped lease delete after fixture retargeting.
- [x] Retarget curative linkage after fixture retargeting.
- [x] Retarget research linkage after fixture retargeting.

Validation:

- `npm run test:e2e`
- `npm test`

### Phase 5 - Document/PDF Persistence Foundation

Goal: prepare the app for real project data and a future durable backend.

Status: implemented on `claude/phase-5-document-refactor-2026-05-15`.

Tasks:

- [x] Add workspace-scoped document IDs.
- [x] Support multiple documents per node/entity at the schema level; node UI is
      surfaced in Phase 5 and owner/lease/curative/research UI remains deferred.
- [x] Track content hash, byte length, MIME type, and original filename.
- [x] Add document/entity links for nodes, with the polymorphic schema reserved
      for owners, leases, curative, and research records.
- [x] Make `.landroid` import dispatch on `version`.
- [x] Switch workspace IDs to `crypto.randomUUID()`.
- [x] Add hosted null-sub persistence guard.

Validation:

- Dexie migration tests
- `.landroid` round-trip tests
- PDF/document attachment tests
- e2e export/import workflow

### Phase 6 - UX And Accessibility Cleanup

Goal: reduce destructive surprises and improve keyboard/screen-reader basics.

Tasks:

- [x] Replace native `confirm`/`alert` in app flows with shared modal/toast
  patterns.
- [x] Add typed confirmation for workspace-wiping actions.
- [x] Add modal focus trap and return-focus behavior.
- [x] Add associated labels or accessible names for form controls.
- [x] Add active nav/tab ARIA where appropriate.

Validation:

- targeted component tests where useful
- browser smoke for destructive flows
- manual keyboard pass

### Phase 7 - Docs And Handoff Alignment

Goal: keep future work synchronized with shipped behavior.

Update after behavior changes:

- `CONTINUATION-PROMPT.md`
- `ROADMAP.md`
- `TESTING.md`
- `SECURITY.md`
- `DEPLOYMENT_PLAN.md` / `DEPLOYMENT_GUIDE.md`
- `USER_MANUAL.md`
- `LANDMAN-MATH-REFERENCE.md`
- `CHANGELOG.md`

Validation:

- `git diff --check`
- Read docs against current source before finalizing.

## Backend Direction

There are two backend tracks:

1. Harden the existing AI proxy backend first.
2. Design a durable workspace/document backend later.

Do not start S3/DynamoDB workspace sync until hosted auth/proxy safety,
hosted data-loss prevention, and leasehold parsing are deployed or otherwise
accepted as stable, and the Phase 5 document/PDF persistence branch is reviewed
and merged.

Likely durable backend shape, when ready:

```text
LANDroid SPA
  -> Cognito ID token
  -> Lambda APIs
      /api/ai/*
      /api/workspaces/*
      /api/documents/*
  -> DynamoDB for metadata/entity rows
  -> S3 for document blobs
```

Keep the first durable backend simple:

- Cognito-scoped authorization by verified `sub`.
- DynamoDB single-table or small-table design for workspace/entity metadata.
- S3 for blobs addressed by content hash.
- Last-write-wins with per-entity `updatedAt` or version fields before any CRDT
  work.
- `.landroid` export/import remains the manual fallback.

Do not build AI PDF extraction, ArcGIS traverse export, or 3D Desk Map until the
document backend foundation and 2D evidence traceability are solid.

## Local Noise / Uncommitted State

The checkpoint branch is intended to carry the current source/docs changes as a
single reviewable snapshot. Before any further work, check `git status` and do
not mix unrelated ArcGIS implementation into this checkpoint.

Local source-asset note: the user has a Dropbox archive named `AAAAIIII.zip`
containing the current federal/private shapefiles. Treat it as local reference
material only. Do not copy it into the repo, import/process it, build ArcGIS
export/sync, or start federal/private math from it unless the user explicitly
opens that project.

Generated artifacts remain ignored and should not be hand-edited:

- `dist/`
- `dist-node/`
- `backend/ai-proxy/dist/`
- `backend/ai-proxy/lambda.zip`
- `playwright-report/`
- `test-results/`

## Next Best Tasks

- [ ] Start a new chat if needed.
- [ ] Read `AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`,
      `CONTINUATION-PROMPT.md`, and `ARC_REVIEW_PROMPT.md`.
- [ ] Confirm the current branch is
      `codex/phase-5-doc-storage-wrap-2026-05-15`.
- [ ] Run or review final validation results for this branch.
- [ ] If opening a PR, target `codex/hosted-hardening-2026-05-14`.
- [ ] For ArcGIS follow-up, start with a design/canonical-layer map using
      `docs/gis-data-catalog.md`; do not import raw GIS packages or build ArcGIS
      REST sync unless explicitly requested.
- [ ] Keep leasehold warning-only landman review states intact unless the product
      decision explicitly changes.
- [ ] Keep each phase small, validated, and documented.

## Paste-Ready Resume Prompt

> Resume work in `/Users/abstractmapping/projects/landroid`. First read `AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, `CONTINUATION-PROMPT.md`, and `ARC_REVIEW_PROMPT.md`. Continue on `codex/phase-5-doc-storage-wrap-2026-05-15`; do not branch from `main`, and do not modify `codex/hosted-hardening-2026-05-14` directly. The PR target is `codex/hosted-hardening-2026-05-14`. This branch wraps Phase 5 document/PDF persistence, Desk Map multi-document chips, v8 `.landroid` document round-trip, restored Playwright workflows, Phase 6 confirmation/accessibility cleanup, workspace ID hardening, hosted persistence-key guard, AI settings test warning cleanup, and GIS reference docs. If doing ArcGIS follow-up, start design-only with a canonical layer map using `docs/gis-data-catalog.md`; do not import raw GIS packages, copy local geodata into the repo, build ArcGIS REST sync, start OCR/AI extraction, add federal/private math, or automate title updates unless explicitly requested. Run relevant validation after each change group and update `CONTINUATION-PROMPT.md` before handing off.
