# LANDroid Changelog

This file records meaningful project changes so `CONTINUATION-PROMPT.md` can
stay short.

## 2026-05-23

- Reconciled the Phase 0 planning track around `docs/phase-0-inventory.md` as
  the draft master behavior inventory, with cross-links from the rebuild plan,
  testing policy, roadmap, architecture, security notes, docs map, ADRs, and
  continuation handoff.
- Recorded the backend decision for rebuild planning: backend architecture is
  approved in principle, implementation is deferred until OCR/search/sync scale
  or another hard trigger, and Phase 0.5 through Phase 6 must stay local-first
  while using backend-ready record shapes.
- Added Phase 0.5 planning gates for sharded Dexie storage, multi-tab
  protection, autosave timing, canvas viewport persistence, PWA/iPad persistent
  storage, lazy PDF loading, and Raven Forest-scale validation on iPad-class
  hardware or a documented equivalent.
- Renamed the internal-only second demo fixture to Vulcan Mesa, updated current
  docs and tests to the new name, and archived the Phase 0 ultrareview prompt
  under `docs/archive/prompts/`.

## 2026-05-20

- Started audit remediation Phase 0: AI undo snapshot capture now fails closed
  if document workspace export fails, so approvals do not create empty document
  undo snapshots.
- Hardened `.landroid` import by rejecting files from future schema versions
  and applying side-store replacement before core workspace swap with rollback
  to the previous active side stores on replacement failure.
- Fixed focused Leasehold transfer-order rows so unit-scoped ORRI and WI
  records only appear for the focused tract's unit and only when included in
  math.
- Changed CSV row staging so ambiguous NPRI rows keep unknown fixed/floating or
  fixed-basis answers, show a `needs answer` state, and cannot create title
  nodes until the user answers.
- Added the next AI safety-foundation chunk: approved proposal results now land
  in an in-memory action/result journal, future local AI turns receive a concise
  journal context with exact created IDs and validation state, approval cards
  show structured tool-input details, and workspace replacement clears the
  transient journal.
- Added typed AI approval previews: proposed local AI edits now show
  before/after effects and graph-validation preview results before approval,
  and blocked previews cannot be approved or take rollback snapshots.
- Tightened the hosted AI proxy request policy so client-supplied OpenAI
  `tools` / `tool_choice` fields are rejected before usage charging or upstream
  forwarding. This keeps hosted chat read-only until a hosted approval/undo path
  is deliberately designed.
- Hardened map asset uploads with an explicit passive-file allowlist and PDF
  magic-byte validation before map PDFs are saved or previewed.

## 2026-05-19

- Replaced the signed-in PDF-only `Pitch Deck` tab with a native `Sales Deck`
  view: ten in-app status/sales slides, slide navigation, build-time Markdown
  status bullets from repo docs, and the existing bundled PDF/PPTX retained as a
  legacy reference section.
- Centralized workspace side-store replacement so demo loads, `.landroid`
  imports, and CSV imports consistently reset missing owner, document,
  curative, map, research, and transient AI approval/undo state instead of
  carrying stale side-section data forward.
- Tightened Desk Map cleanup so `Clear Map` and branch deletes remove owner and
  lease records only when those records were linked exclusively to deleted
  nodes, while preserving records still used by other tracts.
- Added a hosted AI read-only app context packet so signed-in hosted chat
  requests include the active view, project, unit/tract, visible Desk Map
  cards, linked lease summaries, and deterministic mineral coverage totals.
  This lets hosted chat answer questions about the current Desk Map without
  exposing local edit tools.
- Retired the stale tracked Vite asset `dist/assets/xlsx-CkFp8p6R.js`. That
  chunk was leftover generated output from the old `xlsx` parser path; the
  active CSV-only spreadsheet worker now builds without it, and `dist/` is not
  a source-of-truth directory.

## 2026-05-18

- Merged PR #72 into `main`, moved Amplify production to `main`, updated the
  existing Lambda AI proxy to Node.js 22, uploaded the fresh proxy bundle, and
  mapped `landroid.abstractmapping.com` to the `main` Amplify branch.
- Fixed hosted AI token recovery in PR #73 so the AI client can recover the
  Cognito ID token from OIDC storage and no longer sends anonymous proxy
  requests when the in-memory auth bridge is empty.
- Made the Demo Data menu visible in hosted mode for the signed-in POC so the
  Vulcan Mesa and Raven Forest fixtures can be loaded online.
- Added `DEPLOYMENT_STATE.md` and refreshed deployment docs so the current AWS
  setup is explicit: Amplify deploys frontend changes from `main`, while Lambda
  AI proxy changes still require a bundle/upload until deployment automation is
  added.
- Manual hosted browser verification confirmed the signed-in POC still loads
  Vulcan Mesa from the hosted Demo Data menu after PR #74. Hosted AI
  still accepted a `hello` request but stalled without an assistant response, so
  the current branch tightens hosted AI display/timeout behavior while leaving
  Lambda/CloudWatch follow-up open.
- Reworked the hosted AI frontend path to post directly to
  `/api/ai/chat/completions` with the Cognito ID token and parse the OpenAI SSE
  stream in-browser, bypassing the generic provider shim that hid stalled
  hosted requests. Added hosted-path tests for bearer headers, streamed deltas,
  missing tokens, and 401 session recovery.
- Fixed `Attach Related Document` so the Desk Map `ATTACH` action can create a
  related record and upload a PDF into the existing document registry in one
  flow.
- Moved formula popovers to fixed viewport positioning to avoid clipping and
  added a Desk Map `Formula Tray`: hover remains temporary, while clicking a
  formula pins it into a right-side comparison rail.
- Added the Desk Map unit-map reference panel idea to `ROADMAP.md`, anchored on
  uploading the main unit map through `Maps` before any true coordinate underlay
  work.
- Added a signed-in `Pitch Deck` tab with an inline PDF preview of
  `LANDroid-Features.pptx` and a PowerPoint download link. The original deck is
  bundled with a generated PDF companion because browser-native Office preview
  is not reliable without an external viewer or backend conversion service.
- Reworked Desk Map `Fit` so it measures the rendered visible tree/chain rather
  than the padded pan container, keeping the actual card layout centered when
  fitting a tract.
- Added a Leasehold `Overview` override review strip so NPRI branches, ORRI
  overrides, WI assignments, retained WI, and included/tracked record counts are
  visible before switching into Map or Deck mode.
- Added a Desk Map `Unit Map Reference` rail that previews the unit-linked or
  featured `Maps` asset as a collapsible side reference without attempting
  coordinate underlay. The rail labels whether the displayed map is unit-linked
  or a fallback asset.

## 2026-05-17

- Ran the main-readiness housecleaning audit on
  `claude/epic-hoover-48f4d0`, covering UX, landman workflow usefulness,
  engine correctness, architecture/persistence, hosted security, dependency
  audit state, AI behavior, and browser runtime smoke.
- Added `docs/archive/audits/MAIN_READINESS_AUDIT_2026-05-17.md` with
  prioritized blockers and cleanup sequence before treating the branch as a
  main candidate.
- Tightened one Playwright export/import workflow locator so the `Owners`
  navigation click remains exact after formula badges expose "Linked Owners" as
  role-button elements.
- Updated `CONTINUATION-PROMPT.md` to point at the actual current branch,
  latest validation, audit report, and next cleanup priorities.
- Began the main-readiness security cleanup by validating and normalizing stored
  PDF document blobs, rejecting hostile `.landroid` document payloads that do
  not contain PDF bytes, sandboxing PDF iframe previews, and applying shared
  upload allowlists/size limits to owner documents and Research imports.
- Removed the vulnerable production `xlsx` dependency by narrowing AI
  spreadsheet parsing to CSV, converting Runsheet export to CSV, and updating
  the related tests and docs.
- Updated the backend AWS SDK lockfile to clear the `fast-xml-builder`
  production audit issue, moved Lambda/local guidance to Node.js 22, and added
  GitHub Actions CI for root and AI-proxy install, audit, tests, and build.
- Scoped document attachment rows by `workspaceId`, added a Dexie v9 migration
  for existing attachment links, and made branch/tract document cascade cleanup
  use one storage transaction with visible `lastError` reporting on failure.
- Split document detach from global document delete: node-level remove actions
  now detach only the selected attachment link, and node/tract deletion only
  deletes document blobs that have no surviving attachment links.
- Tightened persisted data validation so malformed/negative `.landroid` node
  fraction fields and explicit unknown lease jurisdictions fail fast instead of
  being normalized into zero or Texas-fee math.
- Added an app-level AI approval queue: mutating AI tools now create pending
  proposals, user approval applies each batch, and every approved batch gets one
  undo snapshot.
- Labeled spreadsheet prompt rows as untrusted CSV data and added hostile-cell
  coverage so prompt-injection-like cells are treated as values.
- Added Desk Map auto-fit and a `Fit` canvas control so large trees recenter
  after load/import/tract switch or manual panning.

## 2026-05-16

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
