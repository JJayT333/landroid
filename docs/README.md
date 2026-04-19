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
| `USER_MANUAL.md` | User-facing app workflow guide. | User-visible behavior changes. |
| `LANDMAN-MATH-REFERENCE.md` | Landman-facing math formulas and conventions. | Calculation semantics or warning/blocking behavior changes. |
| `ROADMAP.md` | Short priority map. | Strategic priorities change. |
| `CHANGELOG.md` | Completed meaningful work. | A meaningful feature, fix, or docs rail lands. |
| `CONTINUATION-PROMPT.md` | Current short handoff. | Before switching chats or after meaningful work. |
| `AUDIT_REPORT.md` | Point-in-time adversarial audit snapshot. | Usually do not edit except to add status/snapshot notes. |
| `PATCH_PLAN.md` | Audit remediation status and sequence. | Remediation status changes. |

## Architecture Decision Records

ADRs live in `docs/adr`. Use them for decisions that future agents should not
re-litigate casually.

Current ADRs:

- `docs/adr/0001-local-first-browser-app.md`
- `docs/adr/0002-texas-only-active-math.md`
- `docs/adr/0003-ai-local-first-provider-policy.md`

## Architecture Notes

- `docs/architecture/rrc-import-readability.md`: RRC import/decode strategy.

## Archive

Files under `docs/archive` are historical. They may explain why older choices
were made, but they are not current implementation guidance unless an active doc
explicitly says so.
