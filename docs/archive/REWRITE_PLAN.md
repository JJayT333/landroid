# LANDroid v2 — Ground-Up Rewrite Plan

## Architecture Decision Record

### Why Rewrite
- 4,103-line monolithic `app.jsx` — untestable, unmaintainable
- Float arithmetic with epsilon hacks — 9-decimal precision requires `Decimal.js`
- Hand-rolled SVG/DOM flowchart — replace with React Flow (battle-tested, infinite canvas)
- No type safety — TypeScript catches title math bugs at compile time
- CDN-loaded React via UMD — no HMR, no tree-shaking, no modern tooling

### New Stack
| Layer | Old | New | Why |
|-------|-----|-----|-----|
| Build | esbuild (manual copy) | Vite 6 | HMR, TS, CSS modules, fast |
| Language | JavaScript | TypeScript (strict) | Catch fraction bugs at compile |
| Framework | React 18 (CDN UMD) | React 18 (npm, ESM) | Proper modules |
| State | useState + prop drilling | Zustand | Minimal, reactive, devtools |
| Math | Native float + epsilon | Decimal.js | Exact 9-decimal precision |
| Canvas | Hand-rolled SVG/DOM | React Flow v12 | Infinite zoom, drag, edges |
| Styling | Tailwind (CDN) | Tailwind v4 (PostCSS) | Proper purge, dark mode |
| Storage | IndexedDB (custom) | IndexedDB (Dexie.js) | Simpler API, migrations |
| CSV | PapaParse (CDN) | PapaParse (npm) | Same lib, proper import |
| Testing | Custom node scripts | Vitest | Fast, TS-native, watch mode |

### What We Keep
- **Math engine logic** — the four operations (convey, rebalance, precede, attach) are correct. We port the algorithms, replace float math with Decimal.js.
- **Data model shapes** — Node, DeskMap, Contact, Tract, OwnershipInterest, ContactLog entities.
- **Result envelope pattern** — `{ ok, data, audit }` / `{ ok, error }`.
- **Validation logic** — graph invariant checks.
- **Texas Courthouse aesthetic** — modernized with rounded corners, better contrast.

### What We Kill
- The 4,103-line monolith
- CDN script loading
- Hand-rolled pan/zoom canvas
- Float arithmetic everywhere
- UMD module wrappers
- localStorage audit log (move to IndexedDB)

---

## Directory Structure

```
landroid/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Root component, router
│   ├── engine/
│   │   ├── decimal.ts              # Decimal.js config, helpers
│   │   ├── math-engine.ts          # Core ownership math (Decimal.js)
│   │   ├── graph-validator.ts      # Ownership graph validation
│   │   ├── fraction-display.ts     # Decimal → fraction string
│   │   └── __tests__/
│   │       ├── math-engine.test.ts
│   │       ├── graph-validator.test.ts
│   │       └── fraction-display.test.ts
│   ├── store/
│   │   ├── workspace-store.ts      # Zustand: nodes, deskmaps, active state
│   │   ├── flowchart-store.ts      # Zustand: React Flow nodes/edges
│   │   ├── research-store.ts       # Zustand: contacts, tracts, interests
│   │   └── ui-store.ts             # Zustand: modals, view, sidebar
│   ├── views/
│   │   ├── ChartView.tsx           # Tree ownership view
│   │   ├── MasterView.tsx          # Chronological runsheet
│   │   ├── FlowchartView.tsx       # React Flow canvas
│   │   └── ResearchHub.tsx         # Contacts, tracts, interests
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── OwnershipNode.tsx   # React Flow custom node
│   │   │   ├── ShapeNode.tsx       # Freeform shape node
│   │   │   ├── CanvasToolbar.tsx   # Drawing tools
│   │   │   └── edge-types.ts       # Custom edge renderers
│   │   ├── tree/
│   │   │   ├── TreeCard.tsx        # Ownership card in chart view
│   │   │   └── TreeLayout.tsx      # Depth-first tree renderer
│   │   ├── modals/
│   │   │   ├── ConveyanceModal.tsx
│   │   │   ├── RebalanceModal.tsx
│   │   │   ├── PredecessorModal.tsx
│   │   │   ├── AttachModal.tsx
│   │   │   └── DocumentModal.tsx
│   │   ├── research/
│   │   │   ├── ContactsTab.tsx
│   │   │   ├── TractsTab.tsx
│   │   │   ├── InterestsMatrix.tsx
│   │   │   └── ContactLogsTab.tsx
│   │   └── shared/
│   │       ├── FractionDisplay.tsx # Shows "0.5 | 1/2"
│   │       ├── Modal.tsx           # Accessible modal shell
│   │       └── Navbar.tsx
│   ├── storage/
│   │   ├── db.ts                   # Dexie.js schema
│   │   ├── workspace-io.ts        # Save/load/export
│   │   └── csv-io.ts              # CSV import/export
│   ├── types/
│   │   ├── node.ts                 # Node, DeskMap types
│   │   ├── research.ts            # Contact, Tract, Interest types
│   │   ├── result.ts              # Result<T> envelope
│   │   └── flowchart.ts           # Flow node/edge types
│   └── theme/
│       ├── index.css               # Tailwind base + courthouse tokens
│       └── tokens.ts               # Color/font constants
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── package.json
└── vitest.config.ts
```

---

## Build Order

### Phase 1: Foundation (Current Sprint)
1. **Initialize Vite + TypeScript + Tailwind + Vitest**
2. **Build Math Engine** (`src/engine/`)
   - Port all four operations to Decimal.js
   - 9-decimal precision everywhere
   - `formatAsFraction()` for dual display
   - Comprehensive test suite: cascade test (100% → 0.5 → 3 generations)
3. **Type definitions** (`src/types/`)

### Phase 2: Canvas & Reactive State
4. **Zustand stores** — workspace, flowchart, research, UI
5. **React Flow canvas** — custom OwnershipNode, edge types
6. **Tree → Flow import** — populate canvas from title chain
7. **Reactive math waterfall** — edit node → Zustand → recalculate descendants → React Flow updates

### Phase 3: Views & UI
8. **Chart View** — tree visualization with pan/zoom
9. **Master View** — runsheet table
10. **Flowchart View** — full Miro-style canvas
11. **Research Hub** — contacts, tracts, interest matrix
12. **Modals** — convey, rebalance, precede, attach, document

### Phase 4: Persistence & Polish
13. **Dexie.js storage** — save/load workspaces
14. **CSV import/export** — preserve compatibility
15. **Print support** — A4/Letter flowchart output
16. **Courthouse theme** — modern SaaS aesthetic

---

## Math Engine Spec (Phase 1 Deliverable)

### Precision Contract
- All fractions stored as `Decimal` objects internally
- Serialized to string for JSON/storage (preserves precision)
- Display: 9 decimal places + fraction equivalent
- Example: `0.500000000 | 1/2`

### Cascade Behavior
When any node's `initialFraction` changes:
1. Compute `scaleFactor = newInitial / oldInitial`
2. Walk all descendants (DFS)
3. Scale each descendant's `fraction` and `initialFraction` by `scaleFactor`
4. Update parent's `fraction` by delta (`oldInitial - newInitial`)
5. Return audit trail with affected count

### Invariant (enforced by validator)
For every non-related node:
```
fraction + sum(children.initialFraction) ≤ initialFraction
```
All values non-negative. No cycles. No orphans. No duplicates.

### Test Case: Three-Generation Cascade
```
Root: initialFraction=1.0, fraction=0.5 (conveyed 0.5 away)
├── Child A: initialFraction=0.25, fraction=0.125
│   ├── Grandchild A1: initialFraction=0.0625, fraction=0.0625
│   └── Grandchild A2: initialFraction=0.0625, fraction=0.0625
└── Child B: initialFraction=0.25, fraction=0.25

Rebalance Root from 1.0 → 0.5:
  scaleFactor = 0.5 / 1.0 = 0.5

  Root: initialFraction=0.5, fraction=0.25
  ├── Child A: initialFraction=0.125, fraction=0.0625
  │   ├── Grandchild A1: initialFraction=0.03125, fraction=0.03125
  │   └── Grandchild A2: initialFraction=0.03125, fraction=0.03125
  └── Child B: initialFraction=0.125, fraction=0.125
```
