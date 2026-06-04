# LANDroid Architecture

This file is the implementation map for engineers and AI coding agents. It
summarizes how the app is put together and where changes should live.

## Runtime Stack

- UI: React 18, TypeScript, Vite.
- Styling: Tailwind CSS.
- State: Zustand stores in `src/store`.
- Persistence: IndexedDB/Dexie helpers in `src/storage`, plus browser storage
  for selected local settings.
- Target storage planning: keep Dexie as the current runtime path, add a
  minimal backend spine before workspace sharding, shard workspace data around
  backend-shaped records, and treat SQLite/OPFS, Tauri/native filesystem,
  backend object storage, or cloud object storage as explicit implementation
  gates, not current defaults.
- Phase 0.5 storage scaffolding: `src/storage/workspace-shards.ts` defines the
  pure adapter from current `WorkspaceData` into backend-spine manifest and
  Desk Map envelopes plus local-only compatibility rows. `src/storage/db.ts`
  now registers the v10 shard/write-lease tables and populates shard rows from
  existing monolithic workspace rows during upgrade. Live workspace load now
  reads complete shard rows first through `src/storage/workspace-shard-reader.ts`
  and falls back to `workspaces.data` with a startup warning when shards are
  incomplete/corrupt. Autosave still writes `workspaces.data` until the shard
  writer and write-lock gate land. `src/storage/workspace-write-lock.ts`
  defines the pure single-writer lease decision contract for the later
  multi-tab write gate. `src/storage/workspace-shard-migration.ts` defines the
  pure monolith-to-shards and shards-to-monolith rollback helpers.
- Runtime target: hosted web app first, with PWA/iPad support as a product
  target. Native iOS and desktop installers are deferred unless a later
  decision gate proves they are needed.
- Math: Decimal.js through `src/engine`.
- Graph/canvas: React Flow and ELK for flowchart layout.
- AI: Vercel AI SDK adapters in `src/ai`; Ollama is the default provider.
- Tests: Vitest and Playwright.

## Operating posture - Rebuild-first

As of 2026-06-04, LANDroid is in active rebuild with a single operator and no
production users. Priority is correct architecture, not continuous runnability;
temporary breakage during a rebuild step is acceptable. Safety comes from
reversibility and validation, not from preserving live behavior at every step.
Required of every change: branch isolation with revertible commits; `.landroid`
export/import is the escape hatch and no destructive migration ships without a
backup plus documented recovery; no math/precision change without the Phase 0
golden masters; `MathInputView` parity and `.landroid` round-trip stay green or
are updated deliberately and reviewably; no real-data or `scripts/springhill/`
leakage; no hidden behavior changes; name behavior changes and update the
relevant source-of-truth doc; no speculative features added just because
breakage is cheap. The action/record layer becoming the canonical read source,
the read-flip, is now a near-term designed gate, not deferred. This supersedes
prior additive, snapshot-first, or keep-live-behavior guidance where they
conflict.

## Entrypoints

- `src/main.tsx`: app bootstrap, IndexedDB hydration, autosave subscriptions,
  and root render.
- `src/App.tsx`: top-level app shell and view switching.
- `src/components/shared/Navbar.tsx`: file actions, demo loading, navigation,
  and project-name editing.
- `src/views/DocumentsView.tsx`: Phase 7A document registry surface over the
  local document tables.
- `src/views/PitchDeckView.tsx`: signed-in Sales Deck surface. The route keeps
  the historical `pitch` view id, but the user-facing tab now opens native
  LANDroid status/sales slides before the legacy PDF/PPTX reference deck.

## State Ownership

- `workspace-store`: Desk Map nodes, tract/DeskMap records, active unit focus,
  leasehold review records, active tract, instrument types, graph mutations,
  and lease-node sync.
- `owner-store`: owner records, owner contacts, owner documents, and owner lease
  records.
- `research-store`: research sources, formulas, project records, questions, and
  imported RRC/source files.
- `curative-store`: title issues and curative tracking.
- `map-store`: map assets, regions, external references, and map links.
  Upload validation/preparation for map assets lives in
  `src/maps/map-asset-upload.ts`; it reuses shared file-size/extension helpers
  and PDF magic-byte validation before records enter `map-store`.
- `canvas-store`: flowchart nodes, edges, viewport, and print/layout settings.
- `ai/settings-store`: AI provider/model settings; cloud keys are session-only.
- `ai/undo-store`: latest AI rollback snapshot.
- Document blobs and workspace-scoped entity links are persisted through
  `src/storage/document-store.ts`. `documents` stores the blob/metadata and
  `document_attachments` stores scoped links to nodes, owners, leases,
  curative records, or research records.
  UI remove actions detach link rows without deleting the underlying document.
  Node/tract deletes remove the affected attachment links and only delete a
  document blob when no surviving entity links remain.
  Registry filtering, duplicate surfacing, linked-entity summaries, and packet
  manifest previews live in pure helpers under `src/documents`.

## Target Rebuild Boundaries

The current app remains the behavioral reference for invariants, goldens, and
reviewable comparisons; it is no longer a continuity constraint for every
intermediate rebuild branch. A workflow may move to the action/record layer when
its parity, round-trip recovery, and revert gates are proven.

Target rebuild boundaries:

- Project record schema: normalized records for parties, aliases, tracts,
  documents, instruments, leases, units, wells, source attestations, curative
  issues, import sessions, action plans, action records, packets, and audit
  events. The ownership tree is graph-shaped, but the implementation target is
  records and projections, not a graph database. Phase 1 record body schemas now
  live in `src/backend-spine/contracts.ts`; pure workspace-to-record adapters,
  record-bundle validation, `MathInputView`, `OpinionDraft`,
  `ObligationCalendar`, `AbstractorPackage`, evidence-vault/packet export
  adapters, AI context, and citation-verifier contracts live under
  `src/project-records`. Earlier slices built these helpers as read-side and
  additive. Under rebuild-first, later governed cutovers may make specific
  projections canonical after parity, recovery, and revert gates pass.
- Evidence Vault: immutable originals, content hashes, document versions,
  vault objects, extraction runs, citation anchors, derivative OCR/text
  artifacts, and deterministic packet manifests. The current evidence-vault
  adapter projects registry documents, owner documents, map assets, and
  research imports into shared `document` / `document_link` / `vault_object`
  records without changing v8 `.landroid` or Dexie side-store authority. The
  OCR/text citation foundation adds `extraction_run` records, separate
  selectable-PDF text versus scanned-PDF OCR modes, derivative vault-object
  kinds, and page/span/polygon citation anchors through pure project-record
  helpers only. No OCR subprocess, cloud OCR upload, store migration, or
  `.landroid` format change is wired yet. Search indexes and packet exports are
  rebuildable derivatives.
- Import sessions: uploads become immutable source packages, source rows,
  source excerpts, staged candidates, and Phase 1 `ActionPlan` dry-run previews
  before approval. Phase 3 supports recurring runsheet packages,
  title-opinion-as-root `SourceAttestation` drafts, candidate confidence plus
  blocking questions, side-by-side OCR/text review when Phase 2.5 text records
  exist, and batch approval into typed action drafts. It remains
  project-record-only: approved candidates can create source citations and
  citation anchors, but do not apply instruments, interests, leases, tracts,
  live Zustand writes, or `.landroid` format changes.
- Action layer: typed `ActionPlan` previews and durable `ActionRecord`s over
  records. Meaningful approved changes should also be able to produce
  append-only audit events with hash continuity.
- Math input view: `math-engine.ts` should continue to consume a stable
  `MathInputView` projection rather than raw rebuild records. This insulates
  Texas math semantics from storage/schema churn.
- Citation verifier: AI answers and document-derived claims need a structural
  verifier that rejects unsupported claims before display. Pre-OCR answers may
  cite structured records and source attestations, but not nonexistent document
  text spans.
- Runtime adapters: blob storage, OCR job dispatch, AI inference, and hosted
  persistence should have adapter boundaries before any backend/cloud or Tauri
  pivot becomes the source of truth.
- Backend spine: Phase 0.75 adds the minimal backend contract before Phase 0.5
  sharding. The current scope is shared record/API schemas, a record envelope,
  local/hosted adapter boundaries, Cognito-backed session proof, and
  health/record-validation endpoints. The app also runs a non-user-facing
  startup contract check through the adapter after local startup or hosted auth;
  it sends health, session, and a synthetic project-record validation probe only and
  does not block local workflows. Durable server project storage, object
  storage, OCR/search jobs, sync, sharing, collaboration, and future
  permissions remain later gates. Local project semantics and complete
  `.landroid` export stay mandatory. Implementation files are
  `src/backend-spine/contracts.ts`, `src/backend-spine/adapter.ts`,
  `src/backend-spine/app-contract-check.ts`, `backend/spine/src/handler.ts`,
  and `backend/spine/src/lambda.ts`. Hosted routing is prepared via
  `/api/spine/<*>` Amplify rewrites to a separate `landroid-backend-spine`
  Lambda Function URL.

Target projections include Desk Map, Runsheet, Leasehold, Documents, Owners,
Curative, packet export, AI context, `OpinionDraft`, `ObligationCalendar`, and
`AbstractorPackage`.

Backend-shaped rebuild records should carry stable IDs, `workspaceId` and
`projectId` scoping, `lastModified` / version metadata where needed,
revision/tombstone hooks for future sync, and content-hash references for
blob-backed evidence. This lets Phase 0.5 sharding and a later backend sync
engine move intentional records and action/audit data instead of
reverse-engineering opaque workspace snapshots.

## Data Flow

Normal app edits follow this path:

1. User action in a view or modal.
2. Component calls a Zustand store action.
3. Store action delegates math, validation, normalization, or persistence helper
   work as needed.
4. Store state updates.
5. Autosave writes workspace/canvas/side-store data to IndexedDB.
6. Views re-render from store state or derived selectors.

Avoid writing business rules directly into UI components when a store action,
engine helper, or typed utility already owns the behavior.

Workspace-replacing flows use `src/storage/workspace-side-store-reset.ts` to
replace every side store in one pass. Demo loads and CSV imports pass empty
side-store data, while `.landroid` imports pass the file payload and default
missing sections to empty. That reset also clears transient AI approval and undo
state so stale proposals cannot apply against a replaced workspace.

Tract-level Desk Map clearing remains scoped to the active Desk Map. It removes
deleted node artifacts from document, map, and curative stores, then removes
owner/lease records only when those records are not still linked by surviving
nodes in another tract.

The Sales Deck content helper in `src/sales-deck/sales-deck-content.ts` imports
repo Markdown snapshots with Vite `?raw` imports at build time. Static slide
copy lives beside the helper, while status-oriented bullets are extracted from
`CHANGELOG.md`, `DEPLOYMENT_STATE.md`, `ROADMAP.md`, and
`CONTINUATION-PROMPT.md`. This keeps the deck in-app and easy to refresh
without adding a backend or new dependency.

## Math Boundary

Core title-tree mutation math belongs in `src/engine/math-engine.ts`.
Domain-specific derived review math belongs in focused helpers such as:

- `src/components/deskmap/deskmap-coverage.ts`
- `src/components/leasehold/leasehold-summary.ts`
- `src/engine/tree-layout.ts`

UI components should display and collect inputs; they should not duplicate the
calculation rules.

During rebuild work, do not make the math engine consume new domain records
directly. Add or preserve a stable `MathInputView` projection first, then
compare its outputs against existing golden masters before any cutover. If a
math behavior change is intentional, update the goldens deliberately and name
the domain decision in the relevant docs.

The current `MathInputView` projection is implemented behind
`src/project-records/projections.ts`. It reuses the existing Leasehold and Desk
Map math helpers, records dual decimal/fraction displays, carries warning-only
states, and makes Texas/federal/private lease isolation a projection
precondition without changing live UI behavior.

## Persistence Boundary

Persistence helpers live under `src/storage`. Import paths must treat external
files as untrusted input.

Current persistence is browser-local and local-first remains a product
invariant. Planned storage changes must follow the staged trajectory in
`docs/rebuild-plan.md`:

1. Shard current workspace persistence inside Dexie.
2. Keep `.landroid` snapshots/packages loadable with migration/backup rules.
3. Add multi-tab protection, persistent-storage requests for PWA/iPad where
   supported, lazy document/PDF blob loading, and measured Raven Forest-scale
   behavior before calling Phase 0.5 complete.
4. Evaluate SQLite/OPFS only after query/search needs justify it.
5. Consider Tauri/native filesystem only when local OCR process control,
   Finder-visible project packages, native SQLite, or corpus size forces it.

Document originals, checksums, and source metadata are canonical. OCR text,
embeddings, FTS rows, page images, and packet exports are derived artifacts that
must be rebuildable from the canonical vault state.

The minimal Phase 0.75 backend spine should make the record/API contract
explicit before Dexie sharding. Later backend expansion should make sync,
backup, jobs, search, sharing, and AI policy more durable. Neither the spine nor
later expansion may make the app unusable offline for core workflows, and
neither may make LANDroid unable to produce a complete local project package.

The project-record `.landroid` migration strategy is documented in
`docs/project-record-migration-strategy.md`. v9 is the first record-bearing
package format: manual save can include a validated title action/audit ledger
under `actionLedger`. The v9 snapshot-authoritative import rule remains the
current file-format behavior, but rebuild-first supersedes treating that as a
permanent architecture rule. A future read-flip may make action-derived records
canonical after runtime persistence, parity, round-trip, and revert gates pass.

Phase 0.5 planning treats the current storage surface as follows:

- the primary shard target is `workspaces.data`, which currently stores
  `WorkspaceData` as one JSON string (`nodes`, `deskMaps`, leasehold arrays,
  active IDs, and `instrumentTypes`)
- `canvases.data` is a separate JSON blob and must keep Flowchart parity while
  proving viewport persistence
- side stores such as owners, leases, maps, research, curative issues,
  documents, and document attachments already live in separate Dexie tables and
  should not be rewritten in the first shard unless they are needed for
  envelope metadata, lazy blob loading, or lock coverage
- sharded rows should carry or derive the Phase 0.75 envelope metadata; current
  title-node rows may remain local-only compatibility payloads until Phase 1
  defines the final `InstrumentRecord` / `InterestReference` split
- `.landroid` export/import remains the compatibility boundary, so local Dexie
  sharding must assemble and read the existing package shape before any package
  version bump is considered
- pessimistic single-writer protection and metadata-first blob loading are
  Phase 0.5 acceptance gates, not later backend features

Generated folders are not source of truth:

- `dist/`
- `dist-node/`
- `playwright-report/`
- `test-results/`

## AI Boundary

The AI layer lives under `src/ai`.

- Prompt text and provider calls: `src/ai/system-prompt.ts`, `src/ai/client.ts`,
  `src/ai/runChat.ts`.
- Tool definitions: `src/ai/tools.ts`.
- Approval queue: `src/ai/approval-store.ts`.
- Typed approval previews: `src/ai/approval-preview.ts`.
- Action/result journal and model-context formatter:
  `src/ai/action-journal.ts`, `src/ai/chat-context.ts`.
- Undo snapshots: `src/ai/undo-store.ts`.
- Settings: `src/ai/settings-store.ts`.
- Workbook staging: `src/ai/wizard`.

Current policy:

- Ollama is the preferred default.
- OpenAI/Anthropic keys are session-only in browser memory.
- AI mutating tools create pending approval proposals. The AI panel is the
  human approval gate; approving a proposal applies that batch and captures one
  rollback snapshot. Proposal cards include typed before/after previews and
  graph-validation previews built from the current store state; proposals with
  blocked previews cannot be approved. Approved proposal results are recorded
  in an in-memory action/result journal and prepended to later local AI turns as
  concise context so follow-up tool calls can reuse exact created IDs and
  validation results.
- Workspace replacement clears AI proposals, the action/result journal, and the
  undo snapshot so stale AI state cannot target a replaced workspace.
- Spreadsheet import should prefer deterministic row staging and user review
  over blind bulk mutation.

Target AI evidence policy:

- AI document-text claims are disabled until OCR/text extraction creates
  citation anchors.
- Every displayed answer should pass a `CitationVerifier` boundary. Material
  claims must trace to a source citation, record ID, deterministic math result,
  approved action record, or explicit curative issue.
- Document-text citations with an `extractionRunId` must also have a successful
  or partial extraction run, at least one derivative vault object, and a page
  plus character-span anchor before the verifier treats them as supported.
- Retrieval should be hybrid: exact/keyword search, vector recall, record
  traversal tools, deterministic math tools, and rank fusion before answer
  generation.
- Suggested next actions must be typed `ActionPlan` proposals or navigation
  hints, not ungrounded prose commands.

Future policy work is tracked in `PATCH_PLAN.md`.

## Domain Boundaries

- Desk Map is the title-tree source of truth.
- Owners is the owner/lease record source of truth.
- Documents is the first-class registry for saved workspace document records.
  Runsheet document review is a saved mineral-title view over that registry,
  not a separate storage model.
- Leasehold consumes Desk Map and Owners data for review outputs.
- Unit focus is driven by Desk Map `unitCode` / `unitName` fields. Leasehold
  filters its tract set by active unit, and unit-wide ORRI/WI records carry a
  `unitCode` so multi-unit projects do not blend payout math across units.
- Federal Leasing and Research may store federal/private reference records, but
  those records must not affect active Texas math.
- NPRI, ORRI, mineral ownership, leases, assignments, and curative issues are
  separate concepts. Do not collapse them into one record type for convenience.

## Adding New Work

Before changing architecture:

1. Read `AGENTS.md`.
2. Read `PROJECT_CONTEXT.md`.
3. Check this file for ownership boundaries.
4. Check `ROADMAP.md` and `CONTINUATION-PROMPT.md` for current priority.
5. Add or update an ADR under `docs/adr` if the decision changes a long-lived
   boundary.
