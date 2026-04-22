# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.

## Current Branch

`codex/audit-project-end-to-end`

## Current Workstream

Audit remediation, professional repo-doc cleanup, AI workbook import hardening,
Desk Map reset UX, multi-unit Raven Forest separation, and hosted deployment
planning.

## Last Completed

- Created `AUDIT_REPORT.md` and `PATCH_PLAN.md`.
- Hardened AI rollback, cancel/status UX, provider timeout behavior, and session-only cloud-key handling.
- Enforced Texas-only active lease math gates and stricter AI lease creation/attachment validation.
- Added Desk Map over-100 contributor warnings.
- Added first-pass spreadsheet `Review rows` staging/import workflow.
- Hardened workbook row staging against the user's Elmore DOTO workbook format:
  safer Grantor/Grantee header mapping, tract-tab detection, gross-acre
  extraction, DOTO ownership-row context inheritance, title-interest expression
  parsing, per-sheet Desk Map targeting, and Instrument dropdown reuse.
- Added a confirmed `Clear Map` Desk Map action that empties the active tract,
  removes node-linked artifacts for deleted cards, keeps other tracts and owner
  records, and preserves node records that are still shared with another Desk Map.
- Added project-scale unit focus for Raven Forest Unit A/B and future units:
  Desk Map unit codes are no longer hardcoded to A/B, `.landroid` autosave/export
  carries active unit focus, Leasehold computes only the focused unit, Owners
  filters to the focused unit, and unit-wide ORRI/WI rows now carry `unitCode`.
- Added `DEPLOYMENT_PLAN.md`, a staged AWS-hosted rollout plan for getting
  LANDroid online safely with a backend boundary, Cognito auth, S3/RDS
  persistence, server-side AI proxying, and a provider strategy that can later
  support OpenAI, Anthropic, or Bedrock.
- Added professional docs rails:
  - `ARCHITECTURE.md`
  - `TESTING.md`
  - `SECURITY.md`
  - `ROADMAP.md`
  - `CHANGELOG.md`
  - `docs/README.md`
  - core ADRs under `docs/adr`
- Shortened `README.md`, moved AI guidance into its own `USER_MANUAL.md` section,
  added audit/patch-plan status notes, and marked archived docs as historical.

## Last Validation

Most recent full code validation before docs cleanup:

- `npm run lint` - passed.
- `npm test` - passed: 50 files, 380 tests. Known non-blocking Zustand persist warnings remain in AI settings tests.
- `npm run build` - passed. Known large Vite chunk warning remains.
- `npm run test:e2e` - passed active tests: 4 passed, 5 skipped.

Docs cleanup validation:

- `git diff --check -- '*.md' 'docs/**/*.md' 'tests/fixtures/**/*.md'` - passed.
- No code paths changed in the docs cleanup slice, so code tests were not rerun
  for that slice.

Most recent workbook-import validation:

- `npm test -- --run src/ai/wizard/__tests__/row-staging.test.ts src/ai/wizard/__tests__/parse-workbook.test.ts`
  - passed: 2 files, 11 tests.
- `npm test` - passed: 50 files, 384 tests. Known non-blocking Zustand
  persist warnings remain in AI settings tests.
- `npm run lint` - passed.
- `git diff --check -- '*.md' 'docs/**/*.md' 'src/**/*.ts' 'src/**/*.tsx'` - passed.
- `npm run build` - passed. Known large Vite chunk warning remains for
  `AIPanel`.
- Elmore sample parse was inspected locally with the workbook at
  `/Users/abstractmapping/Downloads/LANDroid - Springhill/EDITED_DOTO_Runsheet_Elmore#1_Unit_2026_02-05 .xlsx`;
  it detected 7 tract tabs and staged 238 rows.

Most recent Desk Map reset validation:

- `npm test -- --run src/store/__tests__/workspace-store.test.ts` - passed:
  1 file, 6 tests.
- `npm test -- --run src/store/__tests__/workspace-store.test.ts src/ai/wizard/__tests__/row-staging.test.ts`
  - passed: 2 files, 14 tests.
- `npm run lint` - passed.
- `git diff --check -- '*.md' 'docs/**/*.md' 'src/**/*.ts' 'src/**/*.tsx'` - passed.
- `npm run build` - passed. Known large Vite chunk warning remains for
  `AIPanel`.

Most recent multi-unit validation:

- `npm test -- --run src/utils/__tests__/desk-map-units.test.ts src/store/__tests__/workspace-store.test.ts src/components/leasehold/__tests__/leasehold-summary.test.ts src/storage/__tests__/seed-test-data.test.ts src/storage/__tests__/workspace-persistence.test.ts src/storage/__tests__/autosave-change-detection.test.ts`
  - passed: 6 files, 54 tests.
- `npm run lint` - passed.
- `git diff --check -- '*.md' 'docs/**/*.md' 'src/**/*.ts' 'src/**/*.tsx'`
  - passed.
- `npm test` - passed: 51 files, 393 tests. Known non-blocking Zustand
  persist warnings remain in AI settings tests.
- `npm run build` - passed. Known large Vite chunk warning remains for
  `AIPanel`.
- Playwright browser sanity check against `http://127.0.0.1:5174/` loaded the
  Raven Forest combinatorial demo, switched Leasehold from Unit A to Unit B,
  switched Owners back to Unit A, and reported no console/page errors.

Most recent deployment-planning validation:

- `git diff --check -- '*.md' 'docs/**/*.md' 'src/**/*.ts' 'src/**/*.tsx'`
  - passed.
- No runtime code changed in the deployment-planning slice, so app tests were
  not rerun for this doc-only update.

## Open Risks

- `xlsx` remains vulnerable and needs containment, worker isolation, or replacement.
- Batch `graftToParent` is still not atomic.
- `.landroid` and CSV imports still need stricter size/shape/fraction validation.
- Five Playwright workflows remain skipped.
- AI live mutation approval/proposal UX is improved by rollback but not fully app-gated.
- Spreadsheet row staging is improved for the Elmore DOTO sample but still needs
  more real-workbook formats and browser-level workflow verification.
- Unit focus now separates Raven Forest A/B in Leasehold and Owners, but
  per-unit operator/effective-date metadata is still represented by the shared
  leasehold defaults.
- A true project-picker landing page needs a multi-workspace saved-project
  index; current persistence still has one default autosave slot.
- The new hosted deployment plan exists, but none of the required backend/auth/
  storage/security implementation work has started yet.

## Local Noise / Uncommitted State

- `.DS_Store` was already dirty before the audit/remediation work.
- `dist/index.html` changed as a generated side effect of `npm run build`.
- No GitHub checkpoint has been requested, so no commit or push has been made.

## Next Best Tasks

- [x] Validate docs cleanup with `git diff --check`.
- [x] Test and harden spreadsheet staging against the Elmore DOTO workbook sample.
- [ ] Test spreadsheet staging against additional recurring workbook formats.
- [ ] Browser-verify the workbook row-review flow with tract creation and same-tract attachment.
- [ ] Browser-verify `Clear Map` from the Desk Map toolbar.
- [x] Browser-verify Raven Forest Unit A/B switching in Leasehold and Owners.
- [ ] Promote units to first-class metadata records if future units need separate operator/effective-date settings.
- [ ] Design multi-project persistence before building the project picker landing page.
- [ ] Execute Phase 0 of `DEPLOYMENT_PLAN.md` with hosted frontend, domain,
  CloudFront/headers/WAF baseline, and environment separation.
- [ ] Design and implement the backend boundary from `DEPLOYMENT_PLAN.md`
  before exposing cloud AI or project persistence on the public internet.
- [ ] Harden the `xlsx` read path.
- [ ] Make batch graft/attach atomic.
- [ ] Harden `.landroid` and CSV import paths.
- [ ] Retarget or replace skipped e2e workflows.

## Paste-Ready Resume Prompt

> Resume work in `/Users/abstractmapping/projects/landroid` on branch `codex/audit-project-end-to-end`. First read `AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and `CONTINUATION-PROMPT.md`. The repo now has professional docs rails (`ARCHITECTURE.md`, `TESTING.md`, `SECURITY.md`, `ROADMAP.md`, `CHANGELOG.md`, ADRs) plus `DEPLOYMENT_PLAN.md`, which lays out the secure AWS-hosted path: hosted frontend, Cognito auth, backend boundary, S3/RDS persistence, server-side AI proxying, and OpenAI/Anthropic/Bedrock provider options. Audit remediation has already improved AI rollback/key/jurisdiction/lease-validation/spreadsheet-staging safety. Desk Map has `Clear Map`; Raven Forest Unit A/B has active unit focus in Leasehold and Owners. Next likely task is deciding whether to execute deployment Phase 0/1 first or continue import hardening (`xlsx`, workbook browser verification, and atomic graft/attach). Keep Texas-only active math scope and do not modify generated `dist`/`dist-node` unless explicitly requested.
