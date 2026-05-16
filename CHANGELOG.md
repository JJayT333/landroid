# LANDroid Changelog

This file records meaningful project changes so `CONTINUATION-PROMPT.md` can
stay short.

## 2026-05-16

- Implemented Phase 7A.5 document storage/registry reconciliation on
  `codex/document-storage-reconciliation-2026-05-16`: canonicalized document
  metadata around `area`, `sourceRef`, and structured `parties`, kept legacy
  field-name import/read compatibility, preserved file-path `externalRefs`,
  made `Needs OCR` count only explicit OCR-needed statuses, moved saved views
  into a left rail, enriched packet preview details, and strengthened helper,
  storage, and Playwright coverage.
- Added `IDEAS.md` as a lightweight brainstorming inbox and archived stale
  audit/prompt files under `docs/archive/` so the repo root stays focused on
  active guidance.
- Hardened the macOS ZIP launcher so `LANDroid.command` checks for Node/npm,
  installs npm dependencies on the first run from a fresh GitHub download, and
  keeps the Terminal window open with a clear error if startup fails.
- Built the Phase 7A document registry MVP on
  `codex/document-registry-build-2026-05-16`: added a `Documents` navigation
  surface, flat saved-view filters, editable document metadata, linked-node
  display, duplicate surfacing by `contentHash`, and a packet manifest preview
  from the current filter, selected/highlighted rows, or the
  `Runsheet / Mineral Title` view.
- Added `docs/document-database-roadmap.md` to pivot the next workstream from
  ArcGIS mapping toward a first-class LANDroid document registry, with Dropbox
  or local folders treated as optional raw-file vaults rather than the only
  database.
- Updated roadmap, security notes, docs map, README, and continuation handoff
  for Phase 7A: document library/index, metadata, duplicate surfacing, entity
  links, import manifests, OCR/text indexing, and cited read-only AI document
  query.

## 2026-05-15

- Completed Phase 5 document/PDF persistence on
  `claude/phase-5-document-refactor-2026-05-15`: Dexie v8 `documents` and
  `document_attachments`, node attachment summaries, workspace-store document
  actions, v8 `.landroid` export/import, v7 import migration, and a one-shot
  legacy-PDF backup hook.
- Replaced the old single-PDF Desk Map badge model with multi-document chips
  and a shared node-modal attachments section for add, open, rename, remove,
  and reorder.
- Seeded Raven Forest with realistic Texas multi-document examples on selected
  conveying nodes (deed, obituary, and affidavit of heirship), so the chip UI
  and browser tests exercise the new v8 path.
- Restored Phase 5 Playwright coverage: multi-document chip opening by
  `attachmentId`, v8 `.landroid` round-trip, branch-scoped lease deletion,
  curative linkage, research linkage, and the retargeted combinatorial demo
  chip workflow.
- Began Phase 6A UX cleanup by replacing app-level native `confirm()` /
  `alert()` calls with a shared LANDroid confirmation/alert modal, including
  Desk Map deletes, Clear Map, tract-tab deletes, owner deletes, map deletes,
  curative deletes, research deletes, federal leasing deletes, upload errors,
  and import errors.
- Continued Phase 6 UX/accessibility cleanup: workspace-replacing demo,
  `.landroid`, and CSV loads now require a typed confirmation phrase; Flowchart
  `Clear` uses the shared confirmation modal; and primary navigation, Desk Map
  tract tabs, owner tabs, Research sections, Federal Leasing tabs, and shared
  form controls expose clearer labels or active-state ARIA.
- Switched newly generated workspace IDs to `crypto.randomUUID()` while keeping
  the existing `ws-` prefix and a legacy fallback for runtimes without
  `randomUUID`.
- Hardened hosted IndexedDB keying so signed-out hosted state no longer falls
  back to the local `default` workspace/canvas rows; persistence unlocks only
  after a real Cognito `sub` is available.
- Removed the recurring AI settings unit-test local-storage warning by avoiding
  Node's warning-prone `globalThis.localStorage` probe outside browser contexts.
- Added `ARC_REVIEW_PROMPT.md` and expanded `docs/gis-data-catalog.md` with a
  design-only ArcGIS review scope for canonical layer mapping, stable IDs,
  attachment relationships, and import warnings.
- Tightened workspace persistence validation so warning-only title review states
  that LANDroid itself supports, such as temporary over/under allocation and
  orphan-style missing-parent review nodes, can round-trip through autosave and
  `.landroid` import while hard-invalid graphs still fail.

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
