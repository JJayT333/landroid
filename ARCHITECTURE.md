# LANDroid Architecture

This file is the implementation map for engineers and AI coding agents. It
summarizes how the app is put together and where changes should live.

## Runtime Stack

- UI: React 18, TypeScript, Vite.
- Styling: Tailwind CSS.
- State: Zustand stores in `src/store`.
- Persistence: IndexedDB/Dexie helpers in `src/storage`, plus browser storage
  for selected local settings.
- Target storage planning: keep Dexie as the current runtime path, add
  workspace sharding before broad rebuild work, design records as
  backend-ready, and treat SQLite/OPFS, Tauri/native filesystem, backend object
  storage, or cloud object storage as explicit implementation gates, not
  current defaults.
- Runtime target: hosted web app first, with PWA/iPad support as a product
  target. Native iOS and desktop installers are deferred unless a later
  decision gate proves they are needed.
- Math: Decimal.js through `src/engine`.
- Graph/canvas: React Flow and ELK for flowchart layout.
- AI: Vercel AI SDK adapters in `src/ai`; Ollama is the default provider.
- Tests: Vitest and Playwright.

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

The current app remains the behavioral reference until Phase 0 inventory,
golden masters, and parity checks prove otherwise.

Target rebuild boundaries:

- Project record schema: normalized records for parties, aliases, tracts,
  documents, instruments, leases, units, wells, source attestations, curative
  issues, import sessions, action plans, action records, packets, and audit
  events. The ownership tree is graph-shaped, but the implementation target is
  records and projections, not a graph database.
- Evidence Vault: immutable originals, content hashes, document versions,
  vault objects, extraction runs, citation anchors, derivative OCR/text
  artifacts, and deterministic packet manifests. Search indexes and packet
  exports are rebuildable derivatives.
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
- Backend spine: after Phase 0, LANDroid has a decision gate for whether to add
  backend infrastructure. The current decision is backend-approved in
  principle, implementation deferred until OCR/search/sync or another hard
  trigger forces it. The backend supports sync, backup, object storage,
  background jobs, search, AI/RAG policy, audit logs, sharing, and future
  permissions while keeping local project semantics and `.landroid` export
  mandatory.

Target projections include Desk Map, Runsheet, Leasehold, Documents, Owners,
Curative, packet export, AI context, `OpinionDraft`, `ObligationCalendar`, and
`AbstractorPackage`.

Backend-ready rebuild records should carry stable IDs, `workspaceId` scoping,
`lastModified` / version metadata where needed, and content-hash references for
blob-backed evidence. This lets a later backend sync engine move intentional
records and action/audit data instead of reverse-engineering opaque workspace
snapshots.

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
directly. Add a stable `MathInputView` projection first, then compare its
outputs against existing golden masters before any cutover.

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

The approved-but-deferred backend should make sync, backup, jobs, search,
sharing, and AI policy more durable. It must not make the app unusable offline
for core workflows, and it must not make LANDroid unable to produce a complete
local project package.

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
