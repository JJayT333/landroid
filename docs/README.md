# LANDroid Documentation Map

Use this map to decide which Markdown file to read or update.

## Active Root Docs

| File | Job | Update When |
| --- | --- | --- |
| `AGENTS.md` | Stable rules for AI coding agents. | Repo workflow rules change. |
| `PROJECT_CONTEXT.md` | Domain, scope, and architecture invariants. | A long-lived product/domain boundary changes. |
| `README.md` | Fast repo onboarding and validation entrypoint. | Setup, validation, or current surface list changes. |
| `ARCHITECTURE.md` | Implementation map and module ownership. | Entrypoints, store ownership, data flow, or boundaries change. |
| `TESTING.md` | Validation command selection and known warnings. | Tests, fixtures, skipped e2e status, or validation policy changes. |
| `SECURITY.md` | Security model, AI key policy, and import risk notes. | Provider, hosting, upload, or secret-handling posture changes. |
| `DEPLOYMENT_GUIDE.md` | Step-by-step AWS POC deployment instructions. | Console steps, AWS resource names, hosted env vars, or smoke-test instructions change. |
| `DEPLOYMENT_STATE.md` | Current hosted AWS resource map and deploy behavior. | Amplify branch/domain, Lambda URL/runtime, Cognito IDs, DynamoDB table, or deploy automation changes. |
| `DEPLOY_TEST_CHECKLIST.md` | Operational preflight and go/no-go checklist for the test deploy. | Test-deploy sequencing, AWS readiness gates, or stop conditions change. |
| `USER_MANUAL.md` | User-facing app workflow guide. | User-visible behavior changes. |
| `LANDMAN-MATH-REFERENCE.md` | Landman-facing math formulas and conventions. | Calculation semantics or warning/blocking behavior changes. |
| `ROADMAP.md` | Short priority map. | Strategic priorities change. |
| `IDEAS.md` | Low-friction idea inbox and brainstorming parking lot. | A new idea is worth remembering but is not yet approved roadmap scope. |
| `docs/rebuild-plan.md` | Incremental rebuild source of truth: project record schema, evidence vault, source attestations, import/action layers, inventory gates, storage trajectory, and phase order. | Rebuild scope, phase gates, or long-lived migration strategy changes. |
| `docs/phase-0-inventory.md` | Draft master Phase 0 behavior inventory: lane rows, cross-lane contracts, coverage gaps, reference fixtures, golden-master plan, and performance baselines. | Phase 0 inventory rows, fixture plans, or baseline/gap status change. |
| `docs/phase-0-manual-smoke-checks.md` | Phase 0 manual smoke-check runbook for current app workflows before rebuild implementation. | Manual smoke lanes, stop conditions, or evidence-capture policy changes. |
| `docs/backend-spine-threat-model.md` | Phase 0.75 minimal backend-spine threat-model note. | Backend-spine assets, boundaries, controls, or validation gates change. |
| `docs/project-record-migration-strategy.md` | `.landroid` migration strategy for future project-record bundles. | Project records are written into packages or file-version dispatch changes. |
| `docs/phase-1-record-schema-notes.md` | Phase 1 additive-record implementation assumptions and reviewer notes. | Phase 1 assumptions, adapter scope, or projection guardrails change. |
| `docs/phase-3-import-session-notes.md` | Phase 3 import-session assumptions, exit-gate evidence, and review questions. | Import-session staging, approval, rejection, or source-review guardrails change. |
| `docs/springhill-sample-workflow.md` | Private-source to scrubbed-public-sample workflow for the Dr. Elmore Springhill `.landroid` sample. | Springhill generator inputs, scrub policy, source-to-output gates, or sample validation rules change. |
| `docs/title-tree-read-cutover.md` | Title read-flip Scope A/B design and revert recipe. | Cutover gates, rollback rule, or read-path governance changes. |
| `docs/deep-audit-2026-06-10.md` | 2026-06-10 deep audit: severity-ranked findings (DA-*), precision policy, Texas gap matrix, doc/AI assessments. | Archive once its findings are reconciled into `docs/audit-backlog.md` and fixed or accepted. |
| `docs/title-math-research-prompt.md` | Paste-ready external research prompt for the complete Texas title-math/law catalog feeding the Phase 7 design pass. | Archive to `docs/archive/prompts/` when the research corpus is delivered. |
| `CHANGELOG.md` | Completed meaningful work. | A meaningful feature, fix, or docs rail lands. |
| `CONTINUATION-PROMPT.md` | Current short handoff. | Before switching chats or after meaningful work. |

## Architecture Decision Records

ADRs live in `docs/adr`. Use them for decisions that future agents should not
re-litigate casually.

Current ADRs:

- `docs/adr/0001-local-first-browser-app.md`
- `docs/adr/0002-texas-only-active-math.md`
- `docs/adr/0003-ai-local-first-provider-policy.md`
- `docs/adr/0004-multi-doc-per-entity-persistence.md`
- `docs/adr/0005-storage-format-trajectory.md`
- `docs/adr/0006-ai-citation-verification-contract.md`
- `docs/adr/0007-action-layer-and-audit-schema.md`
- `docs/adr/0008-backend-spine-decision-gate.md`

## Architecture Notes

- `docs/architecture/rrc-import-readability.md`: RRC import/decode strategy.
- `docs/document-database-roadmap.md`: Phase 7 document registry, OCR/search,
  storage-vault, and AI-query direction.
- `docs/gis-data-catalog.md`: Local Raven Forest GIS package inventory and
  import-readiness notes.

## Archive

Files under `docs/archive` are historical. They may explain why older choices
were made, but they are not current implementation guidance unless an active doc
explicitly says so.

- `docs/archive/audits/`: point-in-time audit reports and verification reports.
- `docs/archive/prompts/`: paste-ready prompts and coordination briefs for
  completed or paused external/parallel review workstreams.
- `docs/archive/2026/PATCH_PLAN_2026-04-19.md`: historical remediation plan
  superseded by `docs/audit-backlog.md` and current validation docs.
- `docs/archive/2026/DEPLOYMENT_PLAN_2026-04-21.md`: pre-deploy hosted rollout
  plan; superseded by the live deployment (`DEPLOYMENT_STATE.md` is current
  truth, `DEPLOYMENT_GUIDE.md` the how-to).
- `docs/archive/prompts/audit-sheet-export-brief.md`: paste-ready feature brief
  for the per-tract printable Audit Sheet export (not yet built; pointer lives
  in `ROADMAP.md`).
