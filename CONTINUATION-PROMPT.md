# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.

## Current Branch

`landroid-4-19-checkpoint`

## Current Workstream

Audit remediation and professional repo-doc cleanup.

## Last Completed

- Created `AUDIT_REPORT.md` and `PATCH_PLAN.md`.
- Hardened AI rollback, cancel/status UX, provider timeout behavior, and session-only cloud-key handling.
- Enforced Texas-only active lease math gates and stricter AI lease creation/attachment validation.
- Added Desk Map over-100 contributor warnings.
- Added first-pass spreadsheet `Review rows` staging/import workflow.
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

## Open Risks

- `xlsx` remains vulnerable and needs containment, worker isolation, or replacement.
- Batch `graftToParent` is still not atomic.
- `.landroid` and CSV imports still need stricter size/shape/fraction validation.
- Five Playwright workflows remain skipped.
- AI live mutation approval/proposal UX is improved by rollback but not fully app-gated.
- Spreadsheet row staging needs real-workbook testing and alias tuning.

## Local Noise / Uncommitted State

- `.DS_Store` was already dirty before the audit/remediation work.
- `dist/index.html` changed as a generated side effect of prior `npm run build`.
- No GitHub checkpoint has been requested, so no commit or push has been made.

## Next Best Tasks

- [x] Validate docs cleanup with `git diff --check`.
- [ ] Test spreadsheet staging against real recurring workbook formats.
- [ ] Harden the `xlsx` read path.
- [ ] Make batch graft/attach atomic.
- [ ] Harden `.landroid` and CSV import paths.
- [ ] Retarget or replace skipped e2e workflows.

## Paste-Ready Resume Prompt

> Resume work in `/Users/abstractmapping/projects/landroid` on branch `landroid-4-19-checkpoint`. First read `AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and `CONTINUATION-PROMPT.md`. The repo now has professional docs rails (`ARCHITECTURE.md`, `TESTING.md`, `SECURITY.md`, `ROADMAP.md`, `CHANGELOG.md`, ADRs), and audit remediation has improved AI rollback/key/jurisdiction/lease-validation/spreadsheet-staging safety. Next likely task is testing spreadsheet staging against real workbooks, then hardening the `xlsx` read path. Keep Texas-only active math scope and do not modify generated `dist`/`dist-node` unless explicitly requested.
