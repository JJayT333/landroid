# LANDroid Architecture

This file is the implementation map for engineers and AI coding agents. It
summarizes how the app is put together and where changes should live.

## Runtime Stack

- UI: React 18, TypeScript, Vite.
- Styling: Tailwind CSS.
- State: Zustand stores in `src/store`.
- Persistence: IndexedDB/Dexie helpers in `src/storage`, plus browser storage
  for selected local settings.
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
- `canvas-store`: flowchart nodes, edges, viewport, and print/layout settings.
- `ai/settings-store`: AI provider/model settings; cloud keys are session-only.
- `ai/undo-store`: latest AI rollback snapshot.

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

## Math Boundary

Core title-tree mutation math belongs in `src/engine/math-engine.ts`.
Domain-specific derived review math belongs in focused helpers such as:

- `src/components/deskmap/deskmap-coverage.ts`
- `src/components/leasehold/leasehold-summary.ts`
- `src/engine/tree-layout.ts`

UI components should display and collect inputs; they should not duplicate the
calculation rules.

## Persistence Boundary

Persistence helpers live under `src/storage`. Import paths must treat external
files as untrusted input.

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
- Undo snapshots: `src/ai/undo-store.ts`.
- Settings: `src/ai/settings-store.ts`.
- Workbook staging: `src/ai/wizard`.

Current policy:

- Ollama is the preferred default.
- OpenAI/Anthropic keys are session-only in browser memory.
- AI can perform live local mutations in the current single-user workflow, but
  it must snapshot rollback state before mutating.
- Spreadsheet import should prefer deterministic row staging and user review
  over blind bulk mutation.

Future policy work is tracked in `PATCH_PLAN.md`.

## Domain Boundaries

- Desk Map is the title-tree source of truth.
- Owners is the owner/lease record source of truth.
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
