# LANDroid v2 — Continuation Prompt

## Who You Are

You are helping a **Texas landman** build **LANDroid v2**, a mineral title examination and ownership flowchart tool. The user specializes in oil & gas mineral title. A secondary use case: producing clean professional ownership flowcharts for a broker who currently uses Excel snapshot tables.

## Collaboration Rules (CRITICAL)

1. **Diagnose before touching code.** When a bug is reported, read and report findings first, only apply fixes after explicit user approval.
2. **Do NOT rewrite anything unless explicitly asked.** Smallest possible diff. No cleanup, no extra comments, no restructuring.
3. **No over-engineering.** Don't add features, refactor, or make "improvements" beyond what's asked.

---

## What Has Been Built (all working, all tests passing)

### Stack
- **Vite 6** + TypeScript strict + React 18 (ESM)
- **React Flow v12** for the flowchart canvas (infinite pan/zoom, draggable nodes)
- **Decimal.js** (precision 40) for exact fraction arithmetic, serialized to 9 decimal places
- **Zustand 5** for state management
- **Tailwind v4** with a custom courthouse theme (parchment, ink, leather, gold, seal colors)
- **Vitest** — 69 tests passing across 4 test files
- **PapaParse** for CSV import/export
- **Dexie** (imported but not yet wired for IndexedDB persistence)

### Math Engine (`src/engine/`)
Fully working. 4 operations: `executeConveyance`, `executeRebalance`, `executePredecessorInsert`, `executeAttachConveyance`. Graph validator with ownership invariant checks. 30 math engine tests passing.

**Key invariant:** `node.fraction + sum(children.initialFraction) == node.initialFraction`

- `initialFraction` = what was granted TO this node (absolute, of whole tract)
- `fraction` = what remains after this node's own conveyances away (absolute)
- `relativeShare` = initialFraction / parent.initialFraction (computed in layout)

### Fraction Display (`src/engine/fraction-display.ts`)
Continued fraction algorithm converts decimals to fractions (1/2, 1/4, 1/8... 1/512). 20 tests passing.

### Tree Layout (`src/engine/tree-layout.ts`)
Reingold-Tilford style layout. O(n) performance. Computes subtree widths bottom-up, positions children centered under parent, related documents offset to the right. Computes `relativeShare` for each node. 10 tests passing.

### Card Display (`src/components/canvas/OwnershipNode.tsx`)
Each card shows:
- **Header:** instrument type + date
- **Body:** grantor → grantee
- **Footer fractions:**
  - **"Granted"** = `relativeShare` — fraction of the GRANTOR's interest (e.g. "1/2" if grantor gave half their interest)
  - **"Of Whole"** = `grantFraction` (= `initialFraction`) — absolute interest in the whole tract
  - **"Remaining"** (conditional) — only shown if grantee has conveyed some interest away

This is correct and matches how mineral deeds actually work — deeds say "I convey 1/2 of my interest" not "I convey 1/16 of the whole tract."

### CSV Import (`src/storage/csv-io.ts`)
Imports v1-format CSV files. Converts to v2 OwnershipNode format. 9 tests passing with 4 test CSVs (two 200-node, two 500-node) that have realistic title chain structures.

### Test CSVs (in project root)
- `test-200a-v2.import.csv` — deep binary tree, root splits 1/2, 1/4, 1/4
- `test-200b-v2.import.csv` — wide quaternary tree
- `test-500a-v2.import.csv` — mixed realistic
- `test-500b-v2.import.csv` — branchy partial
- All use power-of-2 fractions only (1/2, 1/4, 1/8... 1/512 maximum)
- Some grantees KEEP their interest (leaves at various tree depths)

### Zustand Store (`src/store/workspace-store.ts`)
Has `nodes`, `deskMaps`, `activeDeskMapId`, and all math operation actions wired to the engine.

### FlowchartView (`src/views/FlowchartView.tsx`)
React Flow canvas with CSV import, re-layout, clear. Minimap, controls, infinite zoom (0.02x–4x). Background dots.

---

## What Needs to Be Built NOW (Priority Order)

### 1. PAGE GRID OVERLAY (TOP PRIORITY)

Add a printable page grid that appears as a background layer on the React Flow canvas. The user needs to:

- **Set columns and rows** (e.g., 8 columns x 2 rows = 16 letter-size pages)
- **See page boundaries** as dashed lines on the canvas background
- **Drag the entire tree** or individual nodes to position them so nothing lands where pages meet
- **Print** and have each page come out as a separate letter-size sheet

**How it worked in v1** (reference from `src/app.jsx` in the parent `/projects/landroid/` directory):

```javascript
// Page dimensions at 96 DPI
const pw = printOrientation === 'landscape' ? 1056 : 816; // 11" vs 8.5"
const ph = printOrientation === 'landscape' ? 816 : 1056; // 8.5" vs 11"

// State
const [gridCols, setGridCols] = useState(1);
const [gridRows, setGridRows] = useState(1);
const [printOrientation, setPrintOrientation] = useState('landscape');

// Total paper area
const paperWidth = pw * gridCols;
const paperHeight = ph * gridRows;

// Page tiles for labels (A1, A2, B1, B2, etc.)
const flowPageTiles = Array.from({ length: gridRows }).flatMap((_, row) => (
    Array.from({ length: gridCols }).map((__, col) => ({
        row, col,
        label: `${String.fromCharCode(65 + row)}${col + 1}`,
    }))
));

// Rendered as dashed lines inside a pointer-events-none overlay:
// - Vertical dividers at each (col+1)*pw
// - Horizontal dividers at each (row+1)*ph
// - Page labels (A1, B2, etc.) at top-left of each tile
// - Overflow detection (are nodes outside the print boundary?)

// Print CSS: @media print { @page { size: letter landscape; margin: 0; } }
// Each page is rendered as a separate div that clips to its portion of the total paper area
```

**For v2 implementation:**
The v2 canvas uses React Flow (not hand-rolled pan/zoom like v1). The page grid should be rendered as a **custom React Flow background layer or an absolutely positioned overlay** inside the ReactFlow container. Key requirements:

- Page grid is purely visual — it does NOT constrain node placement
- Nodes remain individually draggable on top of the page grid
- The `+`/`-` buttons for cols/rows go in the toolbar
- Orientation toggle (portrait/landscape) in the toolbar
- Print button that renders each page tile as a separate printed page
- Page labels (A1, A2, B1, B2...) in the corner of each tile
- Dashed lines for page boundaries
- The page grid should be in **canvas coordinates** (not screen coordinates) so it zooms/pans with the canvas

**Add to CanvasToolbar:** cols +/-, rows +/-, orientation toggle, print button
**Add to FlowchartView:** page grid state, overlay rendering, print CSS
**Add to theme/index.css:** print media queries for multi-page output

### 2. DESK MAP VIEW (Next Priority)

The Desk Map is the **primary working area** — where the user builds and edits the title chain. The flowchart is for presentation/printing. In v1, the Desk Map was a tree of cards rendered with CSS (not React Flow), with pan/zoom and action buttons on each card.

Each desk map card in v1 showed:
- Instrument type + date (header)
- Grantee (bold, large)
- Grantor
- Conveyance fraction
- Grant fraction (initialFraction) + display fraction
- Remaining fraction + display fraction
- Death notes (if deceased, with tombstone toggle)
- Attached/related documents
- Collapse/expand button for branches
- Action buttons on hover: CONVEY, PRECEDE, REBALANCE, ATTACH, + DOC, DELETE

The Desk Map view needs:
- Its own route/tab (the app will have tabs: Desk Map, Flowchart, Runsheet, Research)
- Pan/zoom (can be hand-rolled like v1 or use a library)
- Tree rendering with CSS connectors (parent → children lines)
- Click-to-edit modal for node properties
- All the math operations accessible from card buttons
- Multiple desk maps per workspace (tab/selector to switch)

**The v2 types already support this:**
- `OwnershipNode` has all fields: instrument, vol, page, docNo, fileDate, date, grantor, grantee, landDesc, remarks, fraction, initialFraction, isDeceased, obituary, etc.
- `DeskMap` type: `{ id, name, code, tractId, nodeIds }`
- `workspace-store.ts` already has: convey, rebalance, insertPredecessor, attachConveyance, addNode, updateNode, removeNode

### 3. Missing v1 Fields (identified but not yet added)
- `estateType` on OwnershipNode (e.g., "mineral", "surface", "royalty")
- `treeGroupId` on OwnershipNode
- Vol/page/docNo display on flowchart cards
- `pz` (pan/zoom viewport state) on DeskMap type

---

## DO NOT Re-upload the Old Zip

You do **not** need the old zip file. The v1 source code is already on disk at `/Users/abstractmapping/projects/landroid/src/app.jsx` (the 4,103-line monolith). The v2 code is at `/Users/abstractmapping/projects/landroid/v2/`. All the v1 reference code for pages, desk map rendering, and print is accessible by reading the v1 file.

## Key File Paths

```
v2/
├── src/
│   ├── engine/
│   │   ├── math-engine.ts          # 4 operations, graph validator
│   │   ├── tree-layout.ts          # Reingold-Tilford layout + relativeShare
│   │   ├── decimal.ts              # Decimal.js wrapper, serialize()
│   │   ├── fraction-display.ts     # Continued fraction → "1/4" display
│   │   └── __tests__/              # 3 test files
│   ├── components/
│   │   └── canvas/
│   │       ├── OwnershipNode.tsx    # Card component (Granted/Of Whole/Remaining)
│   │       ├── ShapeNode.tsx        # Generic shape node
│   │       └── CanvasToolbar.tsx    # Tool buttons, import, clear
│   ├── views/
│   │   └── FlowchartView.tsx       # React Flow canvas wrapper
│   ├── store/
│   │   ├── workspace-store.ts      # Zustand store with math operations
│   │   └── ui-store.ts
│   ├── storage/
│   │   ├── csv-io.ts               # CSV import/export
│   │   └── __tests__/csv-io.test.ts
│   ├── types/
│   │   ├── node.ts                 # OwnershipNode, DeskMap, createBlankNode
│   │   ├── flowchart.ts            # OwnershipNodeData, FlowTool
│   │   ├── research.ts
│   │   └── result.ts
│   └── theme/
│       └── index.css               # Tailwind v4 + courthouse theme tokens
├── test-200a-v2.import.csv
├── test-200b-v2.import.csv
├── test-500a-v2.import.csv
├── test-500b-v2.import.csv
└── package.json                    # Vite 6, React 18, React Flow v12, etc.
```

## How to Start

1. `cd /Users/abstractmapping/projects/landroid/v2`
2. `npm run dev` — starts Vite dev server with HMR
3. `npx vitest run` — runs all 69 tests (should all pass)
4. Import a test CSV in the browser to see the flowchart

**Start with the page grid overlay.** The user needs to print flowcharts for their broker, and the pages are the blocking feature. The desk map comes second.
