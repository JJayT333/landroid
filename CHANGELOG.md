# LANDroid Changelog

This file records meaningful project changes so `CONTINUATION-PROMPT.md` can
stay short.

## 2026-05-14

- Deployed the trusted test POC to `https://landroid.abstractmapping.com` via
  Amplify, Lambda Function URL rewrites, Cognito, and DynamoDB-backed AI usage
  tracking; hosted smoke checks passed after custom-domain activation.
- Added parallel full-audit coordination docs and paste-ready prompts for Codex
  and Claude Code so both tools can audit the same baseline independently and
  write comparison-ready reports.
- Began hosted hardening implementation: frontend Cognito auth now derives the
  user-pool issuer/metadata from `VITE_COGNITO_USER_POOL_ID` while keeping
  Hosted UI auth endpoints, CSP allows the Cognito issuer host, hosted smoke
  checks verify metadata plus JWKS, and the AI proxy now caps request bodies,
  parses JSON before usage tracking, allowlists forwarded OpenAI-compatible
  fields, and maps upstream provider auth failures to proxy errors.
- Continued hosted hardening: hosted mode now hides the Demo Data loader, and AI
  tool policy now separates undo-mutating tools from hosted-blocked tools so
  `setActiveDeskMap` remains undo-neutral locally but is not exposed in hosted
  read-only mode.
- Continued the hosted hardening track with leasehold strict parsing: imported
  or legacy malformed lease royalty, ORRI burden, and WI assignment fractions
  now surface as leasehold input warnings and are treated as 0 instead of being
  silently coerced or clamped.
- Began Phase 4 browser coverage restoration by retargeting the leasehold/PDF
  branch-awareness Playwright workflow to the current 10-tract Raven Forest
  combinatorial fixture.
- Deferred the remaining four skipped PDF/export/import/fixture-heavy Playwright
  workflows until after the document/PDF persistence refactor and fixture
  retargeting, so the hosted-hardening branch can be checkpointed cleanly.
- Expanded the audit brief to capture improvement ideas, additions, fixes,
  redundancies, mapping/document database readiness, AI PDF-to-ArcGIS-traverse
  workflow planning, and possible 3D Desk Map exploration as a separate
  opportunity backlog.

## 2026-05-10

- Added the second-opinion audit verification report for the pre-AWS remediation
  branch, with per-finding verdicts and deployment-risk caveats.
- Hardened the follow-up audit fixes: added attach-invariant edge coverage,
  persistence DB-key coverage for Cognito-sub namespacing, and Lambda proxy
  handler tests for Cognito JWT rejection plus streamed OpenAI forwarding.
- Updated hosted deployment docs so `npm run bundle` is the supported Lambda
  packaging path, stale zips are called out as crash-prone, DynamoDB usage
  tracking is required before invited hosted use, and legacy `default` IndexedDB
  data requires manual export/import instead of automatic migration.
- Made the AI proxy fail fast when `USAGE_TABLE_NAME` is missing unless the
  explicit local-only `ALLOW_IN_MEMORY_USAGE_STORE=true` escape hatch is set.
- Added `DEPLOY_TEST_CHECKLIST.md`, `npm run deploy:check`, and rewrite-render
  helper scripts so the pre-AWS branch can be checked locally before touching
  AWS console settings.
- Corrected the hosted smoke test to check Cognito JWKS at the user-pool issuer
  URL instead of the Hosted UI domain.

## 2026-04-21

- Added `DEPLOYMENT_PLAN.md`, a staged AWS-hosted rollout plan covering secure
  frontend hosting, Cognito auth, App Runner backend, S3/RDS persistence,
  server-side AI proxying, provider strategy (OpenAI / Anthropic / Bedrock),
  and go-live security controls.

## 2026-04-20

- Added project-scale unit focus for Raven Forest Unit A/B and future units:
  Leasehold and Owners now switch by active unit, new units can be created from
  the selector, and unit-wide ORRI/WI records carry a unit code so A/B math
  stays separated.
- Added a confirmed `Clear Map` Desk Map action that empties the active tract,
  removes cleared node artifacts, preserves other tracts, and avoids deleting
  node records still shared with another Desk Map.
- Improved spreadsheet row staging against the Elmore DOTO workbook format:
  tract-tab detection, gross-acre extraction, safer Grantor/Grantee header
  mapping, DOTO ownership-row inheritance, and simple title-interest expression
  parsing.
- Added per-sheet Desk Map targeting in workbook row review, including a
  `Create missing tracts` action before root-node creation.
- Reused the workspace Instrument dropdown in workbook row review so imported
  instrument types can be added to the persisted type list.

## 2026-04-19

- Created `AUDIT_REPORT.md` and `PATCH_PLAN.md`.
- Hardened AI rollback snapshots so mutating AI tool activity snapshots before
  live changes and includes node PDF workspace data.
- Added AI cancel/status UX and provider timeouts.
- Made OpenAI/Anthropic keys session-only and stripped old persisted cloud-key
  fields from AI settings.
- Enforced Texas-only active lease math gates for Desk Map/Leasehold consumers
  and lease attachment paths.
- Tightened AI lease creation with strict royalty/leased-interest parsing and
  `tx_fee` / `tx_state` jurisdiction limits.
- Improved Desk Map over-100 mineral coverage visibility by listing current
  mineral contributors.
- Added first-pass spreadsheet `Review rows` workflow for row-by-row editable
  node staging, parent suggestions, create-root, attach, and skip.
- Added professional docs rails: architecture, testing, security, roadmap,
  changelog, docs map, and core ADRs.
