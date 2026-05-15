# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.

## Current Branch

Current local branch: `claude/goofy-yonath-75583f` (Claude worktree, descended
from `codex/hosted-hardening-2026-05-14`). Phase 5 commits land here and PR
into `codex/hosted-hardening-2026-05-14`.

Do not commit directly to `main`.

## Phase 5 Status (Document/PDF Persistence Refactor)

Six commits landed on this branch implementing the data layer for the
multi-doc-per-entity refactor. See
`docs/adr/0004-multi-doc-per-entity-persistence.md` and
`docs/phase-5-document-refactor.md` for the design contract.

- `4bcc2c5` — ADR 0004 + design doc.
- `d92338b` — A1: `DepthRange` schema hook on `OwnershipNode`, `Lease`,
  `LeaseholdOrri`, `LeaseholdAssignment` with normalizers, defensive
  comments at math entry points, 20 unit tests.
- `31e9dc4` — A2: Dexie v8 bump with new `documents` +
  `document_attachments` tables, pure `migratePdfsToDocuments` /
  `buildNodeWorkspaceIndex` helpers, `document-store.ts` CRUD, sha-256
  `blob-hash.ts`, 15 migration unit tests. Old `pdfs` table left
  read-only for one rollback version.
- `c4445fa` — A3: `OwnershipNode.attachments[]` (`NodeAttachmentSummary[]`)
  added additively, 8 unit tests.
- `ff4a194` — A4a: workspace-store actions (`attachDocToNode`,
  `detachDocFromNode`, `renameDocOnNode`, `reorderNodeAttachments`) with
  10 hoisted-mock unit tests.
- `3522c75` — A4b: `document-store.listAttachmentsForNodes` bulk read,
  `workspace-store.hydrateNodeAttachments` action, wired into `main.tsx`
  and `Navbar.tsx` after workspace load. 3 unit tests.
- `193c0d6` — A4c: drop `hasDoc` / `docFileName` from `OwnershipNode`;
  migrate `DeskMapDocumentBadge`, `runsheet-export`, `csv-io`, the three
  modals (`NodeEditModal`, `AttachLeaseModal`, `OwnershipNodeEditorModals`),
  `PdfViewerModal`, `seed-test-data`, and `workspace-persistence` export
  to read/write `attachments[]`. Cascade-delete docs in
  `workspace-store.removeNode` / `clearDeskMapNodes` via
  `document-store.deleteDoc`. `pdf-store.ts` deleted (zero importers).
- `8a8859f` — A5a: `.landroid` v8 export shape + v7→v8 import dispatch.
  `exportLandroidFile` writes `version: 8` and `documentData`; dropped
  legacy `pdfData` from the file payload and from `LandroidFileData`.
  New `exportDocumentWorkspaceData` / `replaceDocumentWorkspaceData` read
  and write the v8 tables for `.landroid` and AI-undo paths. `Navbar`
  and `undo-store` migrated; the AI undo path now re-runs
  `hydrateNodeAttachments` after a snapshot restore. v7 import is
  migrated inline through `migratePdfsToDocuments`.
- `f8939cd` — A5b: one-shot v7 `.landroid` backup hook in
  `src/storage/post-v8-backup.ts`. Fires once after `db.open()` via a
  `localStorage` flag (`landroid:postV8BackupComplete`), iterates every
  workspace, downloads one v7-shape `.landroid` per workspace that had
  PDFs at upgrade time. Pure helpers + dependency injection for testing.
  Wired into `main.tsx`. 15 unit tests.

**Phase 5 data layer is complete.** The v7 single-PDF-per-node model is
gone from the type system, the data layer, every reader/writer, the
`.landroid` file format, and the AI-undo path. The v7 → v8 schema
upgrade has both an in-Dexie migration (non-destructive) and a
downloadable v7 `.landroid` backup safety net. Validation after every
commit: `npm run lint`, `npm test`, `npm run build` all green.
Test suite at 523 tests; the pre-existing
`src/engine/__tests__/tree-layout.test.ts` sandbox-path failure on the
`elkjs/lib/elk-worker.min.js?url` import is unrelated to Phase 5 and
existed on the base commit `665fc3a`.

### What's Left

**Phase B (next):** UI surface for multi-doc attachments.
- `DeskMapDocumentBadge` becomes `DeskMapDocumentChips` — a row of chips,
  4 visible + `+N more` overflow. Each chip click opens its own doc.
- `PdfViewerModal` switches prop from `nodeId` to `docId` so a multi-
  chip surface can target any attachment directly.
- Node-edit, lease, and NPRI modals get an attachments section: list +
  add + rename + remove + reorder.
- Phase 6 modal focus-trap work can ride along on the same modal edits.

**Phase D (later):** `seed-test-data.ts` migration to call the v8
attach actions instead of the existing single-doc seed pathway.

**Phase E (later):** add the multi-chip Playwright spec from the design
doc and unskip the four remaining workflows (`.landroid` round-trip,
branch-scoped lease delete, curative linkage, research linkage) against
the new schema.

**Phase F (later):** doc rail update —
`CHANGELOG.md`, `USER_MANUAL.md` Desk Map PDF chip section,
`SECURITY.md` hosted-blocked tool list (when AI doc-mutating tools
land), and `TESTING.md`.

**Depth-range import normalize-and-warn (deferred):** the design doc
specified that a `.landroid` carrying a non-`'all_depths'` value
surfaces a Phase 3-style warning. Today the per-record normalizer
silently coerces unknown values to `'all_depths'`; adding a warning
collector at `importLandroidFile` is a clean follow-up but is not
load-bearing for any current build (no Phase 8 producer exists yet).

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

The parallel full-audit pass is complete and the hosted hardening implementation
track has begun. Phases 1, 2, and 3 are implemented locally on the current
branch. Phase 4 restored one high-value browser workflow, and this branch is now
in wrap/checkpoint mode. Do not continue the remaining PDF/export/import/fixture
browser retargeting before the document/PDF persistence refactor and two-unit
fixture direction settle.

The next workstream should be incremental and phase-based:

1. Hosted auth and proxy boundary hardening. **Implemented locally; deploy still
   needs the new Amplify env var before the next hosted build.**
2. Hosted data-loss and AI read-only safety. **Implemented locally.**
3. Leasehold strict parsing and warning surfacing. **Implemented locally.**
4. Restore skipped browser workflow coverage. **Partial; remaining four deferred.**
5. Design document/PDF persistence foundations before durable backend work.
   **Next major workstream after this branch is checkpointed.**
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
  persistence on a fresh branch, then design/implement the two-unit Raven Forest
  fixture and retarget the remaining skipped Playwright workflows against the new
  schema/fixture.

## Latest Validation

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
- `npm test` passed: 60 files, 469 tests. The known AI settings local-storage
  warning remains.
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
- Four Playwright workflows remain skipped and are intentionally deferred until
  after document/PDF persistence and fixture retargeting: `.landroid` round-trip,
  branch-scoped lease delete, curative linkage, and research linkage.
- PDF attachments are still keyed by `nodeId` only. A future durable backend
  needs workspace-scoped document IDs, content hashes, and document/entity links.
- `.landroid` export writes `version: 7`, but import does not dispatch on version.
- Hosted null-sub persistence falls back to local `default` keys in helpers; the
  LoginGate usually prevents this, but persistence functions do not enforce it.
- `workspace-id.ts` uses `Date.now()` plus `Math.random()`.
- Native `confirm`/`alert`, weak modal focus trapping, missing label association,
  and missing active nav/tab ARIA remain UX/accessibility cleanup items.

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

Status: partial. The leasehold/PDF branch-awareness workflow is restored on this
branch. The remaining four skipped workflows are PDF/export/import/fixture-heavy
and should wait until Phase 5 document/PDF persistence and the new two-unit Raven
Forest fixture direction settle.

Tasks:

- [x] Retarget leasehold seed/PDF filenames/branch awareness to the current
  combinatorial Raven Forest fixture.
- [ ] Retarget `.landroid` export/import with PDFs after the document refactor.
- [ ] Retarget branch-scoped lease delete after fixture retargeting.
- [ ] Retarget curative linkage after fixture retargeting.
- [ ] Retarget research linkage after fixture retargeting.

Validation:

- `npm run test:e2e`
- `npm test`

### Phase 5 - Document/PDF Persistence Foundation

Goal: prepare the app for real project data and a future durable backend.

Status: next major workstream after checkpointing this hosted-hardening branch.
Start it on a fresh non-main branch with a design doc/ADR first; do not implement
the document refactor inside this hosted-hardening branch unless explicitly
requested.

Tasks:

- Add workspace-scoped document IDs.
- Support multiple documents per node/entity.
- Track content hash, byte length, MIME type, and original filename.
- Add document/entity links for nodes, owners, leases, map assets, map regions,
  and research records.
- Make `.landroid` import dispatch on `version`.
- Switch workspace IDs to `crypto.randomUUID()`.
- Add hosted null-sub persistence guard.

Validation:

- Dexie migration tests
- `.landroid` round-trip tests
- PDF/document attachment tests
- e2e export/import workflow

### Phase 6 - UX And Accessibility Cleanup

Goal: reduce destructive surprises and improve keyboard/screen-reader basics.

Tasks:

- Replace native `confirm`/`alert` in destructive flows with shared modal/toast
  patterns.
- Add typed confirmation for workspace-wiping actions.
- Add modal focus trap and return-focus behavior.
- Add associated labels or accessible names for form controls.
- Add active nav/tab ARIA where appropriate.

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
accepted as stable, and the document/PDF persistence design exists. The remaining
skipped browser workflows should be retargeted after the document schema and
fixture direction settle.

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

Active uncommitted Phase 1, Phase 2, Phase 3, and Phase 4 partial
implementation/docs are present on
`codex/hosted-hardening-2026-05-14`. They include frontend Cognito config,
backend proxy policy/handler/tests, hosted smoke/deploy config, hosted demo
menu hiding, AI hosted/undo tool-policy split, leasehold strict parsing/input
warnings, the restored leasehold/PDF branch-awareness Playwright workflow, and
docs listed under "Last Completed".

Intentional uncommitted local files from the prior audit/handoff work:

- `AUDIT_REPORT_CODEX_FULL_2026-05-14.md`
- `AUDIT_COMPARISON_CODEX_CLAUDE_2026-05-14.md`

Generated artifacts remain ignored and should not be hand-edited:

- `dist/`
- `dist-node/`
- `backend/ai-proxy/dist/`
- `backend/ai-proxy/lambda.zip`
- `playwright-report/`
- `test-results/`

## Next Best Tasks

- [ ] Start a new chat.
- [ ] Read `AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and this file.
- [ ] Check current git status and preserve intentional audit artifacts plus
      active Phase 1/2/3 and Phase 4 partial implementation changes.
- [ ] If deploying this branch, add `VITE_COGNITO_USER_POOL_ID` in Amplify first.
- [ ] Checkpoint/wrap the hosted-hardening branch.
- [ ] Start Phase 5 document/PDF persistence on a fresh non-main branch only after
      the checkpoint; begin with `docs/phase-5-document-refactor.md` and
      `docs/adr/0004-multi-doc-per-entity-persistence.md`.
- [ ] Defer the remaining four skipped browser workflows until after the document
      schema and two-unit fixture direction settle.
- [ ] Keep leasehold warning-only landman review states intact unless the product
      decision explicitly changes.
- [ ] Keep each phase small, validated, and documented.

## Paste-Ready Resume Prompt

> Resume work in `/Users/abstractmapping/projects/landroid`. First read `AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and `CONTINUATION-PROMPT.md`. Use the non-main branch `codex/hosted-hardening-2026-05-14` if checkpointing this work. The completed audit artifacts are `AUDIT_REPORT_CODEX_FULL_2026-05-14.md` and `AUDIT_COMPARISON_CODEX_CLAUDE_2026-05-14.md`. Phases 1, 2, and 3 hosted hardening are implemented locally and validated; Phase 4 restored the leasehold/PDF branch-awareness Playwright workflow, leaving four PDF/export/import/fixture-heavy workflows skipped by design. Do not continue retargeting those four before the Phase 5 document/PDF persistence refactor and two-unit fixture direction settle. If the hosted-hardening branch is already checkpointed, start Phase 5 on a fresh non-main branch with `docs/phase-5-document-refactor.md` and `docs/adr/0004-multi-doc-per-entity-persistence.md` before implementation. Keep leasehold warning-only landman review states intact unless the product decision explicitly changes. Run relevant validation after each change group and update `CONTINUATION-PROMPT.md` before handing off.
