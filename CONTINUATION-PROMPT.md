# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.

## Current Branch

`audit-verification-pre-aws`

## Current Workstream

Prepare two independent, report-only full audits after the first successful
trusted AWS test deployment.

## Last Completed

- Committed and pushed audit hardening/deploy-readiness checkpoint
  `7a67ff3` (`fix(audit): harden pre-AWS test deploy readiness`) to
  `origin/audit-verification-pre-aws`.
- Deployed Amplify branch `audit-verification-pre-aws`.
- Added Amplify `/api/ai/<*>` rewrite to the Lambda Function URL and retained
  the SPA catch-all rewrite.
- Added `landroid.abstractmapping.com` as an Amplify custom domain with GoDaddy
  CNAME records and an Amplify-managed SSL certificate.
- Confirmed hosted smoke test passed on 2026-05-14:
  root HTML `200`, required security headers present, unauthenticated
  `/api/ai/*` rejected with `401`, SPA fallback served `index.html`, and
  Cognito user-pool JWKS returned `200`.
- Added parallel audit prep docs:
  `FULL_AUDIT_COORDINATION.md`, `CODEX_FULL_AUDIT_PROMPT.md`, and
  `CLAUDE_FULL_AUDIT_PROMPT.md`.
- Expanded the full-audit scope to include improvement ideas, additions, fixes,
  redundancies, mapping/document database readiness, AI PDF-to-ArcGIS-traverse
  workflow planning, and possible 3D Desk Map exploration.

## Latest Validation

- `npm run deploy:check`
  - passed before deploy; Lambda zip contained `handler.js`, `usage-store.js`,
    `request-policy.js`, `package.json`, and
    `node_modules/@aws-sdk/client-dynamodb/package.json`.
- `npm run lint`
  - passed before deploy.
- `npm test`
  - passed before deploy: 58 files, 460 tests. Known non-blocking
    `--localstorage-file` warning still appears in settings-store tests.
- `npm test` from `backend/ai-proxy`
  - passed before deploy: 3 files, 29 tests.
- `npx tsc -p tsconfig.json --noEmit` from `backend/ai-proxy`
  - passed before deploy.
- `npm run bundle` from `backend/ai-proxy`
  - passed before deploy; produced a 21 MB ignored `lambda.zip`.
- `npm run build`
  - passed before deploy; Vite reported the known non-blocking large chunk
    warning.
- `npm run test:e2e`
  - passed before deploy: 4 active Playwright tests, 5 intentionally skipped
    workflows.
- `bash scripts/smoke-test-hosted.sh`
  - passed after domain activation on 2026-05-14.

## Open Risks

- The next workstream is an audit, not a fix pass. Keep audit branches
  report-only so Codex and Claude results stay comparable.
- The OpenAI API key appeared in a screenshot during setup. The user is not
  worried for the private test, but rotate it before sharing with any tester.
- Project data is still local-first IndexedDB. The same Cognito login on a
  phone or another computer will not sync desktop workspace data.
- Legacy hosted IndexedDB data under `default` is intentionally not
  auto-migrated; users must export/import `.landroid` snapshots manually.
- The `xlsx` package still has no upstream fix; current mitigation is size caps
  plus Web Worker isolation.
- Five Playwright workflows remain intentionally skipped pending fixture
  retargeting.
- Leasehold summary still has some lenient parser math call sites outside the
  Desk Map coverage fix; review before broader hosted/data-import rollout.

## Audit Branch Plan

Create both branches from the same audit-prep commit:

- `codex/full-line-audit-2026-05-14`
  - Prompt: `CODEX_FULL_AUDIT_PROMPT.md`
  - Expected report: `AUDIT_REPORT_CODEX_FULL_2026-05-14.md`
- `claude/full-line-audit-2026-05-14`
  - Prompt: `CLAUDE_FULL_AUDIT_PROMPT.md`
  - Expected report: `AUDIT_REPORT_CLAUDE_FULL_2026-05-14.md`

Both audits should use `FULL_AUDIT_COORDINATION.md` as the shared scope,
persona, evidence, and output-format contract.

If the tool supports subagents, each audit may spawn read-only subagents for
distinct slices, but the final report must be deduplicated and comparison-ready.

## Local Noise / Uncommitted State

- At the time this handoff was updated, audit coordination docs were being
  prepared for commit and branch fan-out.
- Generated artifacts remain ignored: `backend/ai-proxy/lambda.zip`,
  `backend/ai-proxy/dist/`, `dist/`, `dist-node/`, `playwright-report/`, and
  `test-results/`.

## Next Best Tasks

- [ ] Commit and push this audit-prep checkpoint.
- [ ] Create and push `codex/full-line-audit-2026-05-14`.
- [ ] Create and push `claude/full-line-audit-2026-05-14`.
- [ ] Start two new chats, one per branch, using the matching prompt file.
- [ ] Compare the two generated audit reports before fixing anything.

## Paste-Ready Resume Prompt

> Resume work in `/Users/abstractmapping/projects/landroid`. First read `AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, `CONTINUATION-PROMPT.md`, and `FULL_AUDIT_COORDINATION.md`. The trusted test deployment is live at `https://landroid.abstractmapping.com`, and `bash scripts/smoke-test-hosted.sh` passed after custom-domain activation on 2026-05-14. The current task is to run a report-only full audit on the assigned branch. If this is the Codex branch, use `CODEX_FULL_AUDIT_PROMPT.md` and write `AUDIT_REPORT_CODEX_FULL_2026-05-14.md`. If this is the Claude branch, use `CLAUDE_FULL_AUDIT_PROMPT.md` and write `AUDIT_REPORT_CLAUDE_FULL_2026-05-14.md`. Do not fix source code during the audit; classify every in-scope file, cite `file:line` for every claim, and record what passed, what was deferred, and what was skipped. Also produce a separate opportunity backlog covering improvements, additions, fixes, redundancies, mapping/document database readiness, AI PDF-to-ArcGIS-traverse planning, and possible 3D Desk Map exploration. Use read-only subagents if available, but integrate one deduplicated report.
