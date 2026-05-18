# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Current Branch

Current branch: `claude/epic-hoover-48f4d0`.

Latest known commit before this audit work: `6d70597 docs: handoff prompt for
the Audit Sheet export work`.

Do not commit directly to `main`.

## Current Workstream

Main-readiness / housecleaning audit for the current LANDroid branch.

The audit covered:

- UX and landman workflow usefulness
- Texas title/leasehold engine and invariants
- architecture, Zustand/Dexie persistence, document registry, and import/export
- hosted security, file upload/preview risk, dependency audit state, and AI proxy
- AI chat, workbook import, row review, mutation tools, and prompt-injection risk
- browser runtime checks across Desk Map, Documents, Leasehold, Federal Leasing,
  Research, and the AI panel

The consolidated point-in-time report is:

- `docs/archive/audits/MAIN_READINESS_AUDIT_2026-05-17.md`

One small test-only fix was made during validation:

- `tests/e2e/landroid-workflows.spec.ts` now clicks the exact `Owners` nav
  button in the export/import workflow so formula badges named "Linked Owners"
  do not create an ambiguous Playwright locator.

The first security blocker cleanup has also landed in the working tree:

- Document-registry PDF uploads and `.landroid` document imports are now
  magic-byte checked and normalized to `application/pdf`.
- Legacy v7 PDF payload migration rejects non-PDF bytes instead of carrying
  them into v8 document rows.
- PDF previews in document, asset, lease-document, and map modals are sandboxed
  without same-origin privileges.
- Owner document and Research file upload entry points now use explicit
  extension allowlists plus shared size limits before saving.
- A Playwright hover-action test was stabilized by making hidden Desk Map
  action rows visible inside that test only.
- Main-readiness dependency/runtime cleanup is now in the working tree:
  - Removed the production `xlsx` dependency.
  - AI spreadsheet row review is CSV-only until a safer binary Excel parser is
    selected.
  - Runsheet export now emits CSV instead of `.xlsx`.
  - Backend `@aws-sdk/client-dynamodb` lockfile updated to `3.1048.0`, clearing
    the `fast-xml-builder` production audit issue.
  - Node.js 22 is the documented local/CI/Lambda runtime target.
  - `.github/workflows/ci.yml` now runs root and AI-proxy install, production
    audit, tests, and build on Node.js 22.
- Document attachment scoping/cascade cleanup is now in the working tree:
  - `DocumentAttachment` rows now carry `workspaceId`.
  - Dexie v9 backfills attachment `workspaceId` from the linked document row.
  - `.landroid` document import normalizes attachment rows to the importing
    workspace.
  - Branch/tract document cleanup now deletes affected docs in one storage
    transaction and reports a visible `lastError` if cleanup fails after the
    in-memory node delete.
  - Node-level remove actions now detach only the selected attachment link, and
    branch/tract cleanup deletes a document blob only when no surviving links
    still reference it.
- Strict jurisdiction/fraction validation is now in the working tree:
  - Explicit unknown lease jurisdictions now throw instead of normalizing into
    `tx_fee`.
  - Missing/blank legacy lease jurisdiction still defaults to `tx_fee`.
  - Persisted `.landroid` node fraction fields now reject malformed,
    non-finite, or negative values instead of coercing to zero.
- AI approval and prompt-injection cleanup is now in the working tree:
  - Mutating AI tools create pending proposals instead of writing live state.
  - The AI panel approval queue applies one proposal only after user approval.
  - Each approved AI proposal captures one undo snapshot.
  - CSV prompt rows are labeled as untrusted user data, and hostile spreadsheet
    instructions are tested as cell values.
- Desk Map fit/center cleanup is now in the working tree:
  - The canvas auto-fits the active tract after load/import/tract switch.
  - A `Fit` control recenters large trees after manual pan/zoom.

## Latest Validation

Completed on `claude/epic-hoover-48f4d0`:

- `npm run lint` passed.
- `npm test` passed: 70 files, 587 tests. Known post-v8 backup error-path log
  still appears.
- `npm run build` passed. Known Vite warnings remain:
  - `src/storage/db.ts` is both dynamically and statically imported.
  - some generated chunks exceed 500 kB after minification.
- `npm run deploy:check` passed. It warned that `amplify-rewrites.json` still
  contains the expected `REPLACE_WITH_FUNCTION_URL_HOST` template placeholder.
- `cd backend/ai-proxy && npm test` passed: 3 files, 38 tests.
- `cd backend/ai-proxy && npm run build` passed.
- `npm run test:e2e` passed: 11 Playwright workflows. It initially exposed one
  hover-only Desk Map delete-button flake; the test now makes those hidden
  action rows visible inside the test before clicking.
- Manual in-app browser smoke passed for loading Raven Forest, opening
  Documents, Leasehold, Federal Leasing, Research, and the AI panel.
- Manual in-app browser smoke after document hardening loaded Raven Forest and
  the Documents route. The Browser safety policy blocked direct PDF-preview
  clicking, so PDF-preview rendering is covered by Playwright E2E rather than
  the manual browser click.

Audit-only checks:

- Root `npm audit --omit=dev` passed: 0 vulnerabilities.
- Backend `cd backend/ai-proxy && npm audit --omit=dev` passed: 0
  vulnerabilities.

Additional validation after dependency/runtime cleanup:

- `npm test -- src/ai/wizard/__tests__/parse-workbook.test.ts src/storage/__tests__/runsheet-export.test.ts`
  passed: 2 files, 10 tests.
- `npm run lint` passed.
- `npm test` passed: 70 files, 588 tests. Known post-v8 backup error-path log
  still appears.
- `npm run build` passed. Known Vite warnings remain:
  - `src/storage/db.ts` is both dynamically and statically imported.
  - some generated chunks exceed 500 kB after minification.
- `npm run deploy:check` passed. It warned that `amplify-rewrites.json` still
  contains the expected `REPLACE_WITH_FUNCTION_URL_HOST` template placeholder.
- `cd backend/ai-proxy && npm test` passed: 3 files, 38 tests.
- `cd backend/ai-proxy && npm run build` passed.
- `cd backend/ai-proxy && npm run package` passed and refreshed the ignored
  local `lambda.zip` artifact.
- `npm test -- src/store/__tests__/workspace-store.test.ts src/store/__tests__/workspace-store-doc-actions.test.ts src/storage/__tests__/document-migration.test.ts src/storage/__tests__/workspace-persistence.test.ts src/documents/__tests__/document-registry.test.ts`
  passed: 5 files, 60 tests. The intentional cascade-failure test logs the
  simulated Dexie failure.
- `npm run lint` passed after the document scoping changes.
- `npm test` passed after the document scoping changes: 70 files, 589 tests.
  Known intentional error-path logs appear for document cascade failure and
  post-v8 backup failure coverage.
- `npm run build` passed after the document scoping changes. Known Vite
  warnings remain:
  - `src/storage/db.ts` is both dynamically and statically imported.
  - some generated chunks exceed 500 kB after minification.
- `npm test -- src/types/__tests__/lease-jurisdiction.test.ts src/types/__tests__/node-attachments.test.ts src/storage/__tests__/workspace-persistence.test.ts src/storage/__tests__/csv-io.test.ts`
  passed after strict jurisdiction/fraction validation: 4 files, 62 tests.
- `npm run lint` passed after strict jurisdiction/fraction validation.
- `npm test -- src/components/deskmap/__tests__/deskmap-coverage.test.ts src/types/__tests__/lease-jurisdiction.test.ts`
  passed after preserving missing legacy lease jurisdictions as Texas math:
  2 files, 49 tests.
- `npm test` passed after strict jurisdiction/fraction validation: 70 files,
  594 tests. Known intentional error-path logs appear for document cascade
  failure and post-v8 backup failure coverage.
- `npm run build` passed after strict jurisdiction/fraction validation. Known
  Vite warnings remain:
  - `src/storage/db.ts` is both dynamically and statically imported.
  - some generated chunks exceed 500 kB after minification.
- `git diff --check` passed after strict jurisdiction/fraction validation.
- `npm test -- src/storage/__tests__/document-store.test.ts src/store/__tests__/workspace-store-doc-actions.test.ts src/store/__tests__/workspace-store.test.ts`
  passed after document detach/shared-blob cleanup: 3 files, 27 tests. The
  intentional cascade-failure test logs the simulated Dexie failure.
- `npm run lint` passed after document detach/shared-blob cleanup.
- `npm test` passed after document detach/shared-blob cleanup: 71 files, 595
  tests. Known intentional error-path logs appear for document cascade failure
  and post-v8 backup failure coverage.
- `npm run build` passed after document detach/shared-blob cleanup. Known Vite
  warnings remain:
  - `src/storage/db.ts` is both dynamically and statically imported.
  - some generated chunks exceed 500 kB after minification.
- `git diff --check` passed after document detach/shared-blob cleanup.
- `npm test -- src/ai/__tests__/tools.test.ts src/ai/__tests__/read-only-tools.test.ts src/ai/__tests__/undo-store.test.ts src/ai/wizard/__tests__/parse-workbook.test.ts src/views/__tests__/view-helpers.test.ts`
  passed after AI approval/prompt-injection and Desk Map fit cleanup: 5 files,
  33 tests.
- `npm run lint` passed after AI approval/prompt-injection and Desk Map fit
  cleanup.
- `npm test` passed after AI approval/prompt-injection and Desk Map fit
  cleanup: 71 files, 598 tests. Known intentional error-path logs appear for
  document cascade failure and post-v8 backup failure coverage.
- `npm run build` passed after AI approval/prompt-injection and Desk Map fit
  cleanup. Known Vite warnings remain:
  - `src/storage/db.ts` is both dynamically and statically imported.
  - some generated chunks exceed 500 kB after minification.
- `npm run deploy:check` passed after AI approval/prompt-injection and Desk Map
  fit cleanup. It warned that `amplify-rewrites.json` still contains the
  expected `REPLACE_WITH_FUNCTION_URL_HOST` template placeholder.
- `npm run test:e2e -- tests/e2e/landroid-workflows.spec.ts` passed after
  adding Desk Map `Fit` control browser coverage: 11 Playwright workflows.
- Root `npm audit --omit=dev` passed after final GitHub/AWS prep: 0
  vulnerabilities. The first sandboxed attempt failed DNS, then passed with
  registry access.
- Backend `cd backend/ai-proxy && npm audit --omit=dev` passed after final
  GitHub/AWS prep: 0 vulnerabilities. The first sandboxed attempt failed DNS,
  then passed with registry access.
- `cd backend/ai-proxy && npm test` passed after final GitHub/AWS prep: 3
  files, 38 tests.
- `cd backend/ai-proxy && npm run build` passed after final GitHub/AWS prep.
- `cd backend/ai-proxy && npm run package` passed after final GitHub/AWS prep
  and refreshed the ignored local `lambda.zip` artifact.
- `git diff --check` passed after AI approval/prompt-injection and Desk Map fit
  cleanup.

Run `git diff --check`, `npm run lint`, and targeted tests after the next
cleanup changes. Run the full pipeline again before any main merge.

## Open Risks And Assumptions

Remaining main-readiness blockers from the audit:

- No legacy `.landroid` compatibility is required; import/export/data formats
  can stay fluid while the cleanest model is chosen.
- PDFs and documents are first-class uploads and must stay secure.
- Spreadsheet upload still matters for AI-guided unit/deskmap creation, but
  parsed AI spreadsheet review is currently CSV-only. Binary Excel uploads can
  be stored as unparsed documents until a safer parser is selected.
- AWS Lambda Node.js 22 (`nodejs22.x`) is the current Lambda guidance. AWS docs
  list Node.js 22 on Amazon Linux 2023 with deprecation on 2027-04-30, create
  block on 2027-06-01, and update block on 2027-07-01.
- Local AI mutating tools are approval-gated. The current queue is intentionally
  simple: one proposal per tool call, approve/reject in the AI panel, and one
  undo snapshot per approved proposal. Further UX polish can group larger
  reviewed batches later.
- CSV guided import labels spreadsheet text as untrusted data and has hostile
  cell coverage, but broader prompt-injection suites are still useful before
  expanding document/OCR AI workflows.
- Document attachment link rows are now workspace-scoped, UI remove detaches
  only the selected link, and cascade cleanup deletes only orphaned document
  blobs in one storage transaction.
- Large Desk Map trees now auto-fit and have a browser-covered `Fit` control.
  Add mobile-specific visual checks before merge if layout risk feels high.

Product opportunities:

- Make M&B/legal-description extraction a reviewed, source-cited workflow.
- Add a "What needs attention?" dashboard for unlinked docs, missing legal
  descriptions, source gaps, curative issues, expiring leases, unleased owners,
  and import rows awaiting review.
- Add federal/private packet checklists while preserving the reference-only math
  boundary.

## Likely Next Steps

- Clean up GitHub state, checkpoint this branch, and prepare the reviewed code
  path for `main`.
- Run the full release validation set once the GitHub cleanup is complete.
- Prepare AWS hosted deployment using the Node.js 22 Lambda/runtime guidance.
- Add broader AI prompt-injection fixtures before OCR/document-query workflows.
- Update `PATCH_PLAN.md`, `ROADMAP.md`, `SECURITY.md`, `TESTING.md`,
  `README.md`, `USER_MANUAL.md`, and `CHANGELOG.md` as cleanup fixes land.

## Paste-Ready Next Chat Prompt

Resume in `/Users/abstractmapping/projects/landroid` on branch
`claude/epic-hoover-48f4d0`. Read `AGENTS.md`, `PROJECT_CONTEXT.md`,
`docs/README.md`, and `CONTINUATION-PROMPT.md` first. Continue the
main-readiness housecleaning from
`docs/archive/audits/MAIN_READINESS_AUDIT_2026-05-17.md`. The document
blob validation/sandboxing pass has landed in the working tree. Continue with
GitHub cleanup/checkpointing, release validation for `main`, and AWS hosted
deployment prep. Production dependency audits are currently clean, parsed AI
spreadsheet import is CSV-only, Runsheet export is CSV, Lambda/local runtime
guidance is Node.js 22, GitHub Actions CI has been added, document attachment
links are workspace-scoped with detach-only UI removal and orphan-only cascade
deletion, AI mutations are approval-gated with one undo snapshot per approved
proposal, Desk Map has auto-fit plus browser-covered `Fit`, and strict
jurisdiction/fraction validation is in place.
