# LANDroid Main-Readiness Audit

Date: 2026-05-17
Branch audited: `claude/epic-hoover-48f4d0`
Latest commit at audit start: `6d70597 docs: handoff prompt for the Audit Sheet export work`

## Verdict

LANDroid has made strong progress: the Texas title/leasehold engine is centralized, the Raven Forest fixture is broad, document registry coverage is real, hosted auth and the AI proxy are much harder than the earlier prototype, and the primary E2E workflows pass.

It is not clean enough to treat this branch as main for an online/trusted product yet. The main blockers are security around imported document blobs, unresolved dependency audit issues, correctness coercions that can hide bad data, AI mutation/prompt-injection boundaries, and document attachment scoping/delete semantics.

## Audit Method

- Read `PROJECT_CONTEXT.md`, active architecture/security/testing/roadmap docs, and continuation state.
- Split review across focused agents:
  - engine/math/domain invariants
  - UX/product/landman workflow
  - architecture/state/persistence
  - security/hosted/import/privacy
  - AI/import/tooling
- Ran automated validation and manual browser smoke on the active app.
- Kept implementation changes limited to one test-locator hardening discovered by E2E.

## Validation Snapshot

Passed:

- `npm run lint`
- `npm test` - 70 files, 582 tests
- `npm run build`
- `npm run deploy:check`
- `cd backend/ai-proxy && npm test` - 3 files, 38 tests
- `cd backend/ai-proxy && npm run build`
- `npm run test:e2e` - 11 Playwright workflows after tightening the `Owners` nav locator

Audit warnings:

- Root `npm audit --omit=dev --json` reports one high production issue in `xlsx@0.18.5`; no fix is available in that package line.
- Backend `npm audit --omit=dev --json` reports one high production issue through `fast-xml-builder`; fix is available by updating the AWS SDK dependency tree.
- `npm run build` passes but still reports large chunks and a mixed dynamic/static import warning for `src/storage/db.ts`.

Manual browser smoke:

- Raven Forest demo loads with 1476 nodes and 10 tracts.
- Documents, Leasehold, Federal Leasing, Research, and AI panel render without app errors after the dev server was restarted.
- Desk Map large-tree placement is a UX problem: with default pan `{ x: 0, y: 0 }` and zoom `0.8`, the first visible cards can land thousands of pixels to the right of the viewport, making the canvas appear blank to a user.
- Mobile viewport smoke at 390 x 844 does not crash, but the main app is still a desktop-first workspace with horizontally clipped/scrolling navigation and the same Desk Map off-screen issue.

## P0 / Main Blockers

### 1. Imported document blobs can be previewed as same-origin iframe content

Risk: a malicious `.landroid` import can carry a serialized blob with arbitrary MIME. The app reconstructs that blob and later previews it in an unsandboxed same-origin iframe. If a stored blob is HTML/SVG instead of a true PDF, this can become a same-origin script execution path against IndexedDB/session context.

Evidence:

- `src/storage/blob-serialization.ts:73` trusts serialized blob MIME.
- `src/storage/workspace-persistence.ts:676` deserializes document rows from workspace import.
- `src/components/modals/PdfViewerModal.tsx:82` renders the blob URL in an iframe without `sandbox`.

Required before hosted main:

- Validate PDF magic bytes on import/upload and before preview.
- Normalize unsafe/unknown MIME to non-renderable download-only handling.
- Add iframe sandboxing for document previews.
- Add regression tests for hostile serialized blob payloads.

### 2. Production dependency audit is not clean

Risk: the root app still depends on vulnerable `xlsx@0.18.5` (`package.json:31`) and backend audit reports a fixable high issue through `fast-xml-builder` in the AWS SDK tree.

Required before hosted main:

- Decide whether to replace `xlsx`, isolate it further, or restrict untrusted spreadsheet parsing to a safer path.
- Update backend dependencies/lockfile to clear the fixable backend audit issue.
- Re-run both production audits and document any accepted residual risk in `SECURITY.md`.

### 3. AI local mutation path still needs an approval boundary

Risk: hosted mode uses read-only tools, but local AI keeps full mutating tools (`src/ai/runChat.ts:57`). The system prompt warns the model that mutations are live (`src/ai/system-prompt.ts:27`), but the app does not require an app-level proposal/approval step before state changes. Workbook guided import also injects workbook text directly into the chat seed (`src/ai/AIPanel.tsx:162`), so a malicious workbook can try to steer the model toward tool calls.

Required before promoting AI import as trusted:

- Add a proposal queue: AI drafts changes, user approves, deterministic app code applies them.
- Add prompt-injection fixtures for workbook imports.
- Make the AI import wizard prefer structured row review over direct chat mutation.

### 4. Strict input boundaries still have correctness holes

Risk: explicit unknown lease jurisdictions normalize to `tx_fee` (`src/types/owner.ts:96`), and bad title decimal strings can become zero through `d()` (`src/engine/decimal.ts:20`) when `toCalc()` parses persisted nodes (`src/engine/math-engine.ts:65`). This can turn bad imports into plausible Texas math instead of review-blocking errors.

Required before main:

- Treat missing legacy jurisdiction as `tx_fee`, but treat explicit unknown values as invalid/reference-only.
- Add an alias only when intentional, for example `blm` should not silently become Texas fee math.
- Add strict raw title-fraction validation on import/load and in graph validation.

## P1 / Should Fix Before Main Cleanup

### Document attachment scoping and delete semantics

`DocumentRecord` is workspace-scoped (`src/types/document.ts:60`), but `DocumentAttachment` lacks `workspaceId` (`src/types/document.ts:105`). Attachment APIs list and mutate by entity kind/id only (`src/storage/document-store.ts:366`). A shared document delete intentionally cascade-deletes every attachment (`src/storage/document-store.ts:336`), but node-level UX can make this feel like removing one local link.

Fix direction:

- Add `workspaceId` to `DocumentAttachment`.
- Make entity-link APIs workspace-scoped.
- Separate "detach from this entity" from "delete this document everywhere".
- Delete the blob only when explicitly global or when unreferenced.

### Upload limits are inconsistent

Owner documents and Research imports accept arbitrary files without local size/type gating (`src/components/owners/OwnerDocsTab.tsx:43`, `src/views/ResearchView.tsx:2523`). Document registry upload paths are more constrained.

Fix direction:

- Reuse the existing file-size and extension policy everywhere files enter the app.
- Make unsupported file types download-only or reject them with clear copy.

### Desk Map can look empty on real demo data

The PanZoom container starts at `{ x: 0, y: 0 }` and zoom `0.8` (`src/views/DeskMapView.tsx:187`). The tree transform is applied at `src/views/DeskMapView.tsx:285`. With Raven Forest, the active tree can render far to the right of the viewport.

Fix direction:

- Auto-fit/center the active tree after demo load, import, and tract changes.
- Add visible `+`, `-`, `Fit`, and `Center` controls for mouse, trackpad, and tablet users.
- Preserve user pan after manual movement.

### Desk Map over-100 coverage display has an arithmetic wording bug

Coverage derives `missingOwnership = 1 - currentOwnership` (`src/components/deskmap/deskmap-coverage.ts:329`). When coverage exceeds 100%, this becomes negative, and `formatAsFraction()` displays non-positive values as `0/1` (`src/engine/fraction-display.ts:115`). The UI can therefore make excess/missing ownership confusing.

Fix direction:

- Track missing and excess as separate non-negative values.
- Label temporary over-100 states plainly.

### Root aggregate policy is unclear

`createRootNode` blocks an individual root over 1, but multiple mineral roots can push total tract coverage above 100%. The UX copy says temporary over-100 is allowed, which may be correct for title staging, but the engine/docs/tests should make that policy explicit.

Fix direction:

- Keep over-100 as a warning state if it is intentional.
- Add tests for aggregate roots and reconciliation workflows.

## P2 / Product And Workflow Gaps

### M&B extraction should become a first-class reviewed workflow

This is the most useful next landman-facing feature. Current legal descriptions are mostly free text in node, research, wizard, and federal views. The app should not let AI or OCR directly mutate title math from legal descriptions.

MVP:

- Extract verbatim legal-description text from uploaded instruments.
- Propose parsed calls, acreage, county, survey/abstract, section/block, grantor/grantee, recording references, and tract candidates.
- Show confidence and source snippet for every extracted field.
- Require landman approval before linking extracted data to tracts, maps, research records, or title cards.
- Keep M&B output as cited evidence until a user explicitly applies it.

### Add a "What needs attention?" workspace dashboard

Small independent landmen need a morning triage surface more than another blank canvas. Suggested counts:

- unlinked documents
- missing legal descriptions
- missing county/instrument metadata
- unresolved curative issues
- source gaps for title cards
- lease expirations and top-lease overlaps
- unleased current owners
- AI/import rows awaiting review
- federal/private reference packets under review

### Document registry is useful, but not yet a full document room

The registry has metadata, filters, duplicates, and packet preview. It still needs stronger readiness checks:

- legal description present
- tract identity present
- acreage/survey/abstract present
- party completeness
- linked owner/lease/curative/research records
- packet completeness by workflow

### Federal Leasing and Research are correctly reference-only, but need packet checklists

The reference-only boundary is good. Next useful step is checklist support:

- BLM/MLRS packet completeness
- USFS/federal surface-use evidence
- county records search checklist
- RRC/GLO cross-check checklist
- attorney-review packet status

### AI display and row review need cleanup

- Hosted mode forces a proxy/model path, while the panel header renders local provider settings (`src/ai/AIPanel.tsx:181`).
- Workbook row review stages title nodes but does not yet feel like a complete owner/lease-ready import lane.
- AI needs citation-grounded document/research tools before it should answer document-room questions.

### Accessibility and navigation polish

- Some card-like buttons have very long accessible names in Research/Federal views.
- Header navigation is dense on mobile/tablet and relies on horizontal overflow.
- Hover-only Desk Map actions should have a selected-card action surface.
- Leasehold contains visible implementation-style copy such as backticked view names, which reads more like developer documentation than operator UI.

## P3 / Housecleaning

- `CONTINUATION-PROMPT.md` was stale at audit start and pointed to `codex/document-registry-build-2026-05-16` instead of the actual branch.
- `PATCH_PLAN.md` and roadmap notes appear stale in places where code/tests show work has already landed.
- A tracked ignored build artifact was reported by the architecture agent: `dist/assets/xlsx-CkFp8p6R.js`. Confirm whether `dist` is intentionally tracked; otherwise remove generated artifacts in a separate cleanup branch.
- Runsheet export still has legacy `TORS_Documents` naming in the architecture path and should align with the document registry vocabulary.

## Engine/Architecture Strengths

- Decimal math is centralized and high precision.
- Texas-only active math boundary is documented and mostly respected.
- NPRI/ORRI/WI/lease distinctions are modeled explicitly.
- Hosted AI is read-only by default.
- Cognito workspace keying no longer appears to fall back to the local default while signed out.
- Browser/unit/E2E coverage is much broader than earlier snapshots.

## Recommended Cleanup Sequence

1. Security hotfix pass: blob validation/sandboxing, upload limits, backend audit update, and `xlsx` strategy.
2. Correctness pass: strict persisted fraction validation and explicit unknown jurisdiction handling.
3. Document persistence pass: workspace-scoped attachments and detach-vs-delete semantics.
4. AI safety pass: proposal/approval queue plus prompt-injection and workbook-timeout tests.
5. UX confidence pass: Desk Map fit/center controls, workspace attention dashboard, M&B reviewed extraction MVP.
6. Docs housecleaning: update `PATCH_PLAN.md`, `ROADMAP.md`, `SECURITY.md`, `TESTING.md`, and user-facing docs after the fixes land.

## Main Readiness Bar

Treat this branch as a strong audit baseline, not the final main branch. A clean main candidate should have:

- clean production audits or documented accepted residual risk
- no known same-origin document-preview injection path
- strict bad-data rejection for persisted math inputs
- AI cannot directly mutate workspace state without app-level approval
- document links scoped by workspace
- E2E, unit, build, deploy check, and browser smoke all passing
- active docs and continuation prompt aligned with the actual branch
