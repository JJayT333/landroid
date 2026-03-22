# LANDroid v2 — Continuation Prompt

**Branch:** `v2-desk-map-runsheet-persistence`
**Date:** 2026-03-22
**Stack:** Vite 6 + TypeScript strict + React 18 + Zustand 5 + Tailwind v4 + Decimal.js + Dexie (IndexedDB) + React Flow v12.4.0

---

## PRIORITY 1 — Fix Desk Map (CRITICAL BUGS)

Three bugs prevent the Desk Map from being usable. All three have identified root causes and fixes.

### Bug 1: Clicking cards does NOT open the edit modal

**File:** `src/views/DeskMapView.tsx:140`
**Root cause:** `e.preventDefault()` in `PanZoomContainer.handlePointerDown` suppresses ALL compatibility mouse events (including `click`) per the Pointer Events spec. The card's `onClick` in `DeskMapCard.tsx:64` never fires.

**Fix:** Remove `e.preventDefault()` from `handlePointerDown`. The container already has CSS `select-none` to prevent text selection and `onDragStart` prevention. The `onClickCapture` handler already blocks clicks after drags.

```tsx
// BEFORE (broken):
const handlePointerDown = useCallback((e: React.PointerEvent) => {
  if (e.button !== 0 && e.button !== 1) return;
  e.preventDefault();  // <-- THIS BLOCKS ALL CARD CLICKS
  ...
}, []);

// AFTER (fixed):
const handlePointerDown = useCallback((e: React.PointerEvent) => {
  if (e.button !== 0 && e.button !== 1) return;
  // Do NOT call e.preventDefault() — it kills click events on child elements
  ...
}, []);
```

### Bug 2: Switching desk map tabs does NOT update visible nodes

**File:** `src/views/DeskMapView.tsx:238`
**Root cause:** DeskMapView subscribes to `s.getActiveDeskMapNodes` (a stable function reference). When `activeDeskMapId` changes via tab click, no subscribed value changes, so DeskMapView never re-renders.

**Fix:** Add a subscription to `activeDeskMapId`:

```tsx
// Add this line in DeskMapView (forces re-render when active desk map changes):
const activeDeskMapId = useWorkspaceStore((s) => s.activeDeskMapId);
```

### Bug 3: Can't delete desk maps and start blank

**Files:** `src/views/DeskMapView.tsx:249-256` and `src/store/workspace-store.ts:125-133`

**Root cause (two parts):**
1. `getActiveDeskMapNodes()` returns ALL nodes when `activeDeskMapId` is null (line 127)
2. Auto-create effect grabs ALL existing node IDs into the new desk map (line 253)

Result: deleting a desk map immediately re-creates it with all the same nodes.

**Fix part 1** — `getActiveDeskMapNodes` should return empty when no desk map is active:
```tsx
getActiveDeskMapNodes: () => {
  const { nodes, deskMaps, activeDeskMapId } = get();
  if (!activeDeskMapId) return [];  // was: return nodes
  const dm = deskMaps.find((d) => d.id === activeDeskMapId);
  if (!dm) return [];
  if (dm.nodeIds.length === 0) return [];
  const idSet = new Set(dm.nodeIds);
  return nodes.filter((n) => idSet.has(n.id));
},
```

**Fix part 2** — Auto-create should NOT auto-assign existing nodes:
```tsx
useEffect(() => {
  if (!hydrated) return;
  if (deskMaps.length === 0) {
    createDeskMap('Tract 1', 'T1');  // No nodeIds — start blank
  }
}, [hydrated, deskMaps.length, createDeskMap]);
```

---

## PRIORITY 2 — Verify All Card Interactions

After fixing Priority 1, verify every interaction:
- [ ] Click any card → NodeEditModal opens with correct data
- [ ] Edit fields in modal → Save → card updates
- [ ] Change initialFraction → "Save & Rebalance" cascades to descendants
- [ ] Hover card → action buttons appear (PRECEDE, CONVEY, ATTACH, DELETE)
- [ ] Each action button opens its respective modal
- [ ] "View PDF" in edit modal → PdfViewerModal opens with PDF in iframe
- [ ] Pan by dragging background (not cards)
- [ ] Scroll to zoom toward cursor
- [ ] Drag-then-release does NOT trigger card click
- [ ] Tab switching shows correct subset of nodes per desk map
- [ ] Creating new desk map → empty canvas with "+ Add Root" button
- [ ] Deleting desk map → switches to next, or creates blank

---

## PRIORITY 3 — Test Imports Must Work Flawlessly

### Demo (18 nodes)
- `src/storage/seed-test-data.ts` → `seedTestData()`
- Creates 18-node Henderson County title chain with 5 fake PDFs
- Creates 1 desk map: "Henderson County"

### Stress (~200 nodes)
- `src/storage/seed-test-data.ts` → `seedStressTestData()`
- Creates ~195 nodes across 4 title chains with 125 fake PDFs
- Creates 3 desk maps: "All Tracts", "Henderson", "Thompson"
- Verify switching between 3 desk maps shows correct subsets

### CSV Import
- `src/storage/csv-io.ts` → `importCSV()`
- Reads v1-compatible CSV with `INTERNAL_DESKMAPS` JSON column

### .landroid Import
- `src/storage/workspace-persistence.ts` → `importLandroidFile()`
- JSON file with workspace data → `loadWorkspace()`

---

## PRIORITY 4 — File Cleanup

### Files to delete (unused artifacts):

**Inside v2/:**
- `src/types/research.ts` — Phase 3 placeholder, nothing imports it
- `src/components/research/` — Empty directory
- `src/components/tree/` — Empty directory
- `Screenshot 2026-03-21 at 1.33.11 AM.png`
- `Screenshot 2026-03-21 at 1.33.41 AM.png`

**In project root (landroid/):**
- `test-200a-v2.import.csv`, `test-200b-v2.import.csv` — Old test fixtures
- `test-500a-v2.import.csv`, `test-500b-v2.import.csv` — Old test fixtures
- `test-200-realistic.import.csv`, `test-500-realistic.import.csv`, `test-1024-realistic.import.csv`
- 4 screenshots + `IMG_5237.jpg`
- `.tmp_testdata_restore/` directory
- `testdata/` directory (old v1 stress test fixtures)

---

## DEFERRED — Miro-like Flowchart Upgrade (Phases 2-4)

Phase 1 is COMPLETE: canvas-store, undo/redo, keyboard shortcuts, canvas persistence.

### Phase 2 — Interaction & Editing
- Right-click context menus on nodes/edges/canvas
- Copy/paste/duplicate (Ctrl+C/V/D)
- Inline text editing (double-click to edit)
- Edge routing toggle (orthogonal/bezier/step)
- Smart snap/alignment guides
- Multi-select with shift+click or lasso

### Phase 3 — Visual & Layout
- Node styling panel (colors, borders, fonts)
- New shapes: parallelogram, cylinder, hexagon, callout
- Frame/group containers
- Auto-layout algorithms (dagre, elk)
- Text annotations, connection labels

### Phase 4 — Export & Advanced
- Export PNG/SVG/PDF
- Template system
- Layers panel
- Presentation mode
- Property panel sidebar

---

## Architecture Reference

### Stores
- **workspace-store** — Domain data: nodes, desk maps, math operations, instrument types
- **canvas-store** — Flowchart: React Flow nodes/edges, viewport, undo/redo (50-entry cap)
- **ui-store** — View mode switching (chart/flowchart/master/research)

### Persistence
- **Dexie** — v2 schema: `pdfs` (nodeId), `workspaces` (id), `canvases` (id)
- **Auto-save** — Zustand subscribe + JSON snapshot diff + debounced 2s
- **Hydration** — `_hydrated` flag prevents race with IndexedDB restore

### Math Engine
- Decimal.js precision-40 for exact fraction arithmetic
- 4 operations: convey, rebalance, predecessorInsert, attachConveyance
- Invariant: `fraction + sum(children.initialFraction) == initialFraction`

### Key File Paths
```
v2/src/
├── engine/           # Math engine, tree layout, fraction display
├── components/
│   ├── canvas/       # OwnershipNode, ShapeNode, CanvasToolbar, PageGrid, PrintOverlay
│   ├── deskmap/      # DeskMapCard, DeskMapTabs
│   ├── modals/       # NodeEditModal, ConveyModal, PredecessorModal, AttachDocModal, PdfViewerModal
│   └── shared/       # Modal, FormField, InstrumentSelect, Navbar
├── views/            # DeskMapView, FlowchartView, RunsheetView, ResearchView
├── store/            # workspace-store, canvas-store, ui-store
├── storage/          # db, pdf-store, workspace-persistence, canvas-persistence, csv-io, seed-test-data
├── hooks/            # useCanvasKeyboardShortcuts
├── types/            # node, flowchart, result
└── theme/            # index.css (Tailwind v4 + courthouse tokens)
```

### Collaboration Rules
1. Diagnose before touching code. Report findings first.
2. Smallest possible diff. No cleanup beyond what's asked.
3. No over-engineering. Don't add features beyond what's requested.
