# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and
`DEPLOYMENT_STATE.md` before touching code. Keep long history in
`CHANGELOG.md`.

## Current Branch

Current checked-out branch:
`codex/audit-pass-a-2026-05-20`.

Do not commit directly to `main` unless the user explicitly asks for a direct
main push/deploy.

## Current Workstream

AI/security/structure/performance audit pass is complete as a report artifact.
No product behavior has been changed.

Primary report:

- `docs/archive/audits/AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`

The report is Pass A for comparison against a second independent audit. It maps
local AI, hosted AI, CSV/runsheet import, document upload/registry,
`.landroid` import/export, leasehold/Desk Map math, frontend performance, CI,
docs, and MCP relevance.

## Latest Validation

Commands run on this branch:

- `git diff --check` - passed.
- `npm run deploy:check` - passed. Expected Amplify rewrite template placeholder
  warning remained.
- `npm audit --omit=dev` - passed with 0 vulnerabilities after approved network
  access; the sandboxed first run failed DNS lookup.
- `npm --prefix backend/ai-proxy audit --omit=dev` - passed with 0
  vulnerabilities after approved network access; the sandboxed first run failed
  DNS lookup.
- `npm run lint` - passed.
- `npm test -- src/ai src/storage src/store src/components/leasehold src/components/deskmap`
  - passed, 34 files / 249 tests. Existing intentional stderr coverage for
  simulated Dexie failures appeared.
- `npm test` - passed, 74 files / 609 tests. Existing intentional stderr
  coverage for simulated Dexie failures appeared.
- `npm --prefix backend/ai-proxy test` - passed, 3 files / 38 tests.
- `npm --prefix backend/ai-proxy run build` - passed.
- `npm run build` - passed with existing Vite dynamic/static import warnings,
  chunk-size warning, and Node `module.register()` deprecation warning.
- `npm run test:e2e` - passed, 11 Playwright tests.

## Top Findings To Carry Forward

- P1: AI undo currently catches document export failure and snapshots empty
  document data. Fix this before AI document/import mutation work.
- P1: Approved AI tool outputs are not fed back into future model context,
  making chained AI workflows fragile.
- P1: AI approval cards need structured diffs and validation previews before
  beginner-safe title/math edits.
- P1: The desired runsheet assistant is not built end to end. Current pieces
  parse/stage rows or create desk maps, but not the full guided import,
  question, attachment, owner, lease, and graph workflow.
- P1: `.landroid` import can leave mixed/stale state if side-store replacement
  fails after loading the core workspace.
- P1: Focused leasehold decimal rows need multi-unit ORRI/WI filtering tests and
  a fix.
- P2: Hosted AI proxy policy is broader than current hosted UI needs and should
  reject client-supplied tool schemas until hosted tools are deliberately
  designed.
- P2: Map uploads should use the same explicit allowlist and PDF magic-byte
  validation posture as document uploads.

## Open Risks And Assumptions

- This branch contains a docs/report change only; no code remediation has been
  implemented yet.
- Networked npm audits required approved network access because the sandbox could
  not resolve `registry.npmjs.org`.
- The next phase should start with AI safety foundation work, not MCP or a broad
  feature rewrite.
- MCP servers are relevant later for external systems such as county records,
  OCR, GIS, storage vaults, or backend-only connectors, but should not bypass
  LANDroid approval/undo/audit boundaries.

## Likely Next Steps

- Compare this Pass A report with the second audit when available.
- Convert overlapping findings into a small remediation plan.
- Start with the safest AI foundation fixes:
  - make undo snapshot capture fail closed,
  - add an AI action/result journal,
  - design typed approval diffs,
  - stop defaulting ambiguous NPRI rows,
  - define a structured runsheet import-session model.
- Then harden `.landroid` side-store replacement, map uploads, attachment
  workspace scoping, focused leasehold ORRI/WI filtering, and hosted proxy
  request policy.

## Paste-Ready Next Chat Prompt

Resume in `/Users/abstractmapping/projects/landroid` on
`codex/audit-pass-a-2026-05-20`. Read `AGENTS.md`, `PROJECT_CONTEXT.md`,
`docs/README.md`, `DEPLOYMENT_STATE.md`, and `CONTINUATION-PROMPT.md` first.
The current artifact is
`docs/archive/audits/AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`, an audit-only
Pass A covering AI, security, structure, performance, documents, hosted proxy,
CI, and MCP relevance. Do not implement broad features yet. First compare this
audit with the second audit when provided, then build a small remediation plan
starting with the AI undo fail-closed fix, AI action/result journal, typed
approval diffs, and structured runsheet import-session model.
