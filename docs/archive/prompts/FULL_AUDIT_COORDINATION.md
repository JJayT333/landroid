# LANDroid Full Audit Coordination

Use this file to run two independent report-only audits and compare results.

## Baseline

- Date prepared: 2026-05-14
- Repository: `JJayT333/landroid`
- Audit-prep source branch: `audit-verification-pre-aws`
- Audit branches:
  - Codex: `codex/full-line-audit-2026-05-14`
  - Claude: `claude/full-line-audit-2026-05-14`
- Latest deploy checkpoint before audit prep: `7a67ff3`
- Hosted URL: `https://landroid.abstractmapping.com`
- Hosted smoke status: `bash scripts/smoke-test-hosted.sh` passed on
  2026-05-14 after Amplify custom-domain activation.

## Audit Intent

The audit should answer four questions:

1. What is genuinely ready for a trusted test deploy?
2. What was passed over or left under-tested?
3. What was explicitly deferred, and is each deferral still acceptable?
4. What was skipped by tests, docs, migration policy, or deployment procedure?
5. What improvements, additions, fixes, simplifications, or redundancies should
   be considered next without being implemented during the audit?

This is not a fix pass. Each auditor should write a report only.

## Scope

Audit these as source of truth:

- Root app source: `src/`
- Backend proxy source: `backend/ai-proxy/src/`
- Test suites: `src/**/__tests__/`, `backend/ai-proxy/src/__tests__/`,
  `tests/e2e/`
- Root config and deployment files: `package.json`, `package-lock.json`,
  `amplify.yml`, `amplify-rewrites.json`, `customHttp.yml`,
  `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig*.json`
- Active docs listed in `docs/README.md`
- Launcher entry points: `LANDroid.command`, `LANDroid.bat`

Treat these as generated or non-source unless a finding specifically requires
checking them:

- `node_modules/`
- `dist/`
- `dist-node/`
- `backend/ai-proxy/dist/`
- `backend/ai-proxy/lambda.zip`
- `playwright-report/`
- `test-results/`
- `tmp/`

Binary/PDF companion files under `TORS_Documents/` should be inventoried as
fixtures/artifacts, not audited line-by-line.

## Required Personas

Each report must explicitly cover these perspectives:

- Release captain: go/no-go for trusted test deployment.
- Land/title domain reviewer: Texas-only math, leasehold, NPRI, ORRI, source
  chain, and user workflow correctness.
- Math/invariant reviewer: fractions, graph/tree validity, recalculation,
  finite values, negative values, and cycle/parent safety.
- Frontend UX/accessibility reviewer: non-technical workflow clarity, responsive
  layout, keyboard/screen-reader basics, error and empty states.
- Persistence/migration reviewer: IndexedDB namespacing, import/export,
  autosave, legacy `default` data, cross-device expectations.
- AI safety/tooling reviewer: prompt/tool boundaries, rollback, read-only
  hosted mode, key handling, and provider failure modes.
- Cloud/security reviewer: Cognito, Lambda URL, DynamoDB usage limits, CORS,
  CSP, headers, secrets, and AWS deployment footguns.
- Test-quality reviewer: skipped e2e, fixture coverage, deterministic tests,
  missing regression coverage.
- Performance/maintainability reviewer: bundle size, worker use, graph scale,
  recomputation, duplicated/dead code.
- Documentation/handoff reviewer: whether docs, guides, continuation prompts,
  and user manual match the live system.
- Mapping/document-database reviewer: readiness for map assets, document
  database storage, PDF source packets, GIS/traverse export workflows, and
  evidence-to-map traceability.
- Product/roadmap reviewer: next-step opportunities, redundant UX or code,
  missing workflows, and whether proposed additions fit LANDroid's current
  priorities without creating scope creep.

Auditors may add more personas, but must not omit these.

If the tool supports subagents, multiple agents may be spawned for distinct,
bounded read-only audit slices. Suggested splits are:

- math/graph invariants
- AI/cloud/security
- persistence/import/export
- mapping/document database and GIS workflows
- frontend UX/accessibility
- docs/handoff/test coverage

The lead auditor remains responsible for deduplicating findings and producing
one coherent report.

## Evidence Rules

- Every factual claim must cite `file:line`.
- Findings must include severity, impact, evidence, reproduction or reasoning,
  and a minimal recommended next action.
- Passing claims also need evidence. Example: "Hosted unauthenticated AI calls
  reject with 401" must cite the smoke script lines and the command result.
- If a live/AWS fact cannot be verified from the repo, say so explicitly.
- Do not rely on old reports as truth. Use them as leads, then verify in source.

## Line-By-Line Requirement

"Line-by-line" means every in-scope source/config/doc file must be opened and
classified. The report does not need a comment for every harmless line, but it
must include:

- A file inventory showing `audited`, `generated skipped`, `binary/artifact
  skipped`, or `deferred`.
- Findings tied to exact lines.
- A "passed/deferred/skipped ledger" explaining what was accepted, what was not
  checked, and why.

## Future-Facing Opportunity Radar

In addition to defects, each report must include an opportunity backlog. Keep it
separate from confirmed findings so ideas do not get mistaken for bugs.

Include, at minimum:

- Improvements: small changes that increase correctness, confidence, workflow
  speed, clarity, or maintainability.
- Additions: feature ideas that fit the roadmap, with prerequisites and risks.
- Fixes: issues that are real but not urgent enough for the severity table.
- Redundancies: duplicate code, duplicate concepts, stale docs, repeated UI, or
  workflows that can be simplified.
- Mapping/document database: what should be designed before building durable
  map/document storage.
- AI PDF workflow: risks and likely architecture for uploading a PDF, detecting
  the correct workflow, extracting calls/metadata, and producing an ArcGIS
  traverse-compatible file.
- 3D Desk Map exploration: feasibility, UX value, technical options, and
  whether it should remain exploratory until the 2D auditability model is
  stronger.

For every opportunity, include:

- category
- evidence or source line that motivated it
- expected user value
- implementation risk
- suggested priority
- whether it belongs before or after the mapping/document-database workstream

## Output Reports

- Codex writes: `AUDIT_REPORT_CODEX_FULL_2026-05-14.md`
- Claude writes: `AUDIT_REPORT_CLAUDE_FULL_2026-05-14.md`

The reports should use this structure:

1. Executive verdict
2. Audit baseline and commands run
3. Persona-by-persona findings
4. Severity-ranked finding table
5. Passed controls
6. Deferred/skipped ledger
7. File inventory
8. Recommended next work order
9. Comparison-ready summary table

Do not modify application source during the audit.
