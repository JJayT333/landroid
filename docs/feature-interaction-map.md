# LANDroid — Feature Interaction & Refactor Blast-Radius Map

> **Generated 2026-06-26** by tracing real code dependencies (imports, Zustand store
> reads, shared types, persisted fields), the test/baseline guards, and the
> regression history. Point-in-time — verify against current code before relying
> on a specific file:line. Refresh after large refactors.

This is the **audit companion** to the boundary-oriented docs:
[`ARCHITECTURE.md`](../ARCHITECTURE.md) (layer boundaries / state ownership),
[`USER_MANUAL.md`](../USER_MANUAL.md) (per-view behavior),
[`PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md) (domain + invariants),
[`TESTING.md`](../TESTING.md) (how to run the guards). It exists to answer the
one question those don't: **"if I refactor X, what breaks, and which check catches it?"**

## How to use this during an audit

1. **Before touching a file**, find its feature below and read **Consumed by** —
   that is the blast radius (what silently breaks if you change it).
2. **Cross-cutting change?** (a type, a store shape, the `.landroid` serializer,
   the math input) — jump to **Refactor blast-radius cheat sheet** and run the
   listed guards.
3. **After the change**, run the guards named for the touched contracts. The
   single highest-value lock is the title-math byte-identity baseline
   (`npx tsx scripts/title-math-baseline.ts --check new` → expect
   `byte=0 value=0 structural=0`).
4. **Known-fragile areas** (the things refactors have broken before) are in
   **Regression history & known fragility** — give those extra scrutiny.

---

## Dependency map

Adjacency list — each feature with **READS (upstream)** and **READ BY (downstream)**, de-duplicated across specs.

| Feature | READS (upstream) | READ BY (downstream) |
|---|---|---|
| **Desk Map (title tree)** `workspace-store.ts` | title-math, owner-store, leasehold-calc, document-store, curative-store, map-store, canvas-store, decimal-engine, title-action-log, AI-approval | leasehold, runsheet, documents, owners, curative, flowchart, AI-chat, persistence, write-lease, project-records |
| **title-math** `src/title-math/` | workspace-store (nodes/deskMaps), owner-store (Lease/Owner), leasehold types, decimal-engine, MathInputView projection, node-predicates | deskmap-coverage/warning-dots, leasehold-review, MathInputView, AI-approval, csv-io/validateGraph, title-cutover-gate, baseline CI |
| **owners-leases** `owner-store.ts` | workspace-store (linkedLeaseId/Owner), desk-map (lease-node), curative-store, map-store, leasehold-math, document-store, persistence | leasehold-summary, coverage-math, owners-ui, deskmap-ui, ai-tools, transfer-order |
| **leasehold** `LeaseholdView.tsx` + `calculators/leasehold.ts` | desk-map, ownership-tree, lease-coverage, curative, decimal-engine, ui-store (activeUnitCode), desk-map-units | transfer-order-review, map-view-orri/npri, summary-cards, tract-summary, formula-tooltips, audit-sheet, tract-export |
| **runsheet-documents** `document-store.ts` | workspace-store, title-math (read-only), deskmap, node-editor, persistence, blob-storage, db-key-scope, write-lease | runsheet-view, documents-view, deskmap chips, workspace-actions, node-normalization, runsheet-csv, persistence |
| **maps** `map-store.ts` | workspace-store (DeskMap.externalRefs/code/grossAcres), owner-store, research-store, document-store, curative-store, file-validation | workspace-store (externalRefs write), MapsView, export/import, side-store-reset, undo-cascade, demo-loading, desk-map rail |
| **curative** `curative-store.ts` | workspace-store, owner-store, write-lease, persistence/db-key | deskmap warning-dots, document-attachments, leasehold transfer-order holds |
| **research** `research-store.ts` | workspace (id scoping), document-registry (label only), persistence, write-lease, db-key-scope | federal-leasing, maps (FK back-links), export/import, AI-undo (NOT captured) |
| **federal-leasing** `federal-lease-tracking.ts` | research-store, research-persistence, map-store, owner-store, workspace-store, ui-store, write-lease, types:research | research-view (lazy route), navigation, workspace-lifecycle (reset) |
| **AI** `src/ai/` | workspace-store, owner-store, curative-store, map-store, title-action-log, title-math, document-store, canvas-store, project-records, side-store-reset, auth, deploy-env | AIPanel, AISettingsPanel, Navbar, workspace-lifecycle, chat-context, runChatTurn, tools |
| **persistence-lifecycle** `workspace-persistence.ts` | workspace-store, owner-store, canvas-store, map/research/curative-store, title-action-log, backend-spine, document-store, auth | autosave, project-picker, file-actions, demo-loading, rolling-export, views, startup-warnings |
| **flowchart-salesdeck** `canvas-store.ts` | desk-map (getActiveDeskMapNodes), title-math (computeLiveOwnershipFractions), page/print metrics, tree-layout/ELK, document-registry (static copy) | autosave/persistence, app-shell, print pipeline |

### Highest fan-in nodes (the contracts almost everything depends on)

1. **`workspace-store.ts` / OwnershipNode + DeskMap** — read by title-math, leasehold, owners-leases, runsheet-documents, maps, curative, federal-leasing, AI, persistence, flowchart. **The keystone.** Touch here ripples to ~every feature.
2. **`title-math` (ownership/coverage/leasehold calculators)** — the single math authority; read by Desk Map, leasehold, AI-approval, csv-io, cutover-gate, baseline CI.
3. **`engine/decimal.ts`** — every fraction in every feature passes the `d()` parse / `serialize()` firewall.
4. **`workspace-persistence.ts` (.landroid round-trip)** — every store serializes through it; the universal data-loss surface.
5. **`db-key-scope` / `[dbKey+workspaceId]` scoping** — every Dexie-backed store (documents, owners, maps, research, curative, ledger) keys on it.
6. **`title-action-log` / journalTitleMutation** — every title mutation across Desk Map + AI funnels through the ledger + undo stack.

---

## Shared contracts & invariants

Cross-cutting contracts that bind multiple features. For each: **participants → what breaks → guard**.

### 1. OwnershipNode shape + `normalizeOwnershipNode` byte-identity
- **Participants:** Desk Map, title-math, owners-leases, runsheet-documents, maps (externalRefs), curative, AI, flowchart, persistence.
- **Breaks if changed:** any new field written unconditionally breaks the byte-identity oracle (pre-overhaul workspaces diff); optional fields (`statedFraction`, `ratificationStatus`, `doubleFractionClause`, `leaseTractLeasedInterest`, `leaseTractGrossAcres`) must stay write-only-when-meaningful. Coverage/root-total filters assume all nodes present.
- **Guard:** `src/storage/__tests__/workspace-persistence.test.ts`, `src/types/__tests__/node-attachments.test.ts`, `src/project-records/__tests__/action-parity.test.ts`.

### 2. `node.fraction` / `node.initialFraction` as the SOLE math input
- **Participants:** title-math (all calculators), Desk Map (mutations), leasehold, flowchart overlay, MathInputView projection. Documents/maps/research/curative/federal explicitly **never** touch math.
- **Breaks if changed:** any path that recomputes from anything other than `fraction`/`initialFraction` (or that lets a document/map mutation trigger recalc) corrupts decimals everywhere downstream. `serialize()` firewall (≤9dp quantize or 24-sig-fig) must wrap every emit.
- **Guard:** `src/title-math/__diff__/__tests__/baseline.test.ts` (golden-master), `differential.test.ts`, MathInputView parity in `projections.ts`, `runsheet-documents` MathInputView-parity guard (document changes must NOT recalc).

### 3. Lease-node `linkedLeaseId` scoping + per-tract override (`leaseTractLeasedInterest`)
- **Participants:** owners-leases, Desk Map (buildLeaseNode/syncLeaseNodesFromRecord), leasehold/coverage (buildLeaseScopeIndex/getLeasesForOwnerNode), persistence.
- **Breaks if changed:** one Lease fans to N lease-nodes (one per tract, #221); `buildLeaseScopeIndex` must stay in sync with how lease-nodes carry per-tract data or coverage diverges from stored state. Override read only when non-empty + on lease-node; empty falls back to `Lease.leasedInterest` (legacy single-tract round-trip). Deleting the ONLY lease-node removes the Lease; deleting one of N does not.
- **Guard:** `src/components/deskmap/__tests__/deskmap-lease-node.test.ts`, `deskmap-lease-delete.test.ts`, `src/title-math/calculators/__tests__/coverage.test.ts`, `src/storage/__tests__/collapse-duplicate-leases.test.ts`, `attach-lease-modal.test.tsx`.

### 4. `.landroid` serializer round-trip (export→import→export identity)
- **Participants:** ALL stores — workspace nodes/deskMaps, owners/leases/LPRs/contacts/ownerDocs, documents+blobs, maps (assets/regions/refs/tractFeatures), research (base64 blobs), curative, canvas, title-ledger chain.
- **Breaks if changed:** silent field loss on any store; document blobs/contentHash dropped; research base64 toward 500MB cap; ledger hydration partial-fail leaves workspace replaced but ledger incomplete (ACT-H4, DA-H4/H5 open). Non-numeric version falls through to legacy path (DA2-L8).
- **Guard:** `src/storage/__tests__/workspace-persistence.test.ts`, `document-export-workspace-scope.test.ts`, `src/phase0/__tests__/springhill-sample.test.ts`, `.landroid round-trip` checks in each spec, playwright e2e (Raven Forest).

### 5. `[dbKey + workspaceId]` scoping
- **Participants:** documents, owners, maps, research, curative, title-ledger, workspace shards — every Dexie table.
- **Breaks if changed:** cross-workspace blob leakage on import; per-user namespace breach (hosted multi-user); legacy v10 rows without dbKey compared against current active key → user signing in with different Cognito sub loses legacy rows (intentional boundary, Audit M-1).
- **Guard:** `src/storage/__tests__/active-workspace-key.test.ts`, `document-export-workspace-scope.test.ts`, `title-ledger-persistence.test.ts`, `curative-store.test.ts` (forces active workspaceId).

### 6. Texas-only active-math gate (`isTexasMathLease` / jurisdiction isolation)
- **Participants:** title-math (MathInputView precondition), owners-leases (attach gate), leasehold (federal exclusion), research/federal-leasing (reference-only separation), AI (context + attachLease block).
- **Breaks if changed:** non-Texas leases leak into Texas Desk Map/leasehold math; if raw `store.deskMaps`/`store.nodes` are consumed directly (sidebar summary) they skip the gate. Block strength = `lease.jurisdiction` enum hydration integrity.
- **Guard:** `src/project-records/projections.ts:buildJurisdictionIsolationPrecondition`, `src/types/__tests__/lease-jurisdiction.test.ts`, `federal-lease-tracking.test.ts`, leasehold-summary federal-exclusion assertions.

### 7. Warn-don't-cap (over-conveyance, over-coverage, over-burden, NPRI over-carve)
- **Participants:** title-math (ownership/coverage/leasehold), Desk Map (warning dots), curative (red flags), leasehold (transfer-order holds), LLA-H03.
- **Breaks if changed:** any hard-block where the contract expects a warning (or silent cap where it expects a warning) violates "gates block computation not saving." `node.statedFraction` records claimed vs `node.fraction` booked; first-effective-wins clipping marks `leaseOverlaps`; fixed-NPRI excess→WI flag (DA-H1).
- **Guard:** `src/title-math/calculators/coverage.ts:allocateLeaseCoverage`, `leasehold.ts` over-burden/over-floating checks, `graph-ops.ts:validateCalcGraph`, `src/components/deskmap/__tests__/deskmap-coverage.test.ts`, `leasehold-summary.test.ts`.

### 8. Title-ledger hash chain + `journalTitleMutation` (append-only, store==ledger)
- **Participants:** Desk Map (all mutations), AI-approval (origin-tagged 'ai'), persistence (hydrate/quarantine), title-undo-stack.
- **Breaks if changed:** silent (un-journaled) mutation; undo can't apply journal inverse; hash discontinuity quarantines chain; cascade fires AFTER ledger rollback on parity failure permanently deletes reverted records (DA-H3, DA-H4/H5 open). Read-flip default-off; shadow path canonical.
- **Guard:** `src/store/__tests__/title-journal-coverage.test.ts`, `title-action-log.test.ts`, `title-ledger-persistence.test.ts`, `title-action-log-persistence.test.ts`, `undo-ledger.test.ts`.

### 9. MathInputView projection (shadow-read parity)
- **Participants:** title-math, Desk Map, leasehold, AI-approval (preview), persistence, action-layer cutover.
- **Breaks if changed:** action-layer replay diverges from store snapshot (nodeDisplays/leaseholdSummary/transferOrderReview); cutover gate trips. AI preview executes on cloned state NOT via MathInputView — preview-vs-live divergence mis-gates `canApprove`.
- **Guard:** `src/project-records/__tests__/action-parity.test.ts`, `title-cutover-readiness.ts:mathParityClean`, `title-math-parity.ts`.

### 10. NodeAttachmentSummary cache ↔ Dexie single-writer
- **Participants:** runsheet-documents (source of truth = Dexie), Desk Map (`node.attachments[]` cache), AI-undo (snapshot), persistence.
- **Breaks if changed:** cache staleness if Dexie mutated outside workspace-store; position compaction (dense 0-indexed) breaks tests assuming stable positions; deep-clone JSON fallback drops Blob in undo snapshots.
- **Guard:** `src/storage/__tests__/document-store.test.ts`, `node-attachments.test.ts`, `undo-cascade-bundle.test.ts`.

### 11. Unit-focus / `activeUnitCode` scope boundary
- **Participants:** Desk Map (filterDeskMapsByUnitCode), leasehold (ORRI/WI scoping), maps, AI-context.
- **Breaks if changed:** ORRIs/assignments scoped by `unitCode` discriminator (null=unit-wide); switching units changes visible state but does NOT cascade records → cross-unit orphans invisible in active unit. `unitRecordAppliesToDeskMap` is the predicate; scope flip tract→unit also flips `deskMapId`→null.
- **Guard:** `src/utils/desk-map-units.ts` usage, `leasehold-summary.test.ts` (unit-assignment filtering), `decimal-rows-filter` (leasehold.ts:1576-1800).

---

## Refactor blast-radius cheat sheet

Lookup: **"If you change X" → re-verify + run guards.** Commands assume vitest (`npx vitest run <path>`).

| If you change… | Re-verify these features | Run these guards |
|---|---|---|
| **OwnershipNode type / `normalizeOwnershipNode`** (`src/types/node.ts`) | Desk Map, title-math, owners-leases, runsheet-documents (attachments), maps (externalRefs), curative, AI-undo, flowchart, persistence | `vitest run src/storage/__tests__/workspace-persistence.test.ts src/types/__tests__/node-attachments.test.ts src/project-records/__tests__/action-parity.test.ts src/phase0/__tests__/springhill-sample.test.ts` + `scripts/title-math-baseline.ts` |
| **`node.fraction` / `initialFraction` / math inputs** (`title-math/calculators/ownership.ts`, `coverage.ts`, `leasehold.ts`, `engine/decimal.ts`) | title-math, Desk Map coverage/warning-dots, leasehold (all rows + transfer-order), flowchart overlay, MathInputView, AI-approval | `vitest run src/title-math/__diff__/__tests__/baseline.test.ts src/title-math/__diff__/__tests__/differential.test.ts src/title-math/calculators/__tests__/coverage.test.ts src/components/leasehold/__tests__/leasehold-summary.test.ts src/engine/__tests__/tree-layout.test.ts` — **Springhill = oracle (ORACLE DRIFT)** |
| **Lease / lease-node model** (`types/owner.ts`, `deskmap-lease-node.ts`, `lease-helpers.ts`, `coverage.ts:buildLeaseScopeIndex`) | owners-leases, Desk Map lease cards, leasehold/coverage, curative (lease links), maps (lease refs), AI attachLease, persistence | `vitest run src/components/deskmap/__tests__/deskmap-lease-node.test.ts src/components/deskmap/__tests__/deskmap-lease-delete.test.ts src/title-math/calculators/__tests__/coverage.test.ts src/storage/__tests__/collapse-duplicate-leases.test.ts src/components/modals/__tests__/attach-lease-modal.test.tsx src/components/owners/__tests__/owner-lease-grouping.test.ts` |
| **A Zustand store shape** (workspace/owner/curative/map/research/canvas-store) | every consumer of that store + AI-undo snapshot (5-store contract) + side-store-reset + .landroid serializer | `vitest run src/storage/__tests__/workspace-side-store-reset.test.ts src/ai/__tests__/undo-store.test.ts src/storage/__tests__/workspace-persistence.test.ts` + the store's own `__tests__` |
| **`.landroid` serializer / Dexie schema** (`workspace-persistence.ts`, `db.ts`, shard tables) | ALL features (round-trip), version-gate (DA2-L8), blob base64 (docs/maps/research), ledger chain hydration | `vitest run src/storage/__tests__/workspace-persistence.test.ts src/storage/__tests__/workspace-shard-reader.test.ts src/storage/__tests__/workspace-shard-writer.test.ts src/storage/__tests__/document-export-workspace-scope.test.ts src/storage/__tests__/document-migration.test.ts src/storage/__tests__/title-ledger-persistence.test.ts src/app/project-workspace-lifecycle.test.ts` + playwright Raven Forest e2e |
| **AI tool / approval contract** (`ai/tools.ts`, `approval-store.ts`, `approval-preview.ts`, `undo-store.ts`) | AI feature, Desk Map mutations (executors), all 5 snapshot stores, system-prompt (hosted advisory vs local tool build), chat-context | `vitest run src/ai/__tests__/approval-store.test.ts src/ai/__tests__/approval-preview.test.ts src/ai/__tests__/undo-store.test.ts src/ai/__tests__/undo-ledger.test.ts src/ai/__tests__/runChat.test.ts src/ai/__tests__/runChat-hosted.test.ts src/ai/__tests__/system-prompt.test.ts src/ai/__tests__/tools.test.ts src/ai/__tests__/app-context.test.ts` |
| **Title ledger** (`title-action-log.ts`, `title-ledger-persistence.ts`, `title-undo-stack.ts`, `undo-cascade-bundle.ts`) | Desk Map (journaling), AI (origin tag + undo range), persistence (hydrate/quarantine/chain verify), curative (cascade capture) | `vitest run src/store/__tests__/title-journal-coverage.test.ts src/store/__tests__/title-action-log.test.ts src/store/__tests__/title-action-log-persistence.test.ts src/storage/__tests__/title-ledger-persistence.test.ts src/storage/__tests__/undo-cascade-bundle.test.ts src/ai/__tests__/undo-ledger.test.ts` — watch DA-H3/H4/H5 (cascade-after-rollback) |
| **Unit-focus / `unitCode`** (`utils/desk-map-units.ts`, `filterDeskMapsByUnitCode`, `unitRecordAppliesToDeskMap`) | Desk Map tab filtering, leasehold (ORRI/WI/NPRI scoping, decimal-rows), maps, AI-context unit filtering, persistence (validUnitCodes on import) | `vitest run src/components/leasehold/__tests__/leasehold-summary.test.ts src/storage/__tests__/workspace-persistence.test.ts src/ai/__tests__/app-context.test.ts` — verify scope flip tract→unit nulls `deskMapId`; cross-unit orphans stay hidden |
| **Document store / attachment model** (`document-store.ts`, `types/document.ts`, position compaction) | runsheet-documents, Desk Map chips, owners (OwnerDoc.leaseId), curative attachments, packet-export, AI-undo (blob), persistence | `vitest run src/storage/__tests__/document-store.test.ts src/documents/__tests__/document-registry.test.ts src/documents/__tests__/duplicate-guard.test.ts src/documents/__tests__/packet-export.test.ts src/storage/__tests__/runsheet-export.test.ts src/types/__tests__/node-attachments.test.ts` |
| **Jurisdiction enum / Texas gate** (`isTexasMathLease`, `LeaseJurisdiction`, `buildJurisdictionIsolationPrecondition`) | title-math precondition, leasehold federal-exclusion, owners-leases attach gate, research/federal separation, AI context | `vitest run src/types/__tests__/lease-jurisdiction.test.ts src/federal-leasing/__tests__/federal-lease-tracking.test.ts src/components/leasehold/__tests__/leasehold-summary.test.ts` + `projections.ts:131-152` |
| **Map externalRefs / GeoJSON crosswalk** (`map-store.ts`, `feature-tract-matcher.ts`, `geojson-ingest.ts`) | maps, Desk Map (externalRefs written by setFeatureTractMatch — display-only, no ledger), demo auto-match, .landroid mapData | `vitest run src/maps/__tests__/geojson-ingest.test.ts src/maps/__tests__/feature-tract-matcher.test.ts src/maps/__tests__/tract-area.test.ts src/maps/__tests__/tract-reimport.test.ts src/types/__tests__/external-ref.test.ts` |
| **Canvas/flowchart node bridge** (`canvas-store.ts`, `tree-layout.ts`, `flowchart.ts`) | flowchart, Desk Map (live-fraction overlay DA-H8 stale flags), title-math (computeLiveOwnershipFractions), print, autosave | `vitest run src/store/__tests__/canvas-store.test.ts src/engine/__tests__/tree-layout.test.ts src/engine/__tests__/flowchart-pages.test.ts src/storage/__tests__/autosave-change-detection.test.ts` |

**Cross-cutting safety net to run on ANY title-touching change:** `scripts/title-math-baseline.ts` (golden-master), `src/project-records/__tests__/action-parity.test.ts` (MathInputView parity), `src/storage/__tests__/workspace-persistence.test.ts` (.landroid round-trip). Springhill is the oracle fixture — a diff there is ORACLE DRIFT, investigate the fixture before assuming a code bug.

---
## Regression-guard inventory

_The concrete checks that prove a refactor didn't silently break a feature. Every guard below is a real, committed artifact; commands assume the repo root as cwd._

### 1. Read this first — what "green" does and does not prove

The title-math baseline (`scripts/title-math-baseline.ts`) is a **self-consistency / reproducibility lock, not an old-vs-new differential.** Per its own file header (lines 7–31): the Phase-A baselines were once captured from the *real pre-rewrite modules* and the unified engine was verified byte-identical against them at the Phase-F cutover — that history is real. But after cutover the four old modules became shims re-exporting `src/title-math`, so `oldEngineBundle` and `newEngineBundle` resolve to the **same code**, and every feature commit re-froze the baselines from the new engine. A green `--check` today proves the engine **still reproduces a frozen snapshot of itself** — it does **not** prove old == new, and it **cannot fail for a uniform math change**.

It is genuinely useful as a regression lock on the **read path** (leasehold/coverage/node-display numbers). It is **blind** to: (1) any final-output error below the 9th decimal; (2) the mutation ops (`executeConveyance`/`Rebalance`/etc.) and `calculateShare`, which the capture never invokes — those are guarded only by `src/engine/__tests__/math-engine.test.ts`; (3) over-conveyance / double-fraction / stated-fraction features, guarded only by their unit tests. **Do not cite a green baseline as proof the math is correct.**

**The three divergence tolerances** (`src/title-math/__diff__/numbers-diff.ts`), applied to every numeric-string leaf:
- **`byte`** — strings differ but agree at 9 decimal places. Intended structural residue from re-ordered Decimal.js arithmetic; not user-visible. Benign.
- **`value`** — differ at the 9th dp. A real numeric regression. **Fails.**
- **`structural`** — non-numeric leaf changed, a key was added/removed, or array lengths differ (this is also where JSON-*number* count fields like `npriRatificationHoldCount` land). **Fails.**

`oracleClean = (value === 0 && structural === 0)`. The **oracle** is `springhill` (real scrubbed operator data — must stay byte-identical: any divergence fails). `vulcan-mesa` and `raven-forest` are change-detectors (only `value`/`structural` fail; benign `byte` residue is informational). See `src/title-math/__diff__/projects.ts` lines 129–131.

### 2. The inventory

| Guard | Command / File | What it catches | When to run |
|---|---|---|---|
| **Typecheck (lint)** | `npm run lint` → `tsc --noEmit` | Any type-level breakage across the whole `src` tree: renamed fields, changed signatures, dropped enum members. First line of defense for a refactor. | Every change; CI step "Typecheck". |
| **Full unit suite** | `npm test` → `vitest run` | All ~170 `*.test.ts` below. The single command CI gates on. | Every change; CI step "Unit tests". |
| **Engine-only fast loop** | `npm run test:engine` → `vitest run src/engine` | Quick re-run of the math-engine + decimal/format/precision suites without the full tree. | Tight loop while editing `src/engine` or `src/title-math`. |
| **Build** | `npm run build` → `tsc -b && vite build` | Project-references typecheck + a real production bundle (catches Vite/import-graph breakage `--noEmit` misses). | Pre-merge; CI step "Build". |
| **Title-math baseline — oracle byte-identity** | `npm run baseline:check` (i.e. `tsx scripts/title-math-baseline.ts --check`); add `new` to run the NEW engine bundle. Goldens: `fixtures/baseline/{springhill,vulcan-mesa,raven-forest}.json` | Self-consistency lock on the read path. `springhill` (oracle) must be 100% clean; demos fail only on `value`/`structural`. Catches an accidental change to any captured leasehold / coverage / node-display number. Blind below 1e-9, to mutation ops, and to unexercised new-feature fields (see §1). | After any change to `src/title-math`, the leasehold/coverage read path, or capture logic. Re-freeze with `npm run baseline:write` only when a divergence is intended and reviewed. |
| **Baseline harness self-test** | `src/title-math/__diff__/__tests__/baseline.test.ts` | Proves `captureWorkspaceNumbers` is a pure function (same input → byte-identical output via `canonicalJson`) and that the Phase-0 / baseline fixtures load. The harness's own integrity. | Part of `npm test`. |
| **Unified-engine differential lock** | `src/title-math/__diff__/__tests__/differential.test.ts` | Runs the NEW engine bundle against each frozen baseline inside vitest (so the reproducibility lock is enforced in CI, not just the standalone script). `springhill` total must be 0; all projects must be `oracleClean`. | Part of `npm test`. |
| **Phase-0 Vulcan Mesa goldens** | `src/phase0/__tests__/vulcan-mesa-fixtures.test.ts` against `fixtures/phase-0/*` | Freezes end-to-end demo outputs: the `demo.landroid` **SHA-256** (`demo.sha256`), exported workspace shape vs `demo.fixture-manifest.json`, runsheet CSV (`demo.runsheet.csv`), packet manifest, leasehold decimal + transfer-order review (`demo.leasehold-decimals.json`), per-tract coverage summaries (`demo.coverage-summary.json`), warning-dot codes (`['VM2','VM3','VM7']`), v7→v8 orphan-PDF migration, the Raven Forest stress manifest (node counts by class, overlap markers), and the PERF-07 import-stress CSV parse. | Part of `npm test`; the canonical "did anything user-visible move" check. |
| **MathInputView parity** | `src/project-records/__tests__/title-math-parity.test.ts` (+ `action-layer/title-math-parity.ts`) | The Phase-4 cutover gate: math computed from the **action-derived** node set must equal the **live store** AND the Phase-0 goldens — decimal/fraction, lease-allocation order, warning-only states, jurisdiction isolation. Includes a "teeth" test that tampers a live fraction and asserts parity flags it (`parity.clean === false`). No ledger flip is proposable until green. | After any change to the action layer, projections, or title read path. |
| **.landroid round-trip** | `src/storage/__tests__/workspace-persistence.test.ts` (40+ `it`s, e.g. line 603 "round-trips canvas state…") | Export → re-import must preserve nodes, deskMaps, leasehold unit/assignments/ORRIs/transfer-order entries, canvas, documents (with on-import hash recompute, DA-H7), LPRs + multi-tract slices, GeoJSON tract polygons, unit grouping fields. Also version gating: rejects newer-schema / version-less files carrying v8+ markers (DA-L8), drops schema-invalid v9 ledgers but **retains** chain-broken ones for quarantine (DA-H4), and legacy v6/v7 migration. | After any change to persistence, the file format, or a versioned schema. |
| **Soak (shadow, read-only)** | `scripts/title-soak.ts` (`tsx`) | One whole-workspace `createRootNode` mutation → proves the durable ActionRecord is self-sufficient via three checks: replay == adapter, math parity, and a full in-memory `.landroid` round-trip replay. Non-zero exit on any divergence. Diagnostic; not in `npm test`. | Deep verification of the ledger/title trust lane before a cutover. |
| **Pre-deploy / hosted smoke** | `npm run deploy:check` → `scripts/predeploy-check.sh`; `scripts/smoke-test-hosted.sh` | Lambda bundles exist and `npm run package` delegates correctly for `backend/spine` + `backend/ai-proxy`; hosted-asset / CDN sanity. Catches a broken deploy, not a logic regression. | Before deploying. |
| **E2E (Playwright)** | `npm run test:e2e` / `:headed` → `playwright test` | Browser-level smoke of the live app. Not in the default `npm test` or the `ci.yml` gate; lives under `validate`. | Pre-release / when touching UI flows. |
| **Full local gate** | `npm run validate` | `lint && test && build && test:e2e && validate:backend` (backend = spine + ai-proxy: `npm audit --omit=dev`, vitest, `tsc --noEmit`, build). The everything-at-once command. | Before a big merge. |
| **CI** | `.github/workflows/ci.yml` | Two jobs on every PR / push to `main` + typed branch prefixes. **root-app**: `npm ci`, `npm audit --omit=dev`, `npm run lint`, `npm test`, backend-spine install/audit/tests/typecheck, `npm run build`. **ai-proxy**: install, audit, test, build. Note: CI does **not** run `baseline:check`, `test:e2e`, or the soak — those are the `differential.test.ts` (which IS in `npm test`), local, or manual gates. | Automatically on every PR/push. |

### 3. Per-feature vitest suites (what each locks)

Leasehold / title-math core:

| File | Locks |
|---|---|
| `src/components/leasehold/__tests__/leasehold-summary.test.ts` | The heaviest suite (~2957 lines). Tract participation, owner acres, pooled-acre-weighted unit royalty; the three ORRI bases stacked in documented order (`gross_8_8` → `working_interest` → `net_revenue_interest`); WI-basis ORRI = 1/80 of full 8/8 WI independent of royalty rate; assignment unit/tract scoping; over-burden clamp + `overBurdened` flag (finding #9); unleased cost-bearing row so the sheet balances to 100%; NPRI ratification holds (DA-M5), fixed-NPRI-exceeds-royalty counsel hold (DA-H1/F4), open Critical/High curative holds (DA2-C); malformed-input → warn-and-treat-as-0; federal-lease exclusion from Texas math. **The #220 invariant (lines 2898–2955):** "duplicate per-tract lease records yield the SAME math as one record on many nodes" — the math reads lease-*nodes*, not record count, so N identical records on N nodes == one record on N nodes; a future data-model consolidation must be byte-identical here. |
| `src/storage/__tests__/collapse-duplicate-leases.test.ts` | `collapseDuplicateLeaseRecords`: collapses content-identical per-tract records of one instrument and repoints lease-nodes to the survivor; never merges across owners; keeps records differing in any instrument term separate; groups by `leasePurchaseReportId` when present; moves a merged tract's divergent `grossAcres` / `leasedInterest` onto the node (`leaseTractGrossAcres` / `leaseTractLeasedInterest`) so per-tract data survives the collapse; no-op when no dupes. The display-side of #212/#220/#221/#222. |
| `src/components/deskmap/__tests__/deskmap-coverage.test.ts` | `calculateDeskMapCoverageSummary` + `allocateLeaseCoverage`: current/linked/leased/unleased/missing coverage separated; lease-card coverage scoped to the branch holding the lease node; multi-lease allocation in effective-date order with created/updated/id tie-breakers; over-share clipping surfaced as overlap warnings; malformed `leasedInterest` → `clippedFraction: 'malformed'` (audit M-2); inactive-status and non-Texas-jurisdiction exclusion; NPRI branches ignored in mineral totals; temporary over-100% reconciliation; the `canOwnerNodeHoldLease` mineral-only gate. |
| `src/components/owners/__tests__/owner-lease-grouping.test.ts` | The AttachLeaseModal-facing grouping: collapses content-identical per-tract records into one instrument group (display), groups by LPR id ahead of content, counts active instruments with dupes collapsed and inactive excluded. |
| `src/components/leasehold/__tests__/lease-add-targets.test.ts` | `buildLeaseAddTargets`: lists present mineral owners only (excludes NPRI / lease / zero-interest nodes), unleased-first ordering — the candidate list the attach-lease modal renders. |
| `src/engine/__tests__/math-engine.test.ts` | The **mutation-ops** guard the baseline is blind to: `executeConveyance`, `executeRebalance`, `executeCreateNpri`, `executePredecessorInsert`, `executeAttachConveyance`, `executeDeleteBranch`, `calculateShare`, NPRI-branch discrepancy detection — at exact 9-dp Decimal precision (incl. the 100%→0.5 rebalance rippling through three heir generations). |
| `src/engine/__tests__/{decimal,display-format,fraction-display,precision-policy}.test.ts` | Decimal.js wrapper, display formatting, fraction rendering, and the 9-dp precision policy that the whole math layer depends on. |

Storage / persistence / round-trip:

| File | Locks |
|---|---|
| `src/storage/__tests__/workspace-persistence.test.ts` | The `.landroid` round-trip + version gating (detailed in §2). |
| `src/storage/__tests__/blob-serialization.test.ts` | PDF/image blob encode/decode through the file format. |
| `src/storage/__tests__/{workspace-shards,workspace-shard-reader,workspace-shard-writer,workspace-shard-dexie-migration}.test.ts` | Dexie side-store sharding + migration — that a workspace split across shards reads/writes back identically. |
| `src/storage/__tests__/{owner,map,document}-persistence-lazy.test.ts`, `document-store-lazy.test.ts`, `map-persistence-lazy.test.ts` | Metadata-first lazy side-stores (owner/map/document) hydrate correctly. |
| `src/storage/__tests__/{project-workspace-storage-duplicate,project-workspace-storage-fence,workspace-write-lock,workspace-side-store-reset,side-store-db-key,persistence-db-key,active-workspace-key}.test.ts` | Per-workspace DB-key fencing, write-locking, and reset — no cross-workspace bleed. |
| `src/storage/__tests__/{autosave-change-detection,rolling-auto-export,post-v8-backup,content-hash-backfill,saved-project-index}.test.ts` | Autosave change-detection, rolling auto-export, backups, content-hash backfill, project index. |
| `src/storage/__tests__/{csv-io,runsheet-export,seed-test-data,seed-vulcan-mesa via fixtures,federal-lease-seed}.test.ts` | CSV import/export, runsheet CSV shape, seed data integrity. |

Stores (Zustand):

| File | Locks |
|---|---|
| `src/store/__tests__/workspace-store.test.ts` | Core store mutators: `addNodeToActiveDeskMap` idempotency, over-conveyance booking + title-issue raise/persist-failure surfacing (DA-M1/F1), stale active-deskmap repair, active-unit tracking, linked-lease-node refresh on lease update/delete, atomic `batchAttachConveyance` (audit M1), clear-deskmap without deleting shared records (#211 store-mutation guards). |
| `src/store/__tests__/{owner-store,map-store,canvas-store,curative-store,research-store,storage-health-store}.test.ts` | Each side-store: owner upsert-by-id / cascade cleanup; map GeoJSON ingest + dedupe + feature-tract matching/ref movement; canvas shape/import-merge/copy-paste/z-order/`syncOwnershipFractions` overlay (DA-H8); curative, research, storage-health. |
| `src/store/__tests__/title-journal-coverage.test.ts` | **DA-C1 exit gate:** every workspace-store action is classified by the title journal (completeness guard) — a new mutator that isn't journaled fails the suite. |
| `src/store/__tests__/title-journal-verdict.test.ts` | **DA-H3:** verdict plumbing — a `rolledBack` verdict makes mutators fail and skips `removeNode` cascades; a hook exception surfaces as `lastError` without silently dropping the mutation. |
| `src/store/__tests__/{title-action-log,title-action-log-persistence,title-undo-stack,title-read-flip-control,write-lease-store,canvas-change-utils,workspace-store-doc-actions}.test.ts` | Title action log + persistence, undo stack, read-flip control, write-lease store, doc actions. |

Action layer / title ledger (trust lane):

| File | Locks |
|---|---|
| `src/project-records/__tests__/title-math-parity.test.ts` | MathInputView parity (see §2). |
| `src/project-records/__tests__/{title-cutover-readiness,title-cutover-gate,title-command-gate,title-command-sourcing}.test.ts` | Cutover is "ready" only when parity ≥ threshold AND `.landroid` round-trip clean AND no runtime divergence; command sourcing/gating records mutations. |
| `src/project-records/__tests__/{action-audit-chain,action-parity,action-cutover,action-records,action-persistence,action-commands,action-undo-boundary,title-replay,title-divergence,title-read-flip,title-read-flip-governance,title-read-path,title-undo}.test.ts` | Hash-linked audit chain integrity, replay == adapter, undo boundaries, read-flip governance. |
| `src/project-records/__tests__/{evidence-vault,extraction-runs,import-sessions,packet-archive,workspace-record-adapter}.test.ts` | Evidence vault, extraction runs, import sessions, packet archive, the workspace↔record adapter. |

Maps / documents / curative / research / federal / types / AI:

| File group | Locks |
|---|---|
| `src/maps/__tests__/*` (geojson-ingest, feature-tract-matcher, tract-area, tract-export, tract-reimport, geojson-summary, map-asset-upload, plat-pdf) | GeoJSON ingest/summary, acreage-crosswalk feature↔DeskMap matching (#213), tract area, the warn-and-choose re-import (#218), plat PDF. |
| `src/documents/__tests__/*` (document-registry, duplicate-guard, packet-export, bates-stamp) | Document registry rows, duplicate-genesis guard (#210), packet export, Bates stamping. |
| `src/components/deskmap/__tests__/*` (deskmap-tree, deskmap-warning-dots, deskmap-lease-node, deskmap-lease-delete, curative-deskmap-flags) | DeskMap tree, warning dots, lease-node build (`buildLeaseNode` carries per-tract data — #221), lease delete. |
| `src/curative/__tests__/requirement-report.test.ts`, `src/components/leasehold/__tests__/audit-sheet.test.ts` | Curative requirement report, leasehold audit sheet. |
| `src/research/__tests__/*` (rrc-*, formula-starters, research-import-metadata) | RRC delimited/fixed-width parsers, drilling-permit masters, research import metadata. |
| `src/federal-leasing/__tests__/federal-lease-tracking.test.ts` | Federal lease tracking (kept out of Texas math). |
| `src/types/__tests__/*` (lease-jurisdiction, lease-purchase-report, title-issue, node-attachments, depth-range, source-citation, external-ref, research) | Type-level invariants + blank-record factories every other suite builds on. |
| `src/ai/__tests__/*`, `src/ai/wizard/__tests__/*` | Multi-provider chat, read-only-tool gating, approval/undo, import wizard (parse-workbook, row-staging, staged-apply, apply-proposal). |
| `backend/spine/src/__tests__/*`, `backend/ai-proxy/src/__tests__/*` | Backend Lambda handlers, request-policy, usage-store (separate `validate:backend` + the second CI job). |

### 4. The recommended audit sequence

1. `npm run lint` — fail fast on types.
2. `npm test` — the full unit gate (includes the differential reproducibility lock and all Phase-0 goldens).
3. `npm run baseline:check` — confirm `springhill` oracle byte-identity; demos clean of `value`/`structural`.
4. `npm run build` — real bundle.
5. For ledger/title-path refactors only: `tsx scripts/title-soak.ts`.
6. `npm run validate` (or push and let `.github/workflows/ci.yml` run) before merge; `npm run test:e2e` if UI flows changed.

Key file paths: baseline script `/Users/abstractmapping/projects/landroid/scripts/title-math-baseline.ts`; tolerance definitions `/Users/abstractmapping/projects/landroid/src/title-math/__diff__/numbers-diff.ts`; oracle config `/Users/abstractmapping/projects/landroid/src/title-math/__diff__/projects.ts`; goldens `/Users/abstractmapping/projects/landroid/fixtures/baseline/` and `/Users/abstractmapping/projects/landroid/fixtures/phase-0/`; CI `/Users/abstractmapping/projects/landroid/.github/workflows/ci.yml`; scripts in `package.json`.

---
## Regression history & known fragility

_Where refactors have broken features before, and what remains structurally fragile — give these extra scrutiny. Each item names the **break/fragility**, the **coupling** that caused it, and the **guard** that now catches a recurrence (or `UNGUARDED`). Sources: `docs/audit-backlog.md`, `docs/deep-audit-2026-06-10.md` (+part2), `docs/archive/audits/*`, git log._

### The recurring meta-pattern

Three coupling shapes account for nearly every regression below. When reviewing a refactor, check these first:

1. **Display-vs-data duplication** — the same fact (a lease, a tract, an ORRI rate, a fraction) is materialized in two places (record + node, record + card, engine + tooltip, screen + print). A model that stores N rows for one logical thing renders N times; a formula recomputed in the view drifts from the engine.
2. **Ordering-dependent store cascades** — a title mutation fires unlinks/cascades/deletes *after* a rollback or *before* a parity check, so the "safety" step runs against the wrong state.
3. **Scoping keys (`dbKey` / `workspaceId`)** — a helper silently reads/writes the *active* project's scope when it should read an explicit one, or a snapshot/proposal/undo-slot outlives the project switch that should have invalidated it.

---

### A. Leasehold — the lease duplicate-records saga (highest regression density)

**A1. One instrument rendered as N identical Owners-tab cards.** `[GUARDED]`
- **Broke:** Benita Trapp Downey's single OGML covering 4 tracts showed as 4 identical cards; "Leases" stat and "N active" badge over-counted.
- **Coupling (display-vs-data):** legacy model stored **one Lease record per tract** an instrument covered, all sharing a doc number. Both the Springhill generator and the per-tract attach modal minted a record per tract. The Owners tab keyed cards by *record*, not *instrument*.
- **Guard:** `#212` groups by instrument (`groupLeasesByInstrument`, keyed on `leasePurchaseReportId` or a strict content key) — display-only collapse, no Dexie writes; `#221` fixed the data model itself (one record per instrument, fanned to N lease-nodes) with `collapseDuplicateLeaseRecords` migration (Springhill 60→21 records); `#222`/`#0e266f4` made `AttachLeaseModal` mint one record per instrument at create time. Locked by `#220` regression test ("duplicate per-tract lease records don't inflate the math") + the title-math byte-identity baseline (byte=0 verified on all three projects).
- **Note:** the *math* was never wrong here — royalty/NRI are summed per owner-node-per-tract, never per record. This was purely display, but it recurred across four PRs because the fix had to climb from display → data model → create path.

**A2. Lease attached via Owners form then desk-map button = silent no-op node.** `[GUARDED]`
- **Broke:** a tract slice with an `existingLeaseId` but no `existingLeaseNodeId` updated the record then skipped node creation; no lessee node appeared, and the panel offered "Create Tract N" forever.
- **Coupling:** the `addNode`+`addNodeToDeskMap` path lived **only** in the brand-new-lease branch; the update branch guarded node creation behind `if (tract.existingLeaseNodeId)`. Two creation orders, one code path missing.
- **Guard:** `#142` materializes the missing node in the update branch (same id pattern, `buildLeaseNode`). The `#221` normalizer gate ties the two lease-node predicates together so they "can't drift."

**A3. Audit Sheet pre-WI derivation didn't reconcile to its own result.** `[GUARDED]`
- **Broke:** the printed/tooltip derivation subtracted the **full** fixed-NPRI burden (`Leased − Royalty − Fixed NPRI − ORRI`), but the engine (post DA-H1) charges only the fixed-NPRI **excess** over the lessor royalty. On any fixed-NPRI tract the shown steps (~0.75) disagreed with the result line (0.80) — exactly the "show your work" an examiner hand-checks.
- **Coupling (engine-vs-display recompute):** the formula builder reimplemented the derivation by hand instead of reading the engine's intermediate values.
- **Guard:** `#205` rewrote the builder to mirror the engine. **Still fragile** — see C2 (formula tooltips remain a hand-rolled parallel implementation; DA-M6 says they "lie exactly when they matter").

**A4. Map-mode ORRI branch card double-counted unit-scope ORRIs.** `[GUARDED]`
- **Broke (DA-H9):** the branch-card "Total" summed each tract's `unitDecimal`, but a unit-scope ORRI's `unitDecimal` is already the **sum across all scoped tracts** — so with ≥2 tracts two "tract ORRI" numbers on the same screen disagreed and the total overstated.
- **Coupling:** two different per-tract ORRI computations on one screen (DA-M7: a "second derivation path … third copy in the view").
- **Guard:** `#158` uses the tract's own `unitOrriDecimal`; display-only, no golden change. The duplicate recompute path (DA-M7) was collapsed in `#168`.

### B. Title ledger / cutover — ordering and scope cascades

**B1. Two live store actions deleted title nodes without journaling (DA-C1, Critical).** `[GUARDED]`
- **Broke:** clear-tract and delete-tract mutated title state without going through the journal chokepoint, so in cutover mode the store silently diverged from the ledger; per-mutation parity stayed green because both before/after snapshots **baked the drift in**. The flip also self-armed (`cutoverEnabled: true` hardcoded; auto-flip on rising-edge readiness with a constant "reviewer token").
- **Coupling (ordering + the "single chokepoint" invariant being false):** Scope B's entire safety story was "every mutation flows through one chokepoint" — two didn't.
- **Guard:** journal coverage extended to all eight title-visible actions; the **journal-coverage test is now the permanent CI invariant**; auto-flip disarmed pending the coverage test (`#210`, prior Scope-B hardening). `createDeskMap` with `initialNodeIds: []` remains a journal-free path an AI tool touches — kept pinned by test.

**B2. Cutover rollback incomplete — cascades fire after rollback (DA-H3).** `[GUARDED]`
- **Broke:** after a rollback restored nodes, unconditional `cascadeDeleteDocsForRemovedNodes` + map/curative unlinks + `cleanupOwnerRecordsForRemovedNodes` still ran, **permanently deleting the restored nodes' docs and records**. Mutators returned success for rolled-back ops; a throwing parity hook was swallowed by `try/catch → console.error('… (ignored)')`, skipping rollback entirely.
- **Coupling (ordering):** the side-effect cascade was sequenced after the journal call regardless of the journal's verdict.
- **Guard:** `feat/scope-b-hardening` made the journal verdict part of the mutation result (rollback-aware mutators; cascades skipped on veto; hook exceptions surfaced).

**B3. "Undo last AI change" / any `loadWorkspace` silently destroyed the durable ledger (DA-H2).** `[GUARDED]`
- **Broke:** `restoreSnapshot`→`loadWorkspace` reset the live ledger; the append-only undo machinery had **no live caller**. A later save wrote a ledger-free file.
- **Coupling:** import path hydrated the ledger via a `mirrorLoadedTitleLedger` call in `Navbar`, but the undo/lifecycle path didn't — the mirror lived **outside** the lifecycle helper, so any new caller silently re-baselined.
- **Guard:** `feat/scope-b-hardening` — undo hydrates-then-appends via `undoTitleActionRecord`; `importAndOpenWorkspace` owns import ledger hydration. **Precedent regression:** the identical bug (ACT-M05/ACT-H04) already happened once — v9 import validated an embedded `actionLedger` but never hydrated it, and `loadWorkspace` reset the live ledger, so the next save dropped the chain (fixed `#102`, regression test added).

**B4. Ledger flush skipped under continuous editing; tamper evidence logged then erased (DA-H4/H5).** `[PARTIAL]`
- **Fragile:** persist ordering is shard-save → generation guard `if (saveGeneration !== workspaceSaveGeneration) return;` → ledger flush, so a perpetual-typing session persists shards repeatedly while **skipping the ledger flush**. Invalid stored chains are `console.warn`-ed then rewritten fresh (`baselineAndFlushTitleLedger`) — tamper evidence destroyed. The audit hash chain does **not cover the ActionRecord payloads** replay actually uses (DA-H5).
- **Guard:** DA-H5 payload hashing landed (`#185`); DA-H4 flush-ordering/stale-chain hydration **still open** (Step 2+). Flagged in backlog as the multi-tab amplification (DA-M15): `replaceTitleLedgerWorkspaceRows` does `delete()`+`bulkPut` with **no lease check**, reachable from a reader tab — a read-only tab can clobber the writer's ledger.

**B5. Cross-workspace stale AI state survived project switch (confirmed HIGH).** `[GUARDED]`
- **Broke:** opening another saved project hydrated workspace/side-stores/ledger but left the **AI approval queue, undo snapshot, and action journal pointed at the project being left**. Two data-loss hazards from normal clicks: (1) an approved-in-B stale proposal writes A's record into B; (2) restoring A's undo snapshot while B is active calls `loadWorkspace(A)` and autosave overwrites B on disk.
- **Coupling (scope):** the import/demo/new-project path cleared these via `finalizeWorkspaceSideStoreReplacement`; the **open-saved-project path (`applyLoadedProject`) hydrated side-stores directly and never did**.
- **Guard:** `#203` — `applyLoadedProject` calls `clearTransientAIState()` before load on every open path; defense-in-depth `restoreSnapshotWithLedger` refuses when the snapshot's `workspaceId` ≠ active workspace. Tests pin both.

### C. Title-math engine & precision

**C1. Silent over-conveyance cap (DA-M1, Medium).** `[UNGUARDED — by design, but hides Duhig]`
- **Fragile:** a fraction-mode deed reciting "an undivided 3/4 of the whole" against a grantor holding 1/2 is **silently rewritten to "convey 1/2"** — the preview shows the capped number but nothing flags that the request exceeded capacity, contradicting the operator's stop-and-ask convention and hiding exactly the over-conveyance/Duhig cases a landman must adjudicate.
- **Coupling:** the cap lives in the engine's remainder math with no warning channel to the UI.
- **Guard:** over-100% is warned in the coverage card (`#167`), but the fraction-mode silent cap itself is **not surfaced**. Flagged #1 in the Texas-math gap matrix.

**C2. `addNode`/`updateNode` bypass all engine validation (DA-M2 / LLA-H03).** `[UNGUARDED]`
- **Fragile:** Desk Map "Add Root" uses raw `addNode`, which admits negative fractions, duplicate ids, and cycles via crafted `parentId` — none of which the validation layer would allow, and all of which get **faithfully journaled as invalid state**.
- **Coupling:** two write paths into the node set (validated engine ops vs raw store `addNode`); the raw path skips `validateCalcGraph`.
- **Guard:** coverage card warns on over-100/multi-root, but structural invalids (negative/dup/cycle) are not stopped. Confirmed **still open** post-merge.

**C3. CSV import round-before-store (DA-H10).** `[GUARDED]`
- **Broke:** CSV fractions parsed through float64 + `toFixed(9)` into persisted node fractions — `1/3` stored lossy; the "one true round-before-store defect."
- **Guard:** `#156` parses via the strict Decimal parser + `serialize` at full precision; out-of-range/malformed values now reject.

**C4. Display-precision erosion across ~60 render sites.** `[GUARDED by grep, PARTIAL by policy]`
- **Fragile:** only one screen renders through the sanctioned `FractionDisplay`; the dominant Leasehold/DeskMap formatters use 2dp percent / hand-rolled `toFixed`, and tooltips reimplement formatting (DA-M6: "tooltip fraction helper can't render thirds").
- **Guard:** `#163` display-format migration + a grep guard; an ESLint `no-restricted-syntax` ban on `.toFixed(` in `views/`+`components/` is the proposed permanent lock. Formula tooltips remain a parallel hand-rolled implementation (the A3/C2 recompute-drift class).

**C5. Lenient parser must never gate a save (DA-U5/DA-L2).** `[GUARDED by comment only]`
- **Fragile:** `normalizeInterestString` runs the **lenient** parser + `serialize`, so any save path that adopts it would silently coerce garbage to `0.000000000`. `d()` similarly coerces malformed stored fractions to `0` inside `toCalc`.
- **Guard:** `#170` added a doc-comment warning it must never gate a save (the strict parser exists for that). No structural guard — a future dev can still wire it into a save path.

### D. Storage / import-export / project lifecycle

**D1. Duplicate project silently omitted tables (confirmed HIGH).** `[GUARDED]`
- **Broke:** `duplicateProjectStorage` copied owner/lease/map-asset/research/document tables but **silently omitted `db.canvasAssets`** (flowchart images) and **`db.mapTractFeatures`** (GeoJSON polygons) — a routine "Duplicate project" produced broken image nodes and missing tracts.
- **Coupling (scope/enumeration):** the copy hand-enumerated tables; new side-stores (added later by separate features) weren't added to the list.
- **Guard:** `#204` copies both tables; test **pins which tables the duplicate copies**. The ledger is *deliberately* excluded (its hashes are `workspaceId`-bound) — `#210` seals the source's ledger head into the duplicate's genesis baseline so chain-of-custody stays tamper-evident without replaying history.

**D2. `.landroid` export silently dropped unattached documents (DA-H6).** `[GUARDED]`
- **Broke:** export collected only `document_attachments.where('entityKind').equals('node')` ∩ current node ids; import/undo/side-store reset then **deleted every workspace-scoped doc and re-added only the supplied (node-attached) set** — so any "Unlinked" doc (an advertised state) was permanently destroyed on round-trip.
- **Coupling (scope mismatch):** export scope (node-joined) ≠ restore-side delete scope (workspace-scoped).
- **Guard:** `#152` made `exportDocumentWorkspaceData` workspace-scoped so export scope matches delete scope; round-trip test for non-node/unattached docs.

**D3. Document hashes write-once, never re-verified; import accepts empty hash (DA-H7).** `[GUARDED]`
- **Broke:** import trusted the file's `contentHash` (`typeof raw.contentHash === 'string' ? raw.contentHash : ''`) with no recompute; one legacy doc with `''` would later brick the whole vault projection (`requireContentHash` throws on blank).
- **Guard:** `#153` recomputes SHA-256 on import/export with a fixity warning; `#155` one-time `''` backfill at Dexie open (non-blocking, self-extinguishing, idempotent).

**D4. Future-version `.landroid` rejection bypassable by a non-numeric version (DA-L8).** `[GUARDED]`
- **Broke:** the version gate threw only when `typeof parsed.version === 'number'`, so `version: "99"` or a missing version fell through to the legacy v0/v7 path. Owner-docs/map-assets/research imports were spread with extra keys preserved while owners/contacts got field-by-field normalization.
- **Guard:** `#174` rejects non-numeric/missing version on files with v8+ markers; `#178` field-picks the three raw-spread stores.

**D5. v7→v8 migration awaited foreign promises inside the upgrade transaction (DA-M10).** `[GUARDED]`
- **Fragile:** `await migratePdfsToDocuments` (per-row `blob.arrayBuffer()` + `crypto.subtle.digest`) ran inside `.upgrade()` without `Dexie.waitFor` — real IndexedDB can deactivate the version-change transaction mid-way on large PDF sets; fake-indexeddb tests don't enforce liveness (so the test suite couldn't catch it).
- **Guard:** `#171` keeps the migration transaction alive + drops dangling attachments.

**D6. Side-store rollback could leave mixed state (LLA-M01).** `[GUARDED]`
- **Fragile:** parallel side-store replacement could keep mutating *after* rollback started; a failed import mixed old and new side-store data.
- **Coupling (ordering):** rollback didn't wait for in-flight target writes to settle.
- **Guard:** rollback wrapper now waits for target writes to settle; tests exercise delayed target writes. Broader storage isolation (LLA-H01/H02) noted as remaining.

**D7. Single-writer lease has no heartbeat (DA-M14).** `[GUARDED]`
- **Fragile:** an idle writer silently lost the lease 15s after its last save; a demoted tab stranded unsaved edits.
- **Guard:** `feat/scope-b-hardening` added a writer heartbeat at TTL/3 with visibility pause. (Ledger writes still bypass the fence — see B4/DA-M15.)

### E. Maps / GIS

**E1. Re-importing the same GeoJSON stacked duplicate tracts.** `[GUARDED]`
- **Broke:** each ingest minted a fresh asset, so re-importing the same file stacked a **second copy of every tract**; separately, two same-tract features lacking GlobalID/ObjectID shared a `tract:{key}` id and **stacked in memory, rendering the tract twice**.
- **Coupling (display-vs-data + idempotency):** ingest was append-only with no dedup; in-memory set didn't match the Dexie-persisted batch.
- **Guard:** `#211` dedupes features by id (last wins) so memory matches persistence; `#218` warn-and-choose on re-import (`detectTractReimport`, ≥70% key overlap) — "Replace earlier copy, or keep both layers?" Wired into both Import GeoJSON and Load-sample-tracts. Tests pin detection + dedup.

**E2. `mapTractFeatures` dropped on export/import round-trip (DA2-M).** `[GUARDED]`
- **Broke:** the v16 GeoJSON tract polygons didn't survive `.landroid` export/import (Codex audit).
- **Guard:** `#202` carries `mapTractFeatures` through round-trip; `#184` hashes map assets on save.

**E3. Orphan regions/references survive import unvalidated (DA2-M5).** `[UNGUARDED]`
- **Fragile:** a region's `assetId` is never checked against imported assets — orphan regions become **invisible, undeletable, and exported forever**. Mirror: deleting research records leaves dangling map→research pointers (DA2-M6/R4).
- **Guard:** none. Open backlog.

### F. Research / Curative — the cascade-and-optimistic-write class

**F1. Optimistic updates with no rollback (DA2-R1).** `[GUARDED]`
- **Broke:** every research `update*` mutated Zustand first then awaited Dexie with no catch; a fence-lost/failed write left the screen **showing an edit the DB never took** — silent-data-loss illusion on the surface meant to hold legal research.
- **Guard:** `#165` reverts optimistic edits on persist failure.

**F2. One-way link rot — deletes don't clear cross-store pointers (DA2-R3/R4, DA2-C cascades).** `[PARTIAL / UNGUARDED]`
- **Fragile:** deleting owners/leases/nodes/maps **never clears research `links.*`** (cleanup exists only research→research and on import); curative unlink cascades are fire-and-forget with no catch inside a reducer (DA2-C5) → memory/DB divergence on fence loss.
- **Coupling (cross-store cascade):** new link types (research, curative, map) must each be added to **every** delete cascade site (`workspace-store.ts:792-807,1187-1215`; `owner-store.ts:195-247`) — adding a link type without touching all cascade sites silently leaks pointers. This is the same cascade pattern as B2.
- **Guard:** the curative/map cascades exist; research unlink calls are **not yet** wired into those sites. Open.

**F3. Stale-form resurrection re-writes a deleted link on Save (DA2-C4).** `[UNGUARDED]`
- **Fragile:** a curative form held open across an external change (AI `deleteNode`→`unlinkNode`) **re-writes the stale link on Save**; unsaved edits are silently discarded on selection/filter change with no dirty check.
- **Guard:** none (proposed: dirty guard + merge-on-save). Open.

**F4. "Used By" rows silently dropped on duplicate labels (#215).** `[GUARDED]`
- **Broke:** `LinkedSummary` keyed each row by `${meta}-${label}`, so two records sharing a label+meta **collided on their React key and one was silently dropped** — the inverse of the duplicate-render class (render-too-few instead of too-many).
- **Coupling (display-vs-data):** a React key derived from non-unique display fields. The mirror image of A1.
- **Guard:** `#215` suffixes the key with the array index (display-only list, so an index key is safe).

### G. Flowchart / canvas

**G1. Stale fractions on the canvas after any title mutation (DA-H8).** `[GUARDED]`
- **Broke:** placed canvas nodes showed fractions captured at placement time; a **printed chart could disagree with the workspace**.
- **Guard:** `#159` rebuild — a reactive overlay recomputes interest from live title nodes onto placed nodes; deleted nodes get a "Stale" badge on screen and in print.

**G2. Re-import will wipe annotations once drawing tools are wired (DA2-F3).** `[UNGUARDED — latent]`
- **Fragile:** `importGraph` replaces the whole canvas while `applySpacingFactors` deliberately preserves non-ownership nodes — **contradictory policies**. The moment drawing tools (DA2-F1, dead today) are enabled, re-import destroys user drawings. Print also force-casts all nodes to `OwnershipNodeData` (DA2-F4) and screen/print card colors are maintained twice (hardcoded hex in two places — a display-vs-data duplication).
- **Guard:** none yet (proposed: merge-import by id + a print renderer registry keyed by node type). Latent until F1 ships.

### H. AI assistant

**H1. Hosted prompt claimed tools the deployed build can't call (#209/DA-M3 family).** `[GUARDED]`
- **Broke:** the single shared `LANDROID_SYSTEM_PROMPT` told the model it had ~20 mutating tools, an approval queue, and undo — but the **hosted proxy posts no tools and always returns `toolCalls: []`**, so the deployed model narrated edits it physically cannot make.
- **Coupling:** one prompt string shared across two capability modes (local-with-tools vs hosted-advisory).
- **Guard:** `#209` splits the prompt by build (`buildLandroidSystemPrompt({ toolsAvailable })`); the tool-build prompt stays byte-identical to the Phase-0 golden.

**H2. Ledger provenance flattened — every mutation recorded `origin:'user'` (DA-M3 / ACT-M01).** `[UNGUARDED]`
- **Fragile:** the AI-gate assertion never sees an `origin:'ai'` at runtime; AI/import-originated mutations are indistinguishable from user ones in the ledger.
- **Guard:** none (proposed: thread `origin` through `journalTitleMutation` via a race-free `withMutationOrigin` wrapper). Confirmed live, **open** post-merge.

**H3. Approval-preview staleness / TOCTOU (DA-M12).** `[PARTIAL]`
- **Fragile:** the UI renders the proposal-time preview; a recheck at approve-time can pass while the numbers shown are stale, and `captureSnapshot` sits between recheck and execute.
- **Guard:** `#172` keeps approval-card previews live and re-checks before execute; `#211` made approve re-entrancy-safe (a fast double-trigger applies/journals once). The render-vs-recheck window is narrowed, not closed.

**H4. Hosted read-only tool leaked a side effect (`setActiveDeskMap`).** `[GUARDED]`
- **Broke (archived audit):** `setActiveDeskMap` was reachable through the hosted "read-only" subset despite mutating focus state.
- **Guard:** closed + a regression test enumerating read-only tools with side effects (`read-only-tools.test.ts`).

### I. Cross-cutting / product

**I1. Lease document generator — "worked previously, then broke" (DEF-LEASE-01).** `[UNGUARDED — deferred]`
- **Broke:** filling field data into the blank Producers 88 reflowed the entire document.
- **Coupling:** the `.docx` has no content controls/form fields, so naive text insertion into raw paragraph runs reflows layout.
- **Guard:** none — deferred to a structured-template / run-preserving-replacement rebuild. Explicitly do **not** insert into raw runs. Template at `docs/lease-generator/`.

**I2. CI does not run Playwright e2e (LLA-M12 / F4).** `[UNGUARDED — structural gap]`
- **Fragile:** PR CI runs `npm test` (unit) but **not** the browser e2e suite, and five high-value workflows (export/import with PDFs, branch-scoped lease deletion, curative linkage, research linkage) sit **skipped** in `tests/e2e/landroid-workflows.spec.ts`. The most operationally important cross-store paths — exactly where the cascade/scope regressions above live — can regress invisibly.
- **Guard:** none in CI (e2e is local release/checkpoint validation only). This is the single biggest unguarded structural gap: the regression classes most likely to recur (cross-store cascades, round-trip, scope) are the least covered by automated gates.

**I3. Jurisdiction leakage into Texas math (archived AUDIT_REPORT).** `[GUARDED]`
- **Fragile (historical):** `federal`/`private`/`tribal` lease jurisdictions were stored but not filtered out of active coverage/leasehold math — a path for reference-only data to affect Phase-1 Texas math.
- **Guard:** federal leasing now isolated at six independent layers (jurisdiction discriminator → coverage gate → MathInputView precondition → AttachLeaseModal block → store backstop → AI tool/preview blocks), each cited and tested; the Texas-math boundary holds (deep-audit part2 §5).

---

#### How to use this section in a refactor review
- **Touching a store mutation?** Check B2/F2: does every delete/unlink cascade run *after* a possible rollback, and does it cover *all* link types (research, curative, map, document, owner)?
- **Touching a scoping helper?** Check B5/D1: does it read the *active* `dbKey`/`workspaceId` when it should take an explicit one (the `listTitleLedgerWorkspaceRows` bug in `#210`)?
- **Touching a record that has both a record and a node/card?** Check A1/F4: is anything keyed by a non-unique display field, or counted per-record instead of per-instrument?
- **Touching a formula shown to the user?** Check A3/C2: is the displayed derivation reading engine intermediates, or re-deriving by hand?
- **Adding a side-store / table?** Check D1: add it to `duplicateProjectStorage`, the export/import set, and every delete cascade — and pin the membership with a test.

---

Key source files for this section: `/Users/abstractmapping/projects/landroid/docs/audit-backlog.md`, `/Users/abstractmapping/projects/landroid/docs/deep-audit-2026-06-10.md`, `/Users/abstractmapping/projects/landroid/docs/deep-audit-2026-06-10-part2.md`, and `/Users/abstractmapping/projects/landroid/docs/archive/audits/` (AUDIT_REPORT.md, AUDIT_REPORT_CODEX_FULL_2026-05-14.md, AUDIT_COMPARISON_CODEX_CLAUDE_2026-05-14.md, DEPLOYMENT_READINESS_AUDIT.md).

---
## Feature-by-feature detail

_Each feature: what it reads (upstream), what reads it (downstream), the contracts it shares, the guards that lock it, and its known traps._

**Contents:** [Desk Map (Title Tree)](#desk-map-title-tree) · [title-math: unified title-ownership and leasehold calculator engine](#title-math-unified-title-ownership-and-leasehold-calculator-engine) · [owners-leases](#owners-leases) · [leasehold](#leasehold) · [runsheet-documents](#runsheet-documents) · [maps](#maps) · [Curative: Title Issue Tracking & Defect Workflow](#curative-title-issue-tracking-defect-workflow) · [research](#research) · [federal-leasing](#federal-leasing) · [AI feature area](#ai-feature-area) · [persistence-lifecycle](#persistence-lifecycle) · [flowchart-salesdeck](#flowchart-salesdeck)

### Desk Map (Title Tree)

*View: Desk Map / DeskMapView*

The source-of-truth ownership-node tree for title chains. Manages the hierarchical ownership structure, lease attachments, NPRI branches, document links, and all title-math inputs (node.fraction, node.initialFraction, conveyance parameters, royalty/ratification metadata). Renders the title tree as an interactive card hierarchy with pan/zoom, editable nodes, and atomic math mutations.

- **Source of truth:** Zustand workspace-store: `nodes[]` + `deskMaps[]` arrays. Dexie document-attachments and side-store links. Title-action ledger for mutations (shadow/durable path). IndexedDB autosave for workspace snapshots.
- **Key files:** `src/views/DeskMapView.tsx`, `src/store/workspace-store.ts`, `src/types/node.ts`, `src/components/deskmap/DeskMapCard.tsx`, `src/components/deskmap/DeskMapLeaseCard.tsx`, `src/components/deskmap/DeskMapNpriCard.tsx`, `src/components/deskmap/deskmap-lease-node.ts`, `src/components/deskmap/lease-helpers.ts`, `src/components/deskmap/deskmap-tree.ts`, `src/title-math/calculators/coverage.ts`, `src/store/title-undo-stack.ts`, `src/storage/workspace-persistence.ts`, `src/storage/undo-cascade-bundle.ts`
- **Depends on** — changing these can break *this* feature:
  - **Title Math Engine (ownership.ts)** — executeConveyance, executeCreateRootNode, executeCreateNpri, executePredecessorInsert, executeAttachConveyance, executeDeleteBranch, executeRebalance, rootOwnershipTotal, validateOwnershipGraph — all math mutations read/write node.fraction, node.initialFraction, node.conveyanceMode, node.splitBasis, numerator/denominator, node.interestClass, node.royaltyKind, node.fixedRoyaltyBasis; desk-map coverage calls these
  - **Owner Store (owner-store.ts)** — Lease records linked via node.linkedLeaseId; owner records linked via node.linkedOwnerId. syncLeaseNodesFromRecord updates lease-node grantee/remarks/dates when Lease changes. attachLease creates lease-nodes with parent linking
  - **Leasehold Review (calculators/leasehold.ts + components/leasehold/)** — Reads node.fraction (ownership), node.royaltyKind (NPRI type), node.fixedRoyaltyBasis (deed basis), node.ratificationStatus, node.leaseTractLeasedInterest (per-tract override), node.linkedLeaseId, linkedOwnerId for lease/NPRI math; consumes coverage calculator outputs
  - **Document Registry (document-store.ts, Documents view)** — node.attachments[]: NodeAttachmentSummary cache (docId, attachmentId, fileName, kind); cascades deletes when nodes removed; Dexie documents + document_attachments tables are source of truth
  - **Curative Issues (curative-store.ts, Curative view)** — Links to nodeIds, ownerId (via linkedOwnerId), leaseId (via linkedLeaseId); curative flags appear as dots on Desk Map cards via npriDiscrepancyNodeIds, npriDiscrepancyCountByBranchNodeId from findNpriBranchDiscrepancies
  - **Maps (map-store.ts, Maps view)** — deskmap-coverage-summary provides coverage totals displayed in coverage panel; map regions can link to deskmap ids/nodeIds (externalRef hookup in DA2-M)
  - **Flowchart Canvas (canvas-store.ts, Flowchart view)** — buildDeskMapTree recursively transforms nodes + deskMaps into canvas import; deleted nodes get 'Stale' badge via reactive overlay from live title
  - **Precision Boundaries (engine/decimal.ts, title-math/precision/emit.ts)** — fraction/initialFraction stored as Decimal-serialized strings; parseStrictInterestString parses lease.leasedInterest, node.leaseTractLeasedInterest; emitRate/emitRawRate format decimals for display
  - **Title-Action Ledger (title-action-log.ts, action-layer/)** — Mutations journaled through journalTitleMutation; title-undo-stack captures before-snapshot + cascadeBundle; read-flip governed by title-read-flip.ts (default-off shadow)
  - **AI Approval Layer (ai/approval-preview.ts, ai/tools.ts)** — Proposed edits include node mutations; preview uses workspace-store getActiveDeskMapNodes; approval captures undo snapshot
- **Consumed by** — changing *this* feature can break these:
  - **Leasehold View (components/leasehold/)** — Reads nodes, deskMaps, activeUnitCode; LeaseholdOrri, LeaseholdAssignment, LeaseholdUnit, LeaseholdTransferOrderEntry; calls calculateDeskMapCoverageSummary, buildLeaseScopeIndex; filters deskMaps by unitCode
  - **Runsheet View (components/runsheet/)** — Renders nodes + linked docs + leases; calls getActiveDeskMapNodes, builds runsheet rows from minerals + npris + leases
  - **Documents View (views/DocumentsView.tsx)** — node.attachments[] cache; listAttachmentsForNodes to populate Dexie before delete
  - **Owners View (views/OwnerDatabaseView.tsx)** — linkedOwnerId cross-reference; owner-lease-deskmap.ts enumerates Desk Map lease nodes per owner; syncLeaseNodesFromRecord updates nodes when lease changes
  - **Curative View (views/CurativeView.tsx)** — Links to nodeIds, renders deskmap flags via npriDiscrepancyNodeIds + curative title issue links; open Desk Map navigation
  - **Flowchart View (views/FlowchartView.tsx)** — buildDeskMapTree imports active deskmap; tree-layout.ts positions nodes
  - **AI Chat (ai/app-context.ts, ai/tools.ts, ai/approval-preview.ts)** — app-context builds bounded project summary including activeUnitCode, activeDeskMap detail, all-tract counts; tools propose convey, createRootNode, createNpri, etc.; approval-preview simulates mutations on workspace state
  - **Workspace Serialization (storage/workspace-persistence.ts, csv-io.ts)** — WorkspaceData = {nodes[], deskMaps[], activeUnitCode, activeDeskMapId}; normalizeDeskMap/normalizeOwnershipNode during load; exportLandroidFile serializes for .landroid; CSV import via createRootNode + convey
  - **Write Lease (write-lease-store.ts, READ_ONLY_WORKSPACE_EDIT_TITLE gate)** — Lease tabs marked read-only via useWorkspaceReadOnly; mutations check write-lease before journaling
  - **Project Records (project-records/)** — workspace-record-adapter projects nodes into MathInputView for action-layer parity testing; title-projection computes output for action-replay
- **Shared contracts / invariants:**
  - OwnershipNode shape: id, type, parentId, fraction/initialFraction (Decimal-string), linkedOwnerId, linkedLeaseId, relatedKind, interestClass, royaltyKind, fixedRoyaltyBasis, ratificationStatus, doubleFractionClause, depthRange, leaseTractLeasedInterest/leaseTractGrossAcres (lease-node only), attachments (NodeAttachmentSummary[]); normalizeOwnershipNode ensures consistency
  - DeskMap shape: id, name, code, nodeIds[], unitCode?, unitName?, grossAcres, pooledAcres, description; normalizeDeskMap ensures unitCode/unitName optional (byte-identity for pre-overhaul workspaces)
  - NodeAttachmentSummary: docId (UUID), attachmentId (UUID), fileName, kind (DocumentKind); sync'd from Dexie documents + document_attachments
  - Coverage totals: currentOwnership (found), linkedOwnership (linked to owner), leasedOwnership (covered by active lease), leaseOverlaps (warn-only clipping); separate counts per category
  - Lease-node invariant: type='related' && relatedKind='lease' imply parentId points to mineral owner; leaseTractLeasedInterest/leaseTractGrossAcres only present when non-empty (byte-identity)
  - NPRI branch invariant: interestClass='npri' && royaltyKind in ('fixed', 'floating'); fixed NPRI requires fixedRoyaltyBasis in ('burdened_branch', 'whole_tract'); ratificationStatus defaults to 'unknown'
  - Title-mutation invariant: all mutations journaled via journalTitleMutation; undo captures before-snapshot + cascade bundle; ledger remains append-only; store==ledger at steady state
  - Unit focus boundary: deskMaps filtered by activeUnitCode; ORRIs/assignments scoped by unitCode; unit-focus selector switches activeUnitCode; unit-wide linked leases apply only to activeUnitCode owners
  - Math input contract: MathInputView projection keeps node.fraction, node.initialFraction, numerator/denominator, conveyanceMode, splitBasis, interestClass, royaltyKind, fixedRoyaltyBasis, node.linkedLeaseId stable and synchronized with live workspace-store
  - Write-lease protection: READ_ONLY_WORKSPACE_EDIT_TITLE title requires active workspace write-lease before any mutation; mutations fail closed if lease expired or revoked
- **Guards:**
  - **Desk Map math parity (MathInputView)** (`src/project-records/__tests__/action-parity.test.ts`) — Any divergence in node.fraction, node.initialFraction, conveyance parameters, or royalty/ratification metadata between workspace-store and action-layer replay
  - **Coverage formula validation** (`src/components/deskmap/__tests__/deskmap-coverage.test.ts`) — currentOwnership, linkedOwnership, leasedOwnership totals; lease-scope index per-tract override (leaseTractLeasedInterest); clipping warnings
  - **Lease-node building** (`src/components/deskmap/__tests__/deskmap-lease-node.test.ts`) — buildLeaseNode propagates per-tract leasedInterest/grossAcres; grants relatedKind='lease'; preserves existing node values on re-sync
  - **Lease deletion cascade** (`src/components/deskmap/__tests__/deskmap-lease-delete.test.ts`) — Deleting only lease-node for an owner removes lease from Owners; shared leases stay when other nodes still use them
  - **Undo/redo stack** (`src/store/__tests__/title-action-log.test.ts + title-undo-stack usage`) — Before-snapshot restore; cascade bundle re-apply for destructive mutations; redo hand-back to undo; new mutation clears redo stack
  - **Workspace persistence round-trip** (`src/storage/__tests__/workspace-persistence.test.ts`) — normalizeOwnershipNode byte-identity for non-overhaul fields; optional unitCode/unitName/attachments serialization; leaseTractLeasedInterest/leaseTractGrossAcres only when non-empty
  - **Cascading document cleanup** (`src/storage/__tests__/undo-cascade-bundle.test.ts + document-store usage`) — cascadeDeleteDocsForRemovedNodes removes only docs with no surviving entity links; shared docs stay when other nodes/entities reference them
  - **Title-journal coverage** (`src/store/__tests__/title-journal-coverage.test.ts`) — All user mutations (convey, createRootNode, createNpri, attachConveyance, deleteBranch, insertPredecessor, attachLease, updateNode) journaled; undo applies journal inverse; no silent mutations
  - **NPRI branch discrepancies** (`src/title-math/model/__tests__/graph-ops.test.ts (if exists) or integration`) — findNpriBranchDiscrepancies detects over-carve, under-carve, orphan NPRIs; surfaces warnings on Desk Map via npriDiscrepancyNodeIds
  - **.landroid import round-trip** (`src/phase0/__tests__/springhill-sample.test.ts + playwright e2e`) — Raven Forest demo export/import preserves all nodes, deskMaps, unitCode/unitName, attachments, documents, leases, curative, maps, research; no silent field loss
  - **CSV import validation** (`src/storage/__tests__/csv-io.test.ts`) — Fractions parse via strict Decimal + interest-string parser; over-capacity conveyances reject; non-numeric fractions stop import; empty/0 root rejects
  - **Delete branch — interest restoration** (`src/engine/__tests__/math-engine.test.ts (legacy) or unified title-math tests`) — Deleting conveyance branch restores deleted amount back to parent; parent fraction recalculates; grandparent and heirs remain unchanged
  - **Owner record cleanup on node delete** (`src/storage/undo-cascade-bundle.ts:planOwnerRecordCleanup`) — Owner/lease records removed only when no surviving nodes link them; shared owners stay when another tract still uses them
- **Known fragility / refactor traps:**
  - DA-H7 (#155): contentHash backfill — legacy blank contentHash rows healed at startup (one-time, idempotent); any stale doc attachments show an import-badge until re-export
  - DA-M1 (over-conveyance cap, #180): node.statedFraction records the deed's claimed amount; node.fraction (booked) reflects what the grantor had; Desk Map and Curative display warnings when they diverge; re-import of same title may change allocation silently if logic shifts
  - DA-M5 (NPRI ratification, #180): node.ratificationStatus defaults to 'unknown' (silent assumption) on legacy data; leasehold holds unit-focus payout on 'unratified' until confirmed; no enforcement in title-building; user must explicitly confirm per NPRI
  - DA-H1 (fixed NPRI excess, #180): fixed NPRI satisfied from burdened-branch royalty first; excess charged to WI; calculation rests on attorney-approved treatise consensus; check Springhill TR2 as real excess case
  - Van Dyke double-fraction (#180): node.doubleFractionClause captures verbatim deed language + both readings; user selects chosenBasis; no auto-resolution; if user edits a double-fraction node later, the clause is lost
  - Lease-instrument fanout (#221): one Lease record can fan to N lease-nodes (one per tract); per-tract leasedInterest/grossAcres carried on node; buildLeaseNode re-sync skips undefined params to preserve existing node values; user must explicitly set per-tract figures or they stay empty
  - leaseTractLeasedInterest override (#221): only read when non-empty and on lease-node; missing entry falls back to Lease.leasedInterest; byte-identity preserved (field never written if empty) — legacy single-tract leases unaffected; but if a lease-node is created and later the override is cleared, the field is not removed from the node (storage-side, may need explicit nullification in future)
  - Lease-node deletion: deleting the ONLY lease-node for an owner removes the Lease from owner-store; deleting one of N lease-nodes leaves the lease in place; no warning on partial delete — user must understand the scoping rule
  - Coverage overlap clipping (warn-only, #180): lease-allocation first-effective-wins; requested > remaining triggers overlap warning; older leases can be over-claimed and clipped silently until fixed; no hard-error block
  - Unit focus scope boundary: ORRIs/assignments stored with unitCode discriminator; filterDeskMapsByUnitCode filters tract tabs by activeUnitCode; unit-wide owned/leased rows apply only to unit; switching units changes visible state but does NOT move or cascade existing records — be careful with multi-unit projects, cross-unit orphans won't show in the active unit's view
  - Undo/redo memory-only: entries cleared on reload; durable ledger is the permanent record; operator undo button calls undoLastTitleMutation (journaled inverse); immediate undo of destructive mutation waits for cascade promise to settle before restore applies (correctness invariant, but adds latency)
  - Cascade cleanup async: cascadeDeleteDocsForRemovedNodes fires after removeNode (in-memory done); failure surfaced through lastError (no exception throw); if Dexie write fails, the node is already gone but docs may linger (data-integrity risk if storage is corrupted)
  - Workspace replacement (demo/CSV/import): clearDeskMapNodes, side-store reset, title-ledger reset all fire together; if import ledger hydration fails partway, the workspace is replaced but ledger may be incomplete (data-loss risk — see ACT-H4, DA-H4/H5 open)
  - NPRI over-carve (title discrepancy): Desk Map and Curative flag it red; Leasehold calculates visible payout rows anyway so discrepancy is visible; no hard block on editing or export; user must fix manually (title-building working state, not reliance-ready)
  - AI approval snapshots: Each approved proposal captures workspace-store undo snapshot; if multiple proposals are chained and mid-chain approval is rejected, earlier snapshots are orphaned (memory leak, but bounded by TITLE_UNDO_STACK_LIMIT=20)
  - Title-read cutover governance (default-off): read-flip machinery exists but disabled by default; shadow path (store/snapshot) is canonical; action-layer read validation gates flip but no production cutover yet (Phase 4 proof-of-concept only)
  - Stale canvas overlay (DA-H8, #159): deleted nodes get 'Stale' badge on flowchart via reactive computed interest; if canvas is not re-imported after node delete, stale-badge calculations run but don't block print (visual-only, no math impact)
  - Byte-identity oracle: normalizeOwnershipNode only writes optional fields (statedFraction, ratificationStatus, doubleFractionClause, leaseTractLeasedInterest, leaseTractGrossAcres) when non-null/non-empty; any JSON diff expects these to never appear unless meaningful (breaks if serializer adds them unconditionally)
  - Write-lease heartbeat: write-lease expires after TTL; heartbeat renews at TTL/3; if renewal fails or browser tab hidden, mutations fail closed with READ_ONLY_WORKSPACE_EDIT_TITLE title; no auto-retry or grace period (user must see warning and click refresh)
  - LLA-H03 (open audit item): multiple same-tract roots and over-100% coverage allowed as working title-theory; no hard block on creation; red warning dots and Curative flags exist but don't prevent save/export; user must interpret correctly (by design, not bug, but trust-dependent)

### title-math: unified title-ownership and leasehold calculator engine

*View: cross-cutting*

Core title tree mutation math, leasehold payout math, and lease-coverage allocation. Unified calculator engine consuming stable MathInputView projection for Texas oil-and-gas mineral-title ownership, fractions, royalty, NPRI, ORRI, WI math; routes all precision through explicit Decimal.js discipline and guarded by Phase 0 golden-master baselines.

- **Source of truth:** src/title-math/ (ownership, coverage, leasehold calculators), src/engine/ (Decimal.js and precision discipline), fixtures/baseline/ (frozen reproducibility lock), scripts/title-math-baseline.ts (characterization harness)
- **Key files:** `src/title-math/index.ts`, `src/title-math/calculators/ownership.ts`, `src/title-math/calculators/coverage.ts`, `src/title-math/calculators/leasehold.ts`, `src/title-math/calculators/tree-share.ts`, `src/title-math/model/calc-node.ts`, `src/title-math/model/node-predicates.ts`, `src/title-math/model/graph-ops.ts`, `src/title-math/precision/emit.ts`, `src/engine/decimal.ts`, `src/engine/display-format.ts`, `src/engine/fraction-display.ts`, `src/project-records/projections.ts`, `src/types/node.ts`, `src/types/owner.ts`, `src/types/leasehold.ts`, `fixtures/baseline/springhill.json`, `fixtures/baseline/vulcan-mesa.json`, `fixtures/baseline/raven-forest.json`, `fixtures/phase-0/demo.leasehold-decimals.json`, `fixtures/phase-0/demo.coverage-summary.json`, `scripts/title-math-baseline.ts`, `src/title-math/__diff__/__tests__/baseline.test.ts`, `src/title-math/__diff__/__tests__/differential.test.ts`
- **Depends on** — changing these can break *this* feature:
  - **workspace-store (Desk Map nodes, lease attachments, ORRI/WI records)** — src/types/node.ts:OwnershipNode (id, fraction, parentId, linkedOwnerId, linkedLeaseId, leaseTractLeasedInterest, royaltyKind, ratificationStatus, doubleFractionClause, statedFraction); src/types/node.ts:DeskMap (id, nodeIds, unitCode, pooledAcres, grossAcres)
  - **owner-store (Lease and Owner records)** — src/types/owner.ts:Lease (id, leasedInterest, royaltyRate, status, jurisdiction, ownerId); src/types/owner.ts:Owner (id, name); isTexasMathLease, isTexasMathLeaseJurisdiction predicates gate Texas-only math (Phase 2 boundary)
  - **workspace-store (Leasehold burdens)** — src/types/leasehold.ts:LeaseholdUnit (jurisdiction, operator, effectiveDate); LeaseholdOrri (id, burdenFraction, burdenBasis, scope, unitCode, deskMapId); LeaseholdAssignment (workingInterestFraction, scope, unitCode, deskMapId)
  - **precision engine (Decimal.js)** — src/engine/decimal.ts:d() parser, serialize() firewall (quantize <=9dp or toSignificantDigits(24)), DISPLAY_PRECISION=9, STORAGE_PRECISION=24, Decimal.ROUND_HALF_UP config
  - **MathInputView projection (workspace-to-record adapter)** — src/project-records/projections.ts:buildMathInputView() produces stable input shape isolating Texas math from schema churn; reads workspace.nodes, workspace.deskMaps, workspace.leaseholdUnit, workspace.leaseholdOrris/Assignments; filters via isTexasMathLease + buildJurisdictionIsolationPrecondition
  - **node normalization (node-type predicates)** — src/title-math/model/node-predicates.ts:isTitleCountedNode() (type !== 'related' && interestClass !== 'npri' && parentId !== 'unlinked') — shared source of truth for coverage + root-total inclusion logic
- **Consumed by** — changing *this* feature can break these:
  - **Desk Map UI (canvas/flowchart, coverage summary, warning dots)** — src/components/deskmap/:  calculateDeskMapCoverageSummary(), deskmap-coverage.ts, deskmap-warning-dots.ts render coverage by tract; findNpriBranchDiscrepancies() surface validation issues; allocation + overlap warnings drive Desk Map warning UI
  - **Leasehold review (transfer-order sheet, assignment tracking, audit decimals)** — src/components/leasehold/: buildLeaseholdUnitSummary() → LeaseholdUnitSummary (tracts[], owners[], assignments, orris, npris, inputWarnings, leaseOverlaps); buildLeaseholdDecimalRows() → LeaseholdDecimalRow[] (royalty/npri/orri/wi/unleased rows); buildLeaseholdTransferOrderReview() + decimal ledger; warning flags (overAssigned, overBurdened, overFloatingNpriBurdened, fixedNpriExceedsRoyalty)
  - **MathInputView (project-record projection, AI context, parity gates)** — src/project-records/projections.ts:buildMathInputView consumes calculators + emitRate, surfaces preconditions + leaseholdSummary + decimalRows + transferOrderReview + warningStates to gated parity tests and AI context builders
  - **AI approval previews + audit sheet (context building, mutation validation)** — src/ai/approval-preview.ts, src/components/leasehold/audit-sheet.ts consume buildLeaseholdUnitSummary() + node math results for mutation previews and traceability
  - **Workspace validation + CSV import (graph validation, interest parsing, parity checks)** — src/storage/csv-io.ts:validateOwnershipGraph(), src/ai/tools.ts:validateOwnershipGraph(); parseStrictInterestString + strict Decimal parser gate malformed inputs in CSV + manual entry
  - **Title-cutover gate (action-layer parity, read-flip governance)** — src/project-records/action-layer/: title-cutover-readiness.ts checks mathParityClean (MathInputView parity against action-derived nodes); title-cutover-gate.ts enforces governance before read-flip; title-math-parity.ts compares shadow vs. action math
  - **Export/baseline CI (golden-master regression lock)** — fixtures/baseline/ (springhill.json, vulcan-mesa.json, raven-forest.json) frozen snapshots; baseline.test.ts diffs fresh capture against frozen via diffCaptured() for regression lock on read path (not old-vs-new proof, reproducibility check only)
- **Shared contracts / invariants:**
  - OwnershipNode.fraction as serialized Decimal string: every operation emits via serialize() firewall (≤9dp quantize or toSignificantDigits(24)); readers re-parse via d() and work in Decimal.js internal 40-digit precision
  - Lease.leasedInterest + OwnershipNode.leaseTractLeasedInterest dual-read for per-tract override: LeaseScopeIndex.tractLeasedInterestByParentNodeId maps (parentNodeId → leaseId → override string); absent/empty falls back to record.leasedInterest, so legacy single-tract data round-trips unchanged
  - Texas-math-only active gate (isTexasMathLease, isTexasMathLeaseJurisdiction): jurisdiction='tx_fee'|'tx_state' pass; others (federal, private, tribal) excluded from coverage + leasehold math until Phase 2; MathInputView precondition blocks non-Texas unit workspaces
  - isTitleCountedNode() shared predicate (type !== 'related' && interestClass !== 'npri' && parentId !== 'unlinked'): both coverage allocator and root-total use it; before DA-M8 they diverged subtly
  - Van Dyke double-fraction (DoubleFractionClause.chosenBasis): calculateShare applies ONE chosen reading, never auto-multiplies both fractions; preserves ambiguity intent structurally
  - Over-conveyance warn-don't-cap (OwnershipNode.statedFraction, ExecuteConveyanceResult.warning): fraction booked at remainder (initialFraction) but stated amount captured verbatim; warning flag, no silent cap
  - Ratification tri-state (RatificationStatus='ratified'|'unknown'|'unratified'): absent/legacy → 'unknown' (not silently 'ratified'); new NPRIs get 'unknown'; only 'ratified' uses unit-weighted payout; 'unknown'/'unratified' held on transfer-order sheet
  - NPRI royalty kind (RoyaltyKind='fixed'|'floating'|null): floating multiples burdened lessor's royalty; fixed carries basis discriminator (whole_tract vs. burdened_branch) to resolve deed ambiguity; null on mineral nodes
  - Fixed NPRI excess rule (DA-H1, counsel-approved 2026-06-15): fixed burden satisfied from burdened lessor's royalty first (after floating); only EXCESS charged to WI; tractBurdenRate.fixedNpriExceedsRoyalty flag surfaces condition
  - ORRI burden stacking order (compareOrriStackingOrder): date → docNo → id lexicographic sort; NRI ORRIs recomputed sequentially in stack (cascading caps); basis discriminator (gross_8_8 / working_interest / net_revenue_interest) selects which NRI base
  - Lease coverage allocation order (compareLeaseAllocationOrder): effectiveDate || '9999-12-31' → createdAt → updatedAt → id; first-effective-wins with warn-only clipping (no silent rejection); malformed leasedInterest marked 'malformed' overlap, allocation '0'
  - Precision emission disciplines: emitNodeFraction (serialize firewall), emitRate (9dp quantized finals), emitRawRate (full precision for re-read intermediates like allocatedFraction), emitScaleFactor (toFixed(12) audit); re-read intermediates bypass quantization to avoid compounding rounding
- **Guards:**
  - **Phase 0 golden-master baseline lock** (`src/title-math/__diff__/__tests__/baseline.test.ts`) — Any divergence in captured leasehold unit rows, covered decimals, transfer-order review terminals, or node displays vs. frozen fixtures/baseline/{springhill,vulcan-mesa,raven-forest}.json; baseline is a self-consistency reproducibility check (not old-vs-new proof post-unified-engine cutover); divergences on oracle fixtures (Springhill) are flagged ORACLE DRIFT
  - **Phase 0 golden reconciliation (Vulcan Mesa leasehold + coverage)** (`src/title-math/__diff__/__tests__/baseline.test.ts`) — Vulcan Mesa capture.unitRows, focusedRowsByTractCode, transferOrderReview must match fixtures/phase-0/demo.leasehold-decimals.json; coverage summary must match demo.coverage-summary.json per tract code
  - **Springhill oracle anchor (fully leased TR1 0.225/0.775, TR2 excess case)** (`src/title-math/__diff__/__tests__/baseline.test.ts`) — captured.leaseholdSummary.tracts[code='TR1'] must have leasedOwnership='1', weightedRoyaltyRate='0.225', nriBeforeOrriRate='0.775'; Springhill is the oracle fixture for DA-H1 fixed-NPRI-excess rule (TR2) and ratification tri-state (DA-M5)
  - **MathInputView parity (action-layer vs. shadow read)** (`src/project-records/action-layer/title-cutover-readiness.ts:mathParityClean check`) — MathInputView built from action-derived nodes must exactly match MathInputView from store snapshot (nodeDisplays, leaseholdSummary.unitDecimal, transferOrderReview.totalDecimal); gated by title-cutover-gate before read-flip enabled
  - **Jurisdiction isolation precondition** (`src/project-records/projections.ts:buildJurisdictionIsolationPrecondition`) — Texas-only math gate: if unit.jurisdiction is non-Texas, MathInputView.preconditions.jurisdictionIsolation.status='blocked'; leasehold/coverage math returns empty results; non-Texas leases excluded from texasLeaseIds; prevents non-Texas lease math from polluting Texas Desk Map
  - **Malformed interest (lease royalty, ORRI burden, WI assignment)** (`src/title-math/calculators/leasehold.ts:parseLeaseholdMathInterest + addInputWarning`) — parseStrictInterestString (strict Decimal + fraction parser) returns null on malformed input (non-terminating fractions, out-of-range values); caller treats as 0 and records LeaseholdInputWarning; UI surfaces warning before approval; transfer-order math still reaches valid total but shows inputWarningCount
  - **Lease coverage overlap (clipped allocation)** (`src/title-math/calculators/coverage.ts:allocateLeaseCoverage`) — When owner's remaining leasable fraction < requested lease share, clipping creates LeaseCoverageOverlap; allocatedFraction quantized to 9dp; clippedFraction quantized to 9dp; warning-only (no silent rejection); aggregated in LeaseholdUnitSummary.leaseOverlaps + LeaseholdTractSummary.leaseOverlaps
  - **Over-burdening: fixed + ORRI exceed NRI** (`src/title-math/calculators/leasehold.ts:calculateOrriBasisRates, tractFixedNpriExcessRate`) — When npriAdjustedNriBeforeOrriRate < (grossOrriBurdenRate + wiOrriBurdenRate), safeNetRevenueInterestBaseRate clamped to 0; LeaseholdTractSummary.overBurdened flag raised (warning-only); transfer-order sheet holds until resolved
  - **Over-floating NPRI: lessor royalty carve** (`src/title-math/calculators/leasehold.ts:overFloatingNpriBurdened check`) — Per lease-slice, if floatingNpriBurdenRate > ownerTractRoyalty, LeaseholdOwnerSummary.overFloatingNpriBurdened=true; warning-only; owner-side royalty clamped to 0 on affected slices but transfer-order shows variance until title burden resolved
  - **CSV interest parsing (strict Decimal discipline)** (`src/storage/csv-io.ts import path`) — CSV import uses parseStrictInterestString (reject non-terminating fractions); nodes/leases written at full STORAGE_PRECISION via serialize(); prevents float64/toFixed(9) rounding creep from old CSV loaders
  - **Graph validation (over-root allocation check)** (`src/title-math/model/graph-ops.ts:validateCalcGraph + src/title-math/calculators/ownership.ts:validateOwnershipGraph`) — allocatingDescendants > 100 raises validation error (NPRI/conveyance over-allocation); also checks parent-child consistency, decimal cycle, negative fractions; gated in executeConveyance/Rebalance/etc., exportCalcResults surfaces errors
- **Known fragility / refactor traps:**
  - Lease-node per-tract override (leaseTractLeasedInterest) recently added (2026-06-26): lives on OwnershipNode as optional string field; coverage.ts:buildLeaseScopeIndex must be kept in sync with workspace-store lease-node building; any change to how lease-nodes carry per-tract data will diverge coverage math from stored state
  - Ratification tri-state (DA-M5) defaults legacy data to 'unknown' not 'ratified': absent field on pre-2026 nodes treated as unknown at runtime, but the default changed to 'unknown' for new nodes (executeCreateNpri); old projects + new nodes will show ratification holds even if old data was implicitly ratified — intentional conservative shift, but may confuse users
  - Fixed NPRI excess rule (DA-H1, 2026-06-15 counsel-approved): excess-to-WI logic is new and rests on treatise consensus, not statutory. Springhill TR2 tests it; but a future counsel reversal or client instruction to cap at 0 would require all three layers (owner-royalty, WI basis, and the excess-flag warning) to be re-gated
  - Double-fraction literal ambiguity (Van Dyke, TXM-002): chosenBasis stored on node, captured at entry, not re-derived. If user changes chosenBasis on a conviction later, pre-conviction siblings/descendants still carry the original basis; no cascade. Migration/audit relies on user vigilance to update old conveyances
  - Precision emission disciplines: reinterpret emitRawRate vs. emitRate carefully. allocatedFraction crosses module boundaries (coverage → leasehold); if leasehold ever quantizes its re-read, the sum will diverge from the stored total. Stage B locked emitRate to 9dp on display only, but this is a subtle invariant that could break on a careless refactor
  - ORRI stacking order (compareOrriStackingOrder) uses dateText || '9999-12-31': blank dates sort to end. If a future UI backfills missing dates, re-sort will silently change burden stack order on affected records — may shift payout math if NRI ORRIs are present
  - Lease coverage first-effective-wins is in memory: compareLeaseAllocationOrder uses effectiveDate || '9999-12-31' → createdAt → updatedAt → id. If lease createdAt/updatedAt are ever backfilled or corrected, coverage allocation changes without a visible trigger; the comparison tuple should maybe include a system-stable lease ID first
  - isTitleCountedNode hardcoded parentId !== 'unlinked' check: one operator uses 'unlinked' as a stub parent for orphaned conveyances pending reattachment. If projects use parentId='unlinked' for other semantics, this predicate must be updated in both places (coverage + root-total). DA-M8 unified them, but future code-paths could re-diverge
  - Jurisdiction isolation precondition blocks non-Texas workspaces: buildJurisdictionIsolationPrecondition returns status='blocked' if unit.jurisdiction is not in TEXAS_MATH_LEASE_JURISDICTIONS. This is enforced in MathInputView projection, but if raw store.deskMaps or store.nodes are consumed directly (e.g., in a sidebar summary), they would skip the gate and leak non-Texas leases into display
  - Per-tract acreage (leaseTractGrossAcres): optional field on lease-nodes, display-only, never read by title-math. If acreage and fraction diverge (user changes one but not the other), the UI may confuse users but the math is unaffected. Future per-tract pooling math may require tight sync between these fields
  - Floating NPRI over-carve warning (overFloatingNpriBurdened): set per lease-slice, but the flag is an owner-level summary. If an owner has multi-lease slices and only one overflows, the flag is true for the whole owner card. A slice-level warning might be more precise but would break the current summary shape
  - Springhill data fixity risk: Springhill is committed as a fixture and is the oracle for DA-H1 + ratification. Changes to Springhill's workspace data (e.g., updating a lease date) will diverge baseline; the baseline.test.ts will catch it (ORACLE DRIFT), but the cause may not be obvious without reading the fixture
  - Void/zero initial fractions in validateCalcGraph: nodes with initialFraction='0' are created but are not yet in final store shape. Graph validation treats them as valid but the workspace may have a stale `nodeById` index if it skips zero-fraction nodes. Coverage and leasehold filters assume all nodes present
  - Unleased mineral rows (newly added DA-M8): LeaseholdDecimalRowKind='unleased' for owners with net fraction - allocated lease fraction > 0. This row was added to close coverage reporting gaps, but if future ownership math changes how mineral coverage is computed, unleased row total may drift from a simple subtraction
  - Transfer-order variance (expectedDecimal vs. totalDecimal): expected = sum of all unit decimal rows; actual = Desk Map 100% mineral interest. If a user removes a node without updating ORRI/WI, variance shows but is warning-only. Resolution requires data correction, not engine change

### owners-leases

*View: Owners database view + leasehold review surface*

Separate lease record storage and desk-map lease-node linking. One lease instrument fans to N lease-nodes (one per tract); per-tract lessor interest and gross acres live on nodes. Owners records lean record/abstract data; Leasehold consumes leases via desk-map node links.

- **Source of truth:** Lease record (src/types/owner.ts:Lease) — single record per instrument grouped by leasePurchaseReportId. LeasePurchaseReport (src/types/lease-purchase-report.ts) — parent abstract shared by per-tract slices. Owner records (src/types/owner.ts:Owner) — lessor identity. Dexie tables: leases, leasePurchaseReports, owners, ownerDocs, contactLogs (src/storage/db.ts). Lease-nodes (src/types/node.ts:OwnershipNode with linkedLeaseId) — one per tract, carry leaseTractLeasedInterest override, leaseTractGrossAcres.
- **Key files:** `src/types/owner.ts`, `src/types/lease-purchase-report.ts`, `src/types/node.ts`, `src/store/owner-store.ts`, `src/storage/owner-persistence.ts`, `src/components/owners/owner-lease-grouping.ts`, `src/components/leasehold/lease-tract-rows.ts`, `src/components/modals/AttachLeaseModal.tsx`, `src/components/deskmap/deskmap-lease-node.ts`, `src/storage/collapse-duplicate-leases.ts`, `src/title-math/calculators/coverage.ts`, `src/components/leasehold/leasehold-summary.ts`
- **Depends on** — changing these can break *this* feature:
  - **workspace-store** — OwnershipNode:linkedLeaseId, linkedOwnerId; clearLinkedLease(leaseId); syncLeaseNodesFromRecord(lease); buildLeaseNode() called during sync
  - **desk-map** — OwnershipNode tree structure; lease-node type (node.type='related', node.relatedKind='lease'); parentId linking
  - **curative-store** — unlinkLease(leaseId); unlinkOwner(ownerId) — cascade when lease/owner deleted
  - **map-store** — unlinkLease(leaseId); unlinkOwner(ownerId) — detach map regions from lease/owner
  - **leasehold-math** — buildLeaseScopeIndex(nodes); getLeasesForOwnerNode(ownerLeases, ownerNode, index); reads leaseTractLeasedInterest override from lease-node
  - **document-store** — OwnerDoc.leaseId link; document_attachments scoped by leaseId
  - **persistence-round-trip** — exportLandroidFile: owners, leases, leasePurchaseReports, contacts, ownerDocs via OwnerWorkspaceData; importLandroidFile: replaceOwnerWorkspaceData
- **Consumed by** — changing *this* feature can break these:
  - **leasehold-summary** — getActiveLeases(leases); Lease.jurisdiction, status, royaltyRate, leasedInterest, effectiveDate for lease-slice summary; buildLeaseScopeIndex() for per-tract override lookup
  - **coverage-math** — buildLeaseScopeIndex(nodes); getLeasesForOwnerNode() — applies leaseTractLeasedInterest override to owner branch leases
  - **owners-ui** — leaseInstrumentKey(lease); groupLeasesByInstrument(leases) — collapse per-tract records for display
  - **deskmap-ui** — isLeaseNode(node); buildLeaseNode() called during AttachLeaseModal save and syncLeaseNodesFromRecord; node.linkedLeaseId for lease-node rendering
  - **ai-tools** — attachLease tool creates Lease, calls reconcileLeaseTractNodes; createOwner precedes lease creation
  - **transfer-order-review** — Lease effective date, doc number, status for payout row metadata
- **Shared contracts / invariants:**
  - LeaseJurisdiction discriminator ('tx_fee' only active in Texas math; Phase 2 gates federal/private/tribal)
  - LeaseStatus canonical enum ('Active','Expired','Released','Terminated','Inactive','Dead') — non-canonical legacy text persisted, normalized on load
  - Lease.leasePurchaseReportId groups per-tract records by instrument (null for standalone); per-rect leases under same LPR can have different leasedInterest/grossAcres
  - Node.leaseTractLeasedInterest, node.leaseTractGrossAcres — per-tract override when one instrument fans across tracts
  - OwnershipNode.linkedLeaseId, linkedOwnerId — desk-map node links to Owners records (nullable, cascaded on delete)
  - computeNetAcres(grossAcres, leasedInterest) — descriptive only, never enters math, re-derived on normalize
  - leaseInstrumentKey() — strict content key including leasedInterest (so content-merged leases must share it) OR lpr:<id> form (LPRs can vary per tract). Grouping agrees across Owners tab display and collapse-duplicate-leases migration.
- **Guards:**
  - **owner-persistence-lazy** (`src/storage/__tests__/owner-persistence-lazy.test.ts`) — Owner docs lazy-loaded on demand, not at project open; lease round-trip
  - **owner-lease-grouping** (`src/components/owners/__tests__/owner-lease-grouping.test.ts`) — leaseInstrumentKey groups identical instruments, countActiveLeaseInstruments sums per owner
  - **owner-lease-deskmap** (`src/components/owners/__tests__/owner-lease-deskmap.test.ts`) — getOwnerLeaseDeskMapTargets returns present-mineral owners and marks existing lease-nodes
  - **attach-lease-modal** (`src/components/modals/__tests__/attach-lease-modal.test.tsx`) — reconcileLeaseTractNodes creates/updates/deletes lease records and nodes; leasedInterest per-tract override; LPR grouping; tract checked state
  - **collapse-duplicate-leases** (`src/storage/__tests__/collapse-duplicate-leases.test.ts`) — Migrate per-tract per-record model to per-tract per-node; repoint nodes to canonical; preserve leasedInterest/grossAcres overrides
  - **lease-jurisdiction** (`src/types/__tests__/lease-jurisdiction.test.ts`) — LeaseJurisdiction normalization; Texas math filter; non-Texas leases rejected from Desk Map attach
  - **lease-purchase-report** (`src/types/__tests__/lease-purchase-report.test.ts`) — LPR normalization; leasePurchaseReportId blank→null; per-tract slice grouping
  - **workspace-persistence round-trip** (`src/storage/__tests__/workspace-persistence.test.ts`) — Owners, leases, leasePurchaseReports, contacts in ownerData export/import; nodes retain linkedLeaseId
  - **springhill golden** (`src/phase0/__tests__/springhill-sample.test.ts`) — Weighted royalty, NRI, NPRI, ORRI math across multi-unit multi-tract leases (byte-identity baseline)
  - **coverage-allocation** (`src/title-math/calculators/__tests__/coverage.test.ts`) — buildLeaseScopeIndex, getLeasesForOwnerNode, per-tract leasedInterest override applied to lease-slice
- **Known fragility / refactor traps:**
  - DA-H3 (deep-audit 2026-06-10): Two store mutations (convey, attachLease) fire cascades (map/curative unlinks, doc/owner cleanup) AFTER the title-ledger hook rolls back on parity failure, permanently deleting cascaded records that survived the revert. Store actions return success/node-id regardless of rollback, so callers cannot know cleanup was voided. Mitigation: make cascades pre-emptive or gate them behind rollback-check.
  - DA-L4: One-time legacy collapse-duplicate-leases migration (collapse per-tract records to per-node model) assumes per-tract slices share content-identical instrument fields to be mergeable. Two tracts with same doc number but different royalty rates will NOT merge and leave duplicate records. Migration is idempotent (runs once at load); re-running requires manual script. No current detection/warning for uncollapsed dupes in live workspaces.
  - DA-U3: AttachLeaseModal.tsx is 1,069 lines; LeaseholdView.tsx is 4,601 lines. Two highest-stakes UI surfaces are least reviewable. Mechanical refactor to extract lease-specific surface into src/components/leasehold/ siblings would cut PR review burden (no logic change).
  - Document-original loss via export/import/undo: OwnerDoc.leaseId links are preserved through round-trip, but document attachments can be silently lost if a node is deleted (cascade clears document_attachments; undo restores nodes but not docs). Product claims evidence vault with immutable originals; daily workflows (triage, attach, export, reimport) can destroy them. Backlog LLA-M04 gates owner/lease/curative doc attachments until attachment safety is fixed.
  - Lease status legacy text: old data may carry custom status strings (e.g. 'Pending', 'Expired Pending'). normalizeLeaseStatus preserves non-canonical text, but isInactiveLeaseStatus checks a hardcoded set. Canonical enum is enforced on UI edits but legacy text can persist undetected. Recommend audit/cleanup pass on real data.
  - Texas-math jurisdiction only: Lease.jurisdiction='tx_fee' is the only active value today; getAttachLeaseModalTexasMathError gates federal/private/tribal leases from Desk Map attach. Phase 2 implementation will add federal lease math, CA TPF, ONRR payout. Current code has the discriminator in place (zero math changes needed for Phase 2 activation) but no federal math yet.
  - Depth-range stub: Lease.depthRange and node.depthRange default to 'all_depths'; every module asserts all_depths. Phase 8 (depth severance) will add per-lease/per-node depth discrimination. Current code has the fields but no active logic.
  - Per-tract override fields optional: node.leaseTractLeasedInterest and node.leaseTractGrossAcres are optional fields. Absence defaults to 'use the record value'. Round-trip is safe (empty/absent both round-trip as absent), but absent field in old data cannot be distinguished from 'not yet set'. Migration to explicit empty string could clarify, but is not urgent.
  - Sync after update: workspace-store.syncLeaseNodesFromRecord(lease) rebuilds lease-nodes from updated Lease record. Runs after lease update but before store notification. If multiple lease-nodes link the same record, all are rebuilt. No batching across multiple lease updates.
  - Leasehold math caches: buildLeaseScopeIndex is called once per Leasehold render (not per leaseslice); index is immutable after build, so changes to nodes or leases during a Leasehold render will not update the index until next render. Safe by construction (reads before writes in single render), but susceptible to performance issues if nodes/leases arrays grow large or change frequently.

### leasehold

*View: Leasehold View (src/views/LeaseholdView.tsx) + Transfer Order Review Sheet*

Compute unit-wide leasehold economics from title nodes (mineral owners, leases, NPRIs) plus ORRI/WI overrides, including tract-by-tract royalty allocation, decimal payout rows, and transfer-order review. Unit-scoped optional ORRI/WI filtering via activeUnitCode selector.

- **Source of truth:** Zustand workspace-store: leaseholdUnit (metadata), leaseholdAssignments (WI splits), leaseholdOrris (ORRI burdens), leaseholdTransferOrderEntries (payout review status). Lease + Owner records live in owner-store and desk-map nodes in workspace-store; owned by desk-map feature.
- **Key files:** `src/views/LeaseholdView.tsx`, `src/title-math/calculators/leasehold.ts`, `src/types/leasehold.ts`, `src/store/workspace-store.ts`, `src/components/leasehold/leasehold-formulas.ts`, `src/components/leasehold/__tests__/leasehold-summary.test.ts`, `src/utils/desk-map-units.ts`, `src/title-math/calculators/coverage.ts`, `src/storage/workspace-persistence.ts`
- **Depends on** — changing these can break *this* feature:
  - **desk-map** — DeskMap[](id, name, code, unitCode, unitName, grossAcres, pooledAcres, nodeIds, deskMapId) + OwnershipNode[](id, fraction, linkedOwnerId, type, relatedKind)
  - **ownership-tree** — Owner[](id, name) + Lease[](id, ownerId, leaseName, lessee, royaltyRate, leasedInterest, effectiveDate, jurisdiction) consumed by buildLeaseholdUnitSummary for slice-by-slice allocation
  - **lease-coverage** — allocateLeaseCoverage, buildLeaseScopeIndex, getLeasesForOwnerNode, LeaseCoverageOverlap contract (from src/title-math/calculators/coverage.ts); used in buildOwnerLeaseSummaries
  - **curative** — TitleIssue[] from curative-store; countOpenHighRiskCurativeIssuesForUnit filters by deskMapId + nodeIds to inject hold reasons into transfer-order review (DA2-C)
  - **decimal-engine** — Decimal.js via src/engine/decimal.ts (d()), emitRate/emitRawRate quantization to 9dp (Stage B), parseStrictInterestString for lease royalty/ORRI/WI parsing
  - **ui-store** — activeUnitCode selector governs unit-scoped ORRI/WI filtering via filterDeskMapsByUnitCode
  - **desk-map-units** — resolveActiveUnitCode, filterDeskMapsByUnitCode, findUnitOption; used to apply unit focus to tractSummary list and filter records by unitCode scope
- **Consumed by** — changing *this* feature can break these:
  - **transfer-order-review** — buildLeaseholdDecimalRows consumes LeaseholdUnitSummary + focusedDeskMapId to emit LeaseholdDecimalRow[] (royalty, npri, orri, assigned_wi, retained_wi, unleased rows); buildLeaseholdTransferOrderReview wraps decimal rows into payout sheet with variance/hold-reason logic
  - **map-view-orri** — LeaseholdUnitSummary.orris (filtered by scope + includedInMath + unitCode match) surfaces ORRI detail cards in Map mode; unitOrriDecimal per tract
  - **map-view-npri** — LeaseholdUnitSummary.npris (filtered by deskMapId + includedInMath + ratificationStatus) surfaces NPRI branches and burden rates in Map mode; unitNpriDecimal per tract
  - **summary-cards** — LeaseholdUnitSummary (totalRoyaltyDecimal, totalNpriDecimal, totalOrriDecimal, retainedWorkingInterestDecimal, trackedNpriCount, etc.) drives Overview card displays and formulas (unit-wide aggregates)
  - **tract-summary** — LeaseholdTractSummary[]per tract: unitParticipation, leasedOwnership, weighted royalty, owner-by-owner lease slices + NPRI/ORRI/assignment burden stacks; displayed in Tract Cards + owner-branch graph
  - **formula-tooltips** — leasehold-formulas.ts exports ~30+ formula helpers (tractGrossAcresFormula, ownerTractRoyaltyFormula, ownerNetUnitRoyaltyFormula, unitSummaryTotalRoyaltyFormula, etc.) consumed by LeaseholdView to annotate numeric displays
  - **audit-sheet** — buildAuditSheet consumes LeaseholdUnitSummary to emit CSV/XLSX rows for auditor review of decimal breakdown (format + compliance)
  - **tract-export** — buildLeaseholdUnitSummary used in tract-export.ts to generate exports that include leasehold economics
- **Shared contracts / invariants:**
  - LeaseholdUnit (metadata: name, operator, effectiveDate, jurisdiction) — unit-level configuration required before WI split/transfer-order review
  - LeaseholdOrri (scope='unit'|'tract', unitCode?, deskMapId?, burdenFraction, burdenBasis='gross_8_8'|'working_interest'|'net_revenue_interest') — inline override per unit or per tract
  - LeaseholdAssignment (scope='unit'|'tract', unitCode?, deskMapId?, workingInterestFraction, assignee) — WI split carve after royalty+NPRI+ORRI
  - LeaseholdTransferOrderEntry (sourceRowId, ownerNumber, status='draft'|'ready'|'hold', notes) — reviewable payout-sheet row metadata
  - LeaseholdUnitSummary shape: tracts[], npris[], orris[], assignments[], totalRoyaltyDecimal, totalNpriDecimal, totalOrriDecimal, retainedWorkingInterestDecimal, overAssignedTractCount, unitAssignmentWarnings, inputWarnings, orriBurdenRateByTractId map (reused by decimal-row builder per DA-M7)
  - LeaseholdTractSummary shape: deskMapId, owners[], unitParticipation, leasedOwnership, weighted royalty per tract, NPRI/ORRI/assignment carve stacks, overAssigned|overBurdened|fixedNpriExceedsRoyalty warning flags (DA-H1/M5)
  - LeaseholdDecimalRow (category='royalty'|'npri'|'orri'|'assigned_wi'|'retained_wi'|'unleased', decimal, sourceLabel, effectiveDate, sourceDocNo) — payout-sheet row contracts DAM7 (WI fraction parsed once, reused in decimal row)
  - DeskMapUnitCode as optional string on DeskMap/LeaseholdOrri/LeaseholdAssignment for multi-unit scoping; null = unit-wide; unitRecordAppliesToDeskMap(unitCode, deskMap) is the scoping predicate
  - Depth severance placeholder: depthRange='all_depths' on LeaseholdOrri/LeaseholdAssignment; Phase 8 will extend to depth severance enums (Phase 0 audit 19/Phase 8 item ref)
- **Guards:**
  - **leasehold-summary.test.ts** (`src/components/leasehold/__tests__/leasehold-summary.test.ts`) — buildLeaseholdUnitSummary math contract violations: tract participation + owner fractions + lease-slice allocation + royalty weighting + NPRI/ORRI/WI stacking order + unit-assignment filtering (scope + unitCode match) + over-assigned/over-burdened flags + unleased cost-bearing rows + malformed input warnings + DA-H1 fixed-NPRI-excess-to-WI + DA-M5 ratification hold logic + DA-M7 parsed-WI-fraction reuse + lease-overlap surfacing + federal-lease exclusion (2900+ lines, ~30 it() blocks)
  - **transfer-order-hold-reasons** (`src/title-math/calculators/leasehold.ts:1855-1920`) — buildLeaseholdTransferOrderHoldReasons: unratified NPRIs, fixed-NPRI excess flag, high-risk curative issues → 'hold' status override (DA2-C)
  - **decimal-rows-filter** (`src/title-math/calculators/leasehold.ts:1576-1800`) — buildLeaseholdDecimalRows: focused tract filtering (deskMapId match), unit-scoped ORRI/assignment filtering via summaryRecordAppliesToFocusedTract (unitCode match), reuse of orriBurdenRateById map to avoid divergent stacking (DA-M7)
  - **transfer-order-variance** (`src/title-math/calculators/leasehold.ts:1921-2050`) — buildLeaseholdTransferOrderReview: row totals, expectedDecimal (fullOwnership 1.0 - retainedWI), variance calculation, categorySummaries, source-doc gap warnings
  - **MathInputView parity** (`src/project-records/math-input-view.ts (shadow-read contract)`) — math-engine-bundle test: LeaseholdUnitSummary from store snapshot must match action-layer projected LeaseholdUnitSummary (post-flip governance, currently shadow-only)
  - **.landroid round-trip** (`src/storage/workspace-persistence.ts:700-720`) — normalizeLeaseholdUnit/Orris/Assignments on import with validDeskMapIds + validUnitCodes set validation; export preserves leaseholdUnit/Orris/Assignments; no stale refs to deleted desk maps after restoration
  - **tract-export.test.ts** (`src/maps/__tests__/tract-export.test.ts`) — buildLeaseholdUnitSummary consumed for tract export; math output survives serialization
- **Known fragility / refactor traps:**
  - DA-H1 (fixed NPRI exceeds lessor royalty): excess is charged to WI with `fixedNpriExceedsRoyalty` warning flag. Rule is attorney-approved (2026-06-15) but unusual; if rules change, threshold logic in leasehold.ts ~1300–1400 must be reviewed. Springhill TR2 is live test case.
  - DA-M5 (pooling ratification): NPRIs with ratificationStatus='unknown'|'unratified' are computed unit-weighted but held on transfer-order sheet. If held ratification is later confirmed, status flip must toggle hold reason in buildLeaseholdTransferOrderHoldReasons. Current fallback: legacy NPRI absent ratificationStatus → treated as 'ratified' (executeCreateNpri writes 'unknown' for new).
  - DA-M7 (WI-fraction reuse): buildLeaseholdDecimalRows MUST reuse the parsed workingInterestFraction from LeaseholdAssignmentSummary (computed once during unit-summary build) instead of re-parsing the raw string. The summary builder has the only parser, which adds warnings; decimal rows must not diverge. See leasehold.ts ~335–340 comment.
  - Unit-scoped ORRI/assignment filtering predicate (unitRecordAppliesToDeskMap): matches unitCode exactly on deskMap; null unitCode = unit-wide (matches all). Scope flip from 'tract' to 'unit' also flips deskMapId → null. If a record's unitCode does not match the active focus, it is excluded from focused decimal rows (not a math error, but a display/scoping invariant).
  - Over-assignment warning (retainedWI < 0): clamped at 0 in math; display shows count of over-assigned tracts, operator must manually remove or increase assignments. No auto-revert.
  - Over-burdened warning (preWI < 0 after ORRI stack): NRI base pre-WI clamped at 0; transfer-order sheet will show >100% variance until ORRI/NPRI records are fixed. Counsel review required before payout.
  - Lease-overlap clipping (allocateLeaseCoverage): earlier lease in a scoped owner's nodeIds array silently clips later leases if total coverage exceeds owner's fraction. Clipped leases are marked in leaseOverlaps array (DA-M1 fix); no data loss, but silent re-ranking is subtle.
  - Federal-lease exclusion: leases with jurisdiction != 'tx_fee' are silently dropped from Texas leasehold math (isTexasMathLease filter in buildOwnerLeaseSummaries). Phase 2 will extend to federal CA/TPF math; until then, mixed-jurisdiction projects may appear incomplete in unit summary if federal leases exist.
  - ORRI burden-basis stacking order (gross_8_8, working_interest, nri-basis) is hard-coded in calculateOrriBasisRates; if rules change, that function + the sequential carve logic in leasehold.ts ~600–700 must be updated together.
  - Empty pooledAcres (totalPooledAcres = 0) makes unitParticipation = 0 and all decimal rows = 0. Desk-map feature should prevent this, but leasehold engine does not validate; no error is raised, just silent zero results.
  - orriBurdenRateByTractId map is pre-computed once in buildLeaseholdUnitSummary and handed to buildLeaseholdDecimalRows for reuse. If the decimal-row builder is called with a different scope/unit-code context than the summary was built with, the cached burden map may diverge (DA-M7 guards against this via comment + test).
  - Unleased cost-bearing row: added per owner on each tract where leasedFraction < ownerFraction. If a tract has 0 gross acres or is otherwise zero-participation, unleased row is still 0 but occupies a row slot in the sheet (benign but verbose).
  - Input warnings (malformed royalty/burden/WI fractions) are collected during unit-summary build. They are attached to LeaseholdUnitSummary.inputWarnings and LeaseholdTractSummary.inputWarnings. If an input is malformed, it is treated as 0 in math; the UI surface the warning but the value does not error-out — it silently degrades to 0.
  - Read-flip governance (action-layer shadow reads): as of 2026-06, leasehold math is still store-scoped (Zustand snapshot). The action-layer LeaseholdUnitSummary projection is additive and shadow-only; no durable ledger mutation yet (DA-C1 fixed, but DA-H4/H5 ledger ordering + hash chain still open). No production flip enabled.

### runsheet-documents

*View: cross-cutting*

Runsheet presents a chronological instrument ledger (sorted by date, then filed) with tract filtering and kind facets. Documents provides a multi-view registry (inbox, runsheet, leasehold, curative, research, etc.) with metadata editing, duplicate detection, and attorney-packet export. Both are built on a unified document/attachment persistence layer that stores blobs/metadata in Dexie and caches attachment summaries on nodes.

- **Source of truth:** src/storage/document-store.ts (documents + document_attachments Dexie tables, workspace-scoped; Dexie is the single writer). src/types/document.ts defines DocumentRecord and DocumentAttachment contracts. src/store/workspace-store.ts owns the in-memory node.attachments[] cache and hydrates it from Dexie on workspace load.
- **Key files:** `src/views/RunsheetView.tsx`, `src/views/DocumentsView.tsx`, `src/documents/document-registry.ts`, `src/documents/duplicate-guard.ts`, `src/documents/packet-export.ts`, `src/storage/document-store.ts`, `src/storage/workspace-persistence.ts`, `src/storage/runsheet-export.ts`, `src/types/document.ts`, `src/types/node.ts`
- **Depends on** — changing these can break *this* feature:
  - **workspace-store** — workspace-store:nodes (OwnershipNode[]), workspace-store:deskMaps (DeskMap[]), workspace-store:attachDocToNode/detachDocFromNode actions, workspace-store:syncNodeAttachments. src/store/workspace-store.ts imports attachDocToNode/detachDocFromEntity from document-store.ts and maintains node.attachments[] in sync.
  - **title-math** — title-math consumes node.initialFraction, node.fraction (immutable data flow — documents never affect math). RunsheetView displays ofWholeFractionFormula(node).
  - **deskmap-view** — deskmap-view renders node.attachments[] as document chips (src/components/deskmap/deskmap-document-chips.tsx). Desk Map filters nodes by tract; Documents registry groups documents by linked tract via DocumentAttachment.entityKind='node' + deskMap.nodeIds.
  - **node-editor** — OwnershipNodeEditorModals can open a node from Runsheet/Documents; opens node editor via resolveNodeEditorRoute(node). RunsheetView uses pdfViewDocId state to route to PdfViewerModal.
  - **export-import-lifecycle** — exportDocumentWorkspaceData (src/storage/workspace-persistence.ts) exports documents + attachments scoped by workspaceId. replaceDocumentWorkspaceData replaces all workspace documents on .landroid import (workspace-replacing flow). Document blobs round-trip through .landroid export/import.
  - **blob-storage** — document-store.ts calls normalizePdfBlob (PDF validation), sha256HexOfBlob (content hash), and stores Blob in DocumentRecord. getDocBlob retrieves blob for PDF viewer. Dexie tables are the only persistence.
  - **db-key-scope** — document-store.ts uses activeStorageScopedId, activeWorkspaceScope, stampActiveDbKeyWithStorageId, stripDbKeyAndStorageId to scope documents and attachments by [dbKey + workspaceId]. v13 saved-project schema enforces per-project storage key.
  - **write-lease** — document-store.ts calls ensureWorkspaceWriteFence and assertWorkspaceWriteFence in every mutation to gate document changes when another tab holds the write lease.
- **Consumed by** — changing *this* feature can break these:
  - **runsheet-view** — src/views/RunsheetView.tsx displays OwnershipNode[], uses selectedNode.attachments.slice(0,4) to render 'Linked Document' chips; calls setPdfViewDocId to open PDF modal. Reads nodes from workspace-store. Does NOT mutate documents; node editor opens via separate modal.
  - **documents-view** — src/views/DocumentsView.tsx displays document registry rows built by buildDocumentRegistryRows (src/documents/document-registry.ts). Registry data loads via listDocumentRegistryData (document-store.ts). Displays linkedEntities (LinkedEntitySummary with entityKind, entityId, label, detail, tractIds). Metadata edit calls updateDocMetadata. Packet export calls downloadWorkspacePacket (packet-export.ts). PDF viewer calls getDocBlob.
  - **deskmap-view** — src/components/deskmap/deskmap-document-chips.tsx renders node.attachments[] (kind-keyed color, fileName). Opens PDF viewer on click.
  - **workspace-actions** — workspace-store.attachDocToNode (phase 5 saveDoc path), workspace-store.detachDocFromNode (detachDocFromEntity), workspace-store.renameDocOnNode (renameDoc), workspace-store.reorderNodeAttachments (reorderAttachments), workspace-store.syncNodeAttachments (listAttachmentsForNodes). All maintain node.attachments[] in sync with Dexie.
  - **node-normalization** — normalizeOwnershipNode (src/types/node.ts) normalizes node.attachments using normalizeAttachmentSummaries (validates each attachment shape, defaults kind to 'other' if invalid).
  - **runsheet-csv-export** — src/storage/runsheet-export.ts buildImagePath uses node.attachments.length > 0 && node.docNo to build TORS_Documents\{docNo}.pdf reference in CSV.
  - **workspace-persistence** — exportDocumentWorkspaceData exports workspace documents + attachments. replaceDocumentWorkspaceData replaces all on import. document blob serialization happens via blob-serialization helpers.
- **Shared contracts / invariants:**
  - DocumentRecord shape: docId, workspaceId, fileName, mimeType, byteLength, contentHash, blob, kind, documentArea, instrumentType, county, instrumentNumber, volume, page, effectiveDate, recordingDate, grantor, grantee, notes, sourceReference, ocrStatus, createdAt, updatedAt (src/types/document.ts)
  - DocumentAttachment shape: attachmentId, workspaceId, docId, entityKind ('node' | 'owner' | 'lease' | 'curative' | 'research'), entityId, position (0-indexed, dense, reassigned on delete), createdAt (src/types/document.ts)
  - NodeAttachmentSummary cache shape: docId, attachmentId, fileName, kind (denormalized on node for badge rendering; kept in sync by workspace-store actions)
  - DocumentRegistryRow: document (RegistryDocument), displayTitle, resolvedArea, linkedEntities (LinkedEntitySummary[]), duplicateDocIds, missingMetadata, needsOcr, searchText (src/documents/document-registry.ts)
  - LinkedEntitySummary: attachmentId, entityKind, entityId, tractIds, label, detail, position (cross-references node.id, deskMap.nodeIds for tract names)
  - DocumentArea: 'inbox' | 'runsheet_mineral_title' | 'leasehold' | 'curative' | 'research' | 'gis_map_support' | 'federal_reference' (saved-view categories)
  - DocumentKind: 'deed' | 'lease' | 'obit' | 'affidavit' | 'probate' | 'related' | 'other' (type tags; no behavior dependence, display-only)
  - DocumentRegistryViewId: 'all' | 'inbox' | 'runsheet_mineral_title' | 'leasehold' | 'curative' | 'research' | 'gis_map_support' | 'federal_reference' | 'unlinked' | 'missing_metadata' | 'duplicates' | 'needs_ocr' (view switching)
  - Workspace-scoped persistence: [dbKey + workspaceId] composite key on all document tables; stampActiveDbKeyWithStorageId adds dbKey, activeStorageScopedId queries by scope
  - contentHash uniqueness: SHA-256 hex of normalized blob; used to detect byte-identical duplicates at ingest and in the registry
  - Attachment position order: dense, 0-indexed within [entityKind, entityId] scope; position compacted on delete; reorderAttachments reassigns positions for explicit user ordering
- **Guards:**
  - **document-registry.test.ts** (`src/documents/__tests__/document-registry.test.ts`) — buildDocumentRegistryRows builds node links, derived area, duplicate status; filterDocumentRegistryRows applies view/kind/tract/linkedState/date filters; rowMatchesView classifies documents into saved views; buildPacketPreview/buildPacketManifest export summaries. Regression: missing linkedEntity for a node-attached document, wrong resolvedArea default, duplicate detection failures, metadata validation logic.
  - **duplicate-guard.test.ts** (`src/documents/__tests__/duplicate-guard.test.ts`) — inspectFileForDuplicates detects byte-identical files via SHA-256 hash lookup. hasDuplicates checks if inspection found matches. Regression: hash computation differs from saveDoc, duplicate detection misses existing files, warning surface fails.
  - **packet-export.test.ts** (`src/documents/__tests__/packet-export.test.ts`) — buildPacketArchiveFromData chains workspace → records → vault → packet export → archive. buildWorkspacePacketArchive filters documents by packetDocIds. Regression: missing document blobs in ZIP, manifest hash mismatches, Bates numbering off-by-one, wrong file counts.
  - **document-store.test.ts** (`src/storage/__tests__/document-store.test.ts`) — saveDoc creates document + attachment, content hash matches, attachment position appends. attachDocToEntity creates new attachment with next position. detachDocFromEntity removes attachment, compacts positions. deleteDoc cascades to attachments. reorderAttachments updates positions. Regression: orphaned attachments after detach, position gaps after delete, workspace scope leakage (wrong dbKey), transaction abort mid-cascade.
  - **document-migration.test.ts** (`src/storage/__tests__/document-migration.test.ts`) — v7 PDF rows → Phase 5 document records. migratePdfsToDocuments reads old pdfs table, normalizes blobs, creates documents + attachments keyed by nodeId. Regression: orphaned v7 PDFs (no matching node), wrong workspace scope on migrated rows, blob normalization failures, lost attachment order.
  - **runsheet-export.test.ts** (`src/storage/__tests__/runsheet-export.test.ts`) — buildImagePath uses node.attachments.length > 0 && node.docNo to build TORS_Documents reference. buildRunsheetRows exports all instrument columns. Regression: missing document reference when attachments present, wrong image path format, empty docNo bypasses reference.
  - **node-attachments.test.ts** (`src/types/__tests__/node-attachments.test.ts`) — normalizeAttachmentSummaries validates each attachment shape, defaults kind, rejects invalid entries. Regression: invalid kind not coerced, missing fields not defaulted, array mutation not caught.
  - **document-export-workspace-scope.test.ts** (`src/storage/__tests__/document-export-workspace-scope.test.ts`) — exportDocumentWorkspaceData and replaceDocumentWorkspaceData enforce workspace scope. Export filters by [dbKey + workspaceId]. Replace isolates import to target workspaceId only. Regression: document blobs leak between workspaces on import, old workspace documents not cascade-deleted on replace, wrong scope on attachment filters.
  - **.landroid round-trip** (`src/storage/workspace-persistence.ts, src/storage/document-store.ts`) — exportLandroidFile → exportDocumentWorkspaceData → documents + attachments serialized. importLandroidFile → replaceDocumentWorkspaceData → deserialized and restored. Regression: document blobs missing after round-trip, attachment links broken, metadata fields dropped, contentHash not preserved.
  - **MathInputView parity** (`src/project-records/projections.ts`) — Math consumes node (immutable input). Document changes never affect node.initialFraction or node.fraction. Regression: document attachment/deletion triggers recalculation, fraction values change unexpectedly.
- **Known fragility / refactor traps:**
  - Position compaction on detach: When an attachment is removed from a node, compactAttachmentPositions reassigns [0, n) immediately inside the transaction. If the UI or a test assumes position values remain stable across deletes, it will break. Every delete is followed by position normalization.
  - Duplicate detection timing: inspectFileForDuplicates hashes the ingest file, but saveDoc is the only writer that persists. If a concurrent write happens between detection and save, a duplicate might still be created. The write lease gate prevents this in multi-tab scenarios, but single-tab race conditions are not protected (saveDoc itself is atomic; the guard is pre-flight only).
  - Content hash immutability: contentHash is recorded at save time via sha256HexOfBlob(normalizedBlob). If the PDF normalization logic changes, old rows will have stale hashes. No migration path exists to rehash old documents without re-uploading. This is by design (hashes are immutable evidence), but it couples the ingest path to the normalization contract.
  - Attachment cache staleness: node.attachments[] is a denormalized cache synchronized by workspace-store actions. If Dexie mutations happen outside workspace-store (e.g., direct db.document_attachments.update), the cache becomes stale. Currently only workspace-store and autosave/import paths touch document tables; this assumption is protected by single-writer enforceWorkspaceWriteFence.
  - Registry search index: DocumentRegistryRow.searchText is built once per document during buildDocumentRegistryRows and never updated. If document metadata is edited via updateDocMetadata, the live row's searchText does not update until the UI reloads the registry (triggered by reloadToken increment). This is acceptable (search is live when the registry is refreshed) but can surprise if metadata is edited then immediately searched in the same render cycle.
  - LinkedEntity detail coalescence: LinkedEntitySummary.detail concatenates node.type, parties, and tract names with ' | ' separators. If any of these are empty or contain ' | ', the displayed detail becomes ambiguous. The field is display-only (no parsing), so it won't break logic, but it can confuse users.
  - Attachment ordering without explicit UI: reorderAttachments exists and works correctly, but there is no UI component to reorder attachments on a node. If a future feature adds ordering UI, the position field is ready. Currently attachment order is insertion-only (append to end).
  - DocumentArea defaulting: getDocumentResolvedArea applies a kind → area fallback (deed → runsheet_mineral_title, lease → leasehold, other → inbox). If the stored documentArea is invalid (typo or downgrade), normalizeDocumentArea defaults to 'inbox'. The registry row will show 'Inbox' even if the user previously set it to 'research'. No audit trail of the change; the value is silently corrected.
  - OCR status tracking: ocrStatus is a hook for future OCR integration (not_started | not_needed | complete | failed). Today it only affects the registry 'Needs OCR' view. If OCR integration lands without a schema migration, documents without ocrStatus will default to 'not_started' and appear in 'Needs OCR' even though they don't actually need OCR. Mitigation: migration or explicit 'not_needed' default in ingested documents.
  - Workspace load attachment hydration: syncNodeAttachments calls listAttachmentsForNodes and hydrates node.attachments[] from Dexie. If the Dexie query fails or returns incomplete data (e.g., a read after a concurrent write), the cache is silently used as-is (if strict=false). This means transient Dexie read failures can leave stale attachments in memory. Mitigation: the workspace-store is single-writer; read failures are rare.
  - Entity kind future scoping: DocumentAttachment.entityKind is defined as 'node' | 'owner' | 'lease' | 'curative' | 'research', but only 'node' is wired in Phase 5. The schema and Dexie indices are ready for multi-entity-kind linkage, but document-store operations and the registry all assume 'node'. If Phase 7B adds owner/lease document linking, the registry grouping and filtering logic will need updates to handle non-node entities.
  - Bates production set immutability: When Bates numbering is enabled on packet export, the ZIP contains a production/ subfolder with sequentially stamped copies. The originals in files/ remain byte-identical and hash-verified. If the user exports the same packet twice with different Bates prefixes, they get two separate production sets (one per export, not deduped). This is correct (production sets are transaction-scoped), but it can surprise users if they expect Bates numbers to be idempotent.

### maps

*View: Maps view + map asset/region management*

Store and manage map assets (PDF, PNG, GeoJSON), rectangular regions with metadata/links, external-system references, and ArcGIS tract geometry. Provides the GeoJSON-to-DeskMap crosswalk (tract feature matching, acreage-based auto-suggestion, warn-on-reimport). Map data never affects title math, ownership decimals, or Leasehold payout calculations.

- **Source of truth:** Dexie IndexedDB tables: `mapAssets` (metadata + blob), `mapRegions` (rectangles), `mapReferences` (external URLs/links), `mapTractFeatures` (ArcGIS GeoJSON polygons). Serialized in `.landroid` files as `MapWorkspaceData` section within the `LandroidFileData` envelope. Map store is workspace-scoped per `workspaceId`.
- **Key files:** `/Users/abstractmapping/projects/landroid/src/store/map-store.ts`, `/Users/abstractmapping/projects/landroid/src/types/map.ts`, `/Users/abstractmapping/projects/landroid/src/types/map-tract-feature.ts`, `/Users/abstractmapping/projects/landroid/src/types/external-ref.ts`, `/Users/abstractmapping/projects/landroid/src/storage/map-persistence.ts`, `/Users/abstractmapping/projects/landroid/src/storage/map-tract-feature-persistence.ts`, `/Users/abstractmapping/projects/landroid/src/views/MapsView.tsx`, `/Users/abstractmapping/projects/landroid/src/maps/geojson-ingest.ts`, `/Users/abstractmapping/projects/landroid/src/maps/feature-tract-matcher.ts`, `/Users/abstractmapping/projects/landroid/src/maps/tract-area.ts`, `/Users/abstractmapping/projects/landroid/src/maps/tract-reimport.ts`, `/Users/abstractmapping/projects/landroid/src/maps/tract-export.ts`, `/Users/abstractmapping/projects/landroid/src/maps/geojson-summary.ts`, `/Users/abstractmapping/projects/landroid/src/maps/map-asset-upload.ts`, `/Users/abstractmapping/projects/landroid/src/components/maps/TractMatcherPanel.tsx`, `/Users/abstractmapping/projects/landroid/src/components/maps/TractMapCanvas.tsx`
- **Depends on** — changing these can break *this* feature:
  - **workspace-store** — DeskMap.externalRefs (arc GIS ref array), DeskMap.code (tract code join), DeskMap.grossAcres (acreage string for matching), workspace.deskMaps (list to match features against)
  - **owner-store** — owner.id/name, lease.id/leaseName/lessee/docNo (for link metadata in MapAsset/MapRegion)
  - **research-store** — researchSourceId, researchProjectRecordId (optional back-links from map assets/regions to research sources/project records)
  - **document-store** — contentHash (maps use same blob hash contract for integrity; no direct data flow)
  - **curative-store** — curative issues can link to map assets/regions via assetId/regionId; unlinkage on deletion
  - **file-validation** — MAP_ASSET_ACCEPT (file type whitelist), validatePdfBytes (map-asset-upload uses for PDF magic-byte check)
- **Consumed by** — changing *this* feature can break these:
  - **workspace-store** — DeskMap.externalRefs → written by setFeatureTractMatch/removeTractFeature when matching tract features to desk maps; used only for display/external-system reference, not math
  - **MapsView/TractMatcherPanel** — all map-store state selectors (mapAssets, mapRegions, mapReferences, tractFeatures), actions (addAsset, removeAsset, updateAsset, setFeatureTractMatch, ingestGeoJsonTractFeatures, removeTractFeature)
  - **export/import (.landroid)** — exportWorkspaceData re-reads blob-bearing assets from Dexie (store holds metadata-only); replaceWorkspaceData normalizes and persists all map sections; .landroid LandroidFileData.mapData carries complete map workspace
  - **workspace-side-store-reset** — replaceMapWorkspaceData clears map assets/regions/references/tractFeatures on workspace import/replace
  - **undo-cascade-bundle** — bundled export/reapply includes full mapData; setWorkspace re-hydrates on undo restore
  - **demo-loading** — sample tract GeoJSON ingest + auto-match (Dr. Elmore demo loads bundled geojson, TractMatcherPanel auto-accepts matches)
  - **Desk Map unit-map-reference rail** — reads featured or unit-linked map asset to show alongside title tree (reference-only, zero math impact)
- **Shared contracts / invariants:**
  - ExternalRef: every DeskMap.externalRefs[] entry carries system/externalId/globalId/objectId/layerName/layerUrl (ArcGIS tract cross-link); defined in src/types/external-ref.ts; normalized by normalizeExternalRefs()
  - MapAsset metadata-first contract: in-memory store holds Omit<MapAsset,'blob'> (MapAssetMeta); blobs fetched on-demand via getMapAssetBlob(assetId) from Dexie for preview/export; mirrors document-store's blob separation
  - MapTractFeature GeoJSON round-trip: WGS84 lon/lat rings are canonical (source of truth); SVG projection computed at render time (never stored); re-ingesting same file idempotent (by featureId, preferring globalId > objectId > tractKey)
  - Tract matching: exact code↔tractKey match, then normalized (case/space/underscore-insensitive), then acreage crosswalk (greedy nearest-acre, one-feature-to-one-deskmap, within tolerance); human-confirmed suggestion, never silent auto-link
  - Content hash + byteLength on MapAsset mirrors document vault pattern (computed on save via saveMapAsset, optional for legacy/in-memory assets)
  - workspaceId scoping: every map record carries workspaceId; all Dexie operations query by workspaceId; project-picker switches active key, map store re-hydrates via setWorkspace(workspaceId)
- **Guards:**
  - **geojson-ingest.test.ts** (`/Users/abstractmapping/projects/landroid/src/maps/__tests__/geojson-ingest.test.ts`) — GeoJSON polygon parsing (WGS84 rings, holes, multipolygon), tract-key/acres extraction, warning generation on non-polygon features/invalid JSON; real ArcGIS export (10 tracts, Montgomery County)
  - **feature-tract-matcher.test.ts** (`/Users/abstractmapping/projects/landroid/src/maps/__tests__/feature-tract-matcher.test.ts`) — exact/normalized/acreage-based tract matching logic, no-silent-auto-link assertion, sibling-key separation (4 vs 4a), tolerance bounds; real Dr. Elmore unit (10 tracts, code TRn vs export keys 1–5/22)
  - **tract-area.test.ts** (`/Users/abstractmapping/projects/landroid/src/maps/__tests__/tract-area.test.ts`) — spherical-trapezoid area calculation (WGS84), hole subtraction, multipolygon summation, acreage tolerance (3 acres or 20% of size)
  - **geojson-summary.test.ts** (`/Users/abstractmapping/projects/landroid/src/maps/__tests__/geojson-summary.test.ts`) — GeoJSON label extraction + bbox computation for map-asset preview (not full geometry)
  - **tract-export.test.ts** (`/Users/abstractmapping/projects/landroid/src/maps/__tests__/tract-export.test.ts`) — CSV/GeoJSON export keyed LAND_TRACT_ID (per-tract roundtrip); includes node/owner/lease/ORRI/assignment metadata
  - **tract-reimport.test.ts** (`/Users/abstractmapping/projects/landroid/src/maps/__tests__/tract-reimport.test.ts`) — warn-and-choose logic: detects overlap with prior import, suggests replace or keep-both
  - **map-asset-upload.test.ts** (`/Users/abstractmapping/projects/landroid/src/maps/__tests__/map-asset-upload.test.ts`) — file-size/extension validation, PDF magic-byte check, blob preparation before insert
  - **external-ref.test.ts** (`/Users/abstractmapping/projects/landroid/src/types/__tests__/external-ref.test.ts`) — ExternalRef normalization (system enum, string fields, objectId parsing), reject empty refs
  - **.landroid round-trip** (`src/storage/workspace-persistence.ts`) — mapData serialized in LandroidFileData, tract features included in MapWorkspaceData; .landroid import/export preserves map assets (blobs), regions, references, tract features; parity test: demo load exports .landroid, reimport preserves all map state
  - **workspace-side-store-reset** (`/Users/abstractmapping/projects/landroid/src/storage/workspace-side-store-reset.ts`) — clearMapWorkspaceData on import/replace; replaceMapWorkspaceData normalizes and persists, clears prior state
- **Known fragility / refactor traps:**
  - DA2-M* map-feature lifecycle is recent (2026-04 through 2026-06); tract matching algorithm is heuristic (tolerance, tie-breaking) — real exports may have ambiguous matches; operator confirmation is the safety gate
  - GeoJSON re-ingest is idempotent by featureId (assetId+tractKey/objectId/globalId), but a manual delete + re-add of the same file creates a fresh assetId with new feature ids — no dedup warning
  - Feature-to-DeskMap link is mutable (setFeatureTractMatch); unmatching a feature clears the ExternalRef from the old DeskMap, but ExternalRef presence/absence in workspace-store is not journaled — map links are reference-only and do not create title-ledger entries
  - Acreage-tolerance matching is greedy (nearest-acre, one-to-one, smallest-distance-first) — not an optimal-assignment solver; real exports with many similar-sized tracts may produce unexpected pairings; human review is required
  - Map assets are metadata-first (blob lazy-loaded), so project load is O(metadata count) not O(blob bytes); but export/undo must re-read blobs from Dexie, creating a window where blob writes and title mutations could race if autosave timing changes
  - Map data survives workspace-clearing (clearDeskMapNodes/deleteDeskMap) — assets/regions/features are NOT deleted when linked DeskMap is cleared; unlinkage is only on removal of the asset/region itself or when the linked entity is deleted
  - Tract feature match history is not tracked — re-matching the same feature to a different DeskMap overwrites the prior match with no audit; ExternalRef is updated on the new DeskMap but the old one is cleared retroactively
  - contentHash on MapAsset is optional (mirrors document contract), but storage integrity relies on it for future dedup-on-ingest and re-import warning; blank/null hashes round-trip but weaken the warning logic
  - Map-asset GIS link (ExternalRef) and map-region links (to DeskMap/node/owner/lease/research) are all reference-only and may become stale if linked entities are deleted; orphan links are cleaned up on deletion but are not proactively scanned
  - Per-tract region placement uses rectangles only (x, y, width, height, page); future polygon/freeform drawing would require a new geometryKind and schema migration

### Curative: Title Issue Tracking & Defect Workflow

*View: Curative (dedicated curative-issues tab)*

Manage, track, and document title defects, missing curative actions (heirship affidavits, lease ratifications, liens, NPRIs), and curative-readiness holds. Issues can be linked to specific tracts, ownership branches, owners, and leases, and filter in/out of payout transfer-order holds and desk-map warning dots based on open Critical/High priority.

- **Source of truth:** IndexedDB Dexie titleIssues table (workspace-scoped, db-keyed as of v10 sharding). Format: TitleIssue record with id, workspaceId, status, priority, issueType, and four optional entity links.
- **Key files:** `/Users/abstractmapping/projects/landroid/src/store/curative-store.ts`, `/Users/abstractmapping/projects/landroid/src/storage/curative-persistence.ts`, `/Users/abstractmapping/projects/landroid/src/types/title-issue.ts`, `/Users/abstractmapping/projects/landroid/src/views/CurativeView.tsx`, `/Users/abstractmapping/projects/landroid/src/curative/curative-labels.ts`, `/Users/abstractmapping/projects/landroid/src/curative/requirement-report.ts`, `/Users/abstractmapping/projects/landroid/src/components/deskmap/curative-deskmap-flags.ts`
- **Depends on** — changing these can break *this* feature:
  - **Workspace State (nodes, deskMaps, owners, leases)** — CurativeView reads deskMaps, nodes, owners, leases from workspace-store and owner-store to populate link dropdowns and render affected-entity summaries. requirement-report reads context to resolve issue links to labels.
  - **Write-Lease Gate** — CurativeView checks useWorkspaceReadOnly before allowing add/update/remove actions.
  - **Persistence & DB-Key Scoping** — curative-persistence uses db.titleIssues with activeWorkspaceScope and stampActiveDbKeyWithStorageId for v10 sharding.
- **Consumed by** — changing *this* feature can break these:
  - **Desk Map Warning Dots** — countOpenHighRiskCurativeIssuesForDeskMap reads titleIssues, filters by isOpenHighRiskTitleIssue + deskMapId/nodeId match. DeskMapTabs uses this to render warning dots.
  - **Document Attachments** — document_attachments table links docs to curative issue IDs. packet-export includes unresolved issues in attorney packets.
- **Shared contracts / invariants:**
  - TitleIssue: id, workspaceId, title, issueType (enum), priority (enum), status (enum), affectedDeskMapId?, affectedNodeId?, affectedOwnerId?, affectedLeaseId?, sourceDocNo, requiredCurativeAction, responsibleParty, dueDate, notes, resolutionNotes, createdAt, updatedAt.
  - Closed: status='Resolved' or 'Deferred'. Open high-risk: !closed AND priority=Critical/High.
  - Sorting: closed after open; by dueDate (null='9999-12-31'); by updatedAt desc.
  - If affectedDeskMapId and affectedNodeId both set, node must be in deskMap.nodeIds. If affectedOwnerId and affectedLeaseId both set, lease.ownerId must == affectedOwnerId.
  - Database scoped by workspaceId; v10 also by dbKey.
- **Guards:**
  - **curative-store.test.ts** (`/Users/abstractmapping/projects/landroid/src/store/__tests__/curative-store.test.ts`) — Store loads/adds/updates/removes issues; unlinks entities without deleting issue; forces workspaceId to active workspace.
  - **title-issue.test.ts** (`/Users/abstractmapping/projects/landroid/src/types/__tests__/title-issue.test.ts`) — Normalization sanitizes junk enums, non-strings, empty links to safe defaults; filters malformed rows.
  - **requirement-report.test.ts** (`/Users/abstractmapping/projects/landroid/src/curative/__tests__/requirement-report.test.ts`) — Report numbers issues, resolves links to labels, falls back to 'Unlinked' for dangling refs, counts total/open/critical.
  - **curative-deskmap-flags.test.ts** (`/Users/abstractmapping/projects/landroid/src/components/deskmap/__tests__/curative-deskmap-flags.test.ts`) — Flag helpers count open Critical/High by deskMapId or nodeId, ignore closed/Medium/Low, count cross-links once, sum distinct across unit tracts.
- **Known fragility / refactor traps:**
  - Cascade race: unlink operations call saveTitleIssue fire-and-forget while set() completes synchronously; undo snapshot may capture inconsistent state. workspace-store awaits cascade after journal verdict but journal verdict timing is not guaranteed to be before undo capture.
  - Node-deskMap sync: If node moves to different deskmap after issue creation, affectedDeskMapId becomes stale. Validation on load clears nodeId if broken; CurativeView UI prevents new broken links by filtering node options by deskMapId.
  - Lease-owner sync: Similar stale reference risk if lease is reassigned. CurativeView prevents on edit by filtering leases by ownerId.
  - Normalization called in store operations AND in persistence layer on load. If schema drifts, may not catch all corruption.
  - sortTitleIssues logic duplicated in curative-store.ts and curative-persistence.ts; must stay in sync.
  - updatedAt touched only in updateIssue, not addIssue. createdAt stable, updatedAt reflects most recent change.
  - Curative issue updates not journaled; undo of deskmap delete captures affected issues via undo-cascade-bundle but concurrent curative edits could cause mismatch.

### research

*View: research*

Reference-only workspace for project sources, formulas, shared project records, saved questions, and RRC data imports; federal/private content stays structurally separate from Texas math core. Research provides the catalog backbone for Federal Leasing and map asset links without affecting active title/ownership calculations.

- **Source of truth:** Dexie v7+ side-store tables (researchImports, researchSources, researchFormulas, researchProjectRecords, researchQuestions), scoped by [dbKey+workspaceId] composite key via workspace-write-lease and active-storage helpers. Import blobs are serialized base64 in .landroid files. Research data is workspace-scoped metadata/reference only.
- **Key files:** `/Users/abstractmapping/projects/landroid/src/store/research-store.ts`, `/Users/abstractmapping/projects/landroid/src/types/research.ts`, `/Users/abstractmapping/projects/landroid/src/storage/research-persistence.ts`, `/Users/abstractmapping/projects/landroid/src/views/ResearchView.tsx`, `/Users/abstractmapping/projects/landroid/src/research/rrc-delimited-text.ts`, `/Users/abstractmapping/projects/landroid/src/research/rrc-fixed-width.ts`, `/Users/abstractmapping/projects/landroid/src/research/rrc-drilling-permit-master.ts`, `/Users/abstractmapping/projects/landroid/src/research/rrc-horizontal-drilling.ts`, `/Users/abstractmapping/projects/landroid/src/research/rrc-pending-drilling.ts`, `/Users/abstractmapping/projects/landroid/src/research/formula-starters.ts`, `/Users/abstractmapping/projects/landroid/src/research/research-import-metadata.ts`
- **Depends on** — changing these can break *this* feature:
  - **workspace** — workspaceId scoping, project-lifecycle setWorkspace/replaceWorkspaceData entry point via project-workspace-lifecycle.ts
  - **document-registry** — research area label exists (document-registry.ts:18,35) but no document link is wired on research records today (DA2-R2)
  - **storage/workspace-persistence** — researchData serialization/deserialization in .landroid file format (workspace-persistence.ts:159,1529-2114), includes base64 blob encoding for imports
  - **storage/write-lease** — workspace-write-lease.ts: write-fence assertion for optimistic-update rollback safety on persistence failures (DA2-R1 mitigation)
  - **storage/db-key-scope** — activeStorageScopedId, activeWorkspaceScope, stampActiveDbKeyWithStorageId helpers for multi-workspace isolation
- **Consumed by** — changing *this* feature can break these:
  - **federal-leasing** — ResearchProjectRecord (recordType='Federal Lease'/...) and ResearchSource link via FederalLeasingView.tsx; federal-lease-tracking.ts queries research store for attached sources/records; no reverse link validates
  - **maps** — mapAssets/mapRegions.researchSourceId/researchProjectRecordId foreign keys (db.ts v7+); map-store normalizes but does not validate these links; deleted research records leave dangling pointers (DA2-R4, DA2-M6)
  - **export/import** — buildCurrentLandroidData exports researchData via useResearchStore.exportWorkspaceData(); loadLandroidFile imports researchData via replaceWorkspaceData; .landroid round-trip includes base64-encoded import blobs and link sanitation (sanitizeResearchLinks checks deskMapId/nodeId/ownerId/leaseId/mapAssetId validity)
  - **ai/undo-store** — AI undo snapshot does NOT capture research data (ai/undo-store.ts:74-85 captures owner/curative/map only, research left live)
- **Shared contracts / invariants:**
  - ResearchObjectLinks shape: deskMapId, nodeId, ownerId, leaseId, mapAssetId, mapRegionId, importId (all nullable); no documentId field today (DA2-R2)
  - LeaseJurisdiction discriminator on ResearchProjectRecord.jurisdiction ('Federal / BLM', 'Texas', 'Private', 'General') gates federal math readiness but does not enforce isolation
  - ResearchContext options ('Texas', 'Federal / BLM', 'Private', 'General', 'Other') for source and project-record jurisdiction
  - workspaceId scoping: every record carries workspaceId; persisted with dbKey stamp; import/export normalizes and validates
  - updatedAt timestamp pattern: touch() helper applied to all mutations for audit trails (though not connected to action-ledger yet)
  - Workspace-replace clears all research data via replaceResearchWorkspaceData; CSV import starts fresh research store; .landroid import restores full research data
  - Formula starters batch pattern: buildResearchFormulaStarterRecords compiles in Texas math reference cards with Needs Review status (RESEARCH_FORMULA_CATEGORY_OPTIONS, sourceIds linkage)
- **Guards:**
  - **research-store.test.ts** (`/Users/abstractmapping/projects/landroid/src/store/__tests__/research-store.test.ts`) — workspace-scoped import/save/delete, dependent link cleanup on source/formula/projectRecord/import deletion, optimistic-update rollback on persistence failure (DA2-R1), formula rapid-edit handling, workspace isolation
  - **research.test.ts** (`/Users/abstractmapping/projects/landroid/src/types/__tests__/research.test.ts`) — normalization and validation of ResearchSource/Formula/ProjectRecord/Question/Import types; ResearchObjectLinks sanitization
  - **formula-starters.test.ts** (`/Users/abstractmapping/projects/landroid/src/research/__tests__/formula-starters.test.ts`) — formula-starter CSV batch builder, dedup-by-title, field mapping
  - **rrc-delimited-text.test.ts, rrc-fixed-width.test.ts, rrc-drilling-permit-master.test.ts, rrc-pending-drilling.test.ts, rrc-horizontal-drilling.test.ts** (`/Users/abstractmapping/projects/landroid/src/research/__tests__/*.test.ts`) — RRC import format detection, delimited/fixed-width parsing, permit decoding, null-byte handling
  - **research-import-metadata.test.ts** (`/Users/abstractmapping/projects/landroid/src/research/__tests__/research-import-metadata.test.ts`) — import fingerprinting, metadata draft dirty-tracking
  - **workspace-persistence.ts load/serialize pipeline** (`/Users/abstractmapping/projects/landroid/src/storage/workspace-persistence.ts`) — researchData deserialization (lines 2013-2078), blob base64 round-trip for imports (lines 1544-1548), link sanitation on import via sanitizeResearchLinks (checks validity sets)
- **Known fragility / refactor traps:**
  - DA2-R1 (High): optimistic updates in useResearchStore apply mutations before persistence completes; no async catch rolls back on Dexie fence loss (persistOrRevert pattern at research-store.ts:91-110 mitigates but is localized to this store, not shared across curative/map/owner stores)
  - DA2-R2 (High): ResearchSource/Formula/ProjectRecord/Question have no documentId field; evidence PDFs cannot be filed in the document registry; sources can only attach evidence via links.importId (RRC staging blob); statute/case PDFs stay orphaned
  - DA2-R3 (Medium): one-way link rot — deleting workspace nodes/owners/leases never clears research links.* (cleanup exists only research→research and on import); mirror of workspace-store cascade pattern at lines 792-807, 1187-1215 and owner-store lines 195-247
  - DA2-R4 (Medium): mapAssets.researchSourceId/researchProjectRecordId are unvalidated on import and uncleaned on research-record delete, leaving dangling foreign keys
  - DA2-R5 (Medium): catalog-readiness schema gaps for TXM corpus (no stable human-readable ID, no authority-year, status enum lacks SETTLED/SPLIT/FACT-SPECIFIC, no temporal-applicability fields); file-driven ingestion missing (only compiled-in batch builders exist)
  - DA2-FED1 (High): Federal Leasing rich fields (royalty/bonus/rental/stipulations) live only in demo-populated in-memory map (federal-lease-seed.ts:254), not persisted; user-editable form disabled; fields are volatile across reloads
  - Research data not captured by AI undo-store (undo-store.ts line 74-85 snapshots owner/curative/map only, research left live) — AI edits cannot roll back research context
  - Export/import: researchData includes base64-encoded import blobs within .landroid file toward the 500MB cap with no warning (DA2-R9); DA2-L8 version-gate bypass in workspace-persistence.ts:1549-1557 allows non-numeric version to fall through to legacy path, partially uneven normalization across stores (owner docs/map assets/research imports spread with extra keys; owners/contacts normalize field-by-field)
  - ResearchProjectRecord fields for Federal Leasing (mlrsSerial, legacySerial, effectiveDate, expirationDate, nextAction, nextActionDate) are text strings with no validation (DA2-FED4: no format validation, no dedupe); normalizeLeaseJurisdiction throws on unknown values → whole .landroid import fails instead of quarantining (DA2-FED5)
  - Research link validation happens only at import time via sanitizeResearchLinks (types/research.ts:572-619); runtime deletes do not cascade; orphaned links are exported forever (DA2-R3, DA2-M6)
  - ResearchView is 3,326 lines (DA2-R11); global search filters the dataset catalog invisibly (DA2-R6); per-render option-array rebuild → O(n·links) re-search per keystroke at scale (DA2-R8)

### federal-leasing

*View: federal-leasing (workspace tab)*

Store federal and private lease reference records (inventory, targets, units, mapped tracts) that track expirations, serials, and evidence without participating in Texas title-tree or leasehold math.

- **Source of truth:** ResearchProjectRecord rows in research-store (jurisdiction='Federal / BLM'), persisted via research-persistence to IndexedDB. FederalLeaseDocument payloads (BLM 3100-11 form details) stored in in-memory registry (federal-lease-seed.ts).
- **Key files:** `src/federal-leasing/federal-lease-tracking.ts`, `src/views/FederalLeasingView.tsx`, `src/storage/federal-lease-seed.ts`, `src/storage/seed-test-data.ts`, `src/types/research.ts`, `src/components/modals/LeaseDocumentModal.tsx`
- **Depends on** — changing these can break *this* feature:
  - **research-store** — projectRecords array (ResearchProjectRecord[]), add/update/removeProjectRecord actions, workspaceId context
  - **research-persistence** — Dexie persistence layer for ResearchWorkspaceData (sources, formulas, projectRecords, questions, imports)
  - **map-store** — mapAssets, mapRegions, setFeaturedAsset action; federal records link to maps via mapAssetId, mapRegionId
  - **owner-store** — owners, leases arrays; federal records link via ownerId, leaseId (navigation only, no math coupling)
  - **workspace-store** — deskMaps, nodes, setActiveDeskMap, setActiveNode; federal records link via deskMapId, nodeId (navigation only)
  - **ui-store** — setView action to navigate to research, chart, owners, maps views from federal context
  - **write-lease-store** — useWorkspaceReadOnly selector determines if federal records are editable
  - **types:research** — ResearchProjectRecord, ResearchContext enum ('Federal / BLM'), ResearchProjectRecordType options
- **Consumed by** — changing *this* feature can break these:
  - **research-view** — FederalLeasingView is lazy-loaded and rendered when view='federal-leasing' (App.tsx)
  - **navigation** — FederalLeasingView appears as a tab in workspace navigation (Navbar)
  - **workspace-lifecycle** — Federal records are reset/cleared during workspace replacement (workspace-side-store-reset.ts replaces research store data)
- **Shared contracts / invariants:**
  - ResearchProjectRecord carries jurisdiction discriminator (='Federal / BLM') to filter from Texas records
  - Federal records may link to Texas Desk Map nodes/owners/leases but do NOT participate in their math (deskMapId/nodeId/ownerId/leaseId are reference links only)
  - MathInputView jurisdiction-isolation precondition (projections.ts:131-152) blocks non-Texas-jurisdiction leases from Texas Leasehold calculations
  - LeaseJurisdiction enum (owner.ts) provides Phase 2 attachment point; Phase 1 leases remain 'tx_fee' only
  - Federal records preserved in .landroid exports/imports through ResearchWorkspaceData serialization
  - FederalLeaseDocument (BLM 3100-11 form) stored in memory-only registry keyed by recordId; not persisted to Dexie or .landroid
- **Guards:**
  - **federal-lease-tracking tests** (`src/federal-leasing/__tests__/federal-lease-tracking.test.ts`) — isFederalLeasingRecord, isFederalTargetRecord, isCurrentFederalLeaseRecord predicates; getFederalLeaseExpirationBucket date bucketing; buildFederalLeaseSummary excludes non-federal records; federalLeaseMatchesSearch cross-field indexing; sortFederalLeaseRecordsByUrgency ordering
  - **federal-lease-seed tests** (`src/storage/__tests__/federal-lease-seed.test.ts`) — buildRavenForestFederalLeases produces 5 records with correct MLRS serials, units, lessees, royalty fractions; FederalLeaseDocument registry get/set/clear
  - **jurisdiction isolation** (`src/project-records/__tests__/title-math-parity.test.ts (implied) + projections.ts:131-152`) — JurisdictionIsolationPrecondition blocks non-Texas-jurisdiction leases; MathInputView excludes them from Leasehold calculations
  - **research import/export** (`src/types/__tests__/research.test.ts`) — normalizeResearchProjectRecord preserves jurisdiction, sourceIds, mapAssetId, deskMapId, nodeId, ownerId, leaseId; sanitizeResearchLinks removes stale cross-entity references
- **Known fragility / refactor traps:**
  - FederalLeaseDocument registry is memory-only: if browser reloads before seeding completes, document lookups return null. Seed must run during app bootstrap (seed-test-data.ts integration). No persistence layer yet (forward-compat stub in LeaseDocumentModal.tsx)
  - Federal records can link to Texas Desk Map nodes/owners/leases via foreign keys (deskMapId, nodeId, ownerId, leaseId), creating implicit cross-feature dependencies that are only navigation links — do NOT affect math. If a referenced node/owner/lease is deleted, the federal record's link is stale. sanitizeResearchLinks in import/export cleans invalid links.
  - Jurisdiction precondition in projections.ts gates federal math. If a record somehow gets jurisdiction='Federal / BLM' but the UI tries to include it in Texas Leasehold calculations, the math engine will fail early. This is documented in ARCHITECTURE.md §Domain Boundaries and PROJECT_CONTEXT.md §Jurisdictional scope (Phase 2 gate intact).
  - Federal records are owned by research-store, not workspace-store. Workspace-replacing flows (`.landroid` import, CSV import, demo load) reset research data through replaceWorkspaceSideStores. Federal records cannot survive a workspace replacement unless explicitly re-imported from `.landroid`.
  - sortFederalLeaseRecordsByUrgency uses record.updatedAt as final tiebreaker. Clock skew or out-of-order createdAt timestamps could cause non-deterministic sort order in rare cases.
  - ExpirationBucket calculation depends on ISO date parsing (YYYY-MM-DD). Malformed dates silently degrade to 'missing' bucket. No warning if user enters 2026-13-01 or 2026-02-30.

### AI feature area

*View: cross-cutting*

Approval-gated AI mutations on workspace data, local-first with hosted minimal-context policy; single undo snapshot per approved batch; AI state clears on workspace replacement.

- **Source of truth:** Zustand stores: `useAIApprovalStore` (proposals), `useAIUndoStore` (snapshot), `useAISettingsStore` (provider/model), `useAIActionJournalStore` (history); Vercel AI SDK with approval wrapper.
- **Key files:** `/Users/abstractmapping/projects/landroid/src/ai/approval-store.ts`, `/Users/abstractmapping/projects/landroid/src/ai/undo-store.ts`, `/Users/abstractmapping/projects/landroid/src/ai/runChat.ts`, `/Users/abstractmapping/projects/landroid/src/ai/tools.ts`, `/Users/abstractmapping/projects/landroid/src/ai/settings-store.ts`, `/Users/abstractmapping/projects/landroid/src/ai/action-journal.ts`, `/Users/abstractmapping/projects/landroid/src/ai/app-context.ts`, `/Users/abstractmapping/projects/landroid/src/ai/client.ts`, `/Users/abstractmapping/projects/landroid/src/ai/system-prompt.ts`, `/Users/abstractmapping/projects/landroid/src/ai/approval-preview.ts`, `/Users/abstractmapping/projects/landroid/src/ai/chat-context.ts`, `/Users/abstractmapping/projects/landroid/src/storage/workspace-side-store-reset.ts`, `/Users/abstractmapping/projects/landroid/src/app/project-workspace-lifecycle.ts`
- **Depends on** — changing these can break *this* feature:
  - **workspace-store** — src/store/workspace-store:useWorkspaceStore — nodes, deskMaps, leaseholdAssignments, leaseholdOrris, leaseholdTransferOrderEntries, activeDeskMapId, activeUnitCode, activeNodeId; AI mutations call workspace-store actions (addNode, convey, createNpri, deleteNode, graftToParent, attachLease, createDeskMap, setActiveDeskMap) via approval executors
  - **owner-store** — src/store/owner-store:useOwnerStore — owners, leases, contacts, docs; AI tools call createOwner, createLease; approval.snapshot exports/restores owner data via replaceWorkspaceData
  - **curative-store** — src/store/curative-store:useCurativeStore — titleIssues; deleteNode cascades curative links; undo snapshot restores curative data
  - **map-store** — src/store/map-store:useMapStore — mapAssets, mapRegions, mapReferences, tractFeatures; deleteNode cascades map links; undo snapshot restores map data
  - **title-action-log** — src/store/title-action-log.ts — useTitleActionLog.getState().actionRecords length at snapshot capture; undo marks records by position range; ledger cleared on workspace replacement
  - **title-math** — src/title-math — executeCreateRootNode, executeConvey, executeCreateNpri, executePredecessorInsert, executeAttachConveyance, executeDeleteBranch, validateOwnershipGraph for approval preview validation
  - **document-store** — src/storage/workspace-persistence — exportDocumentWorkspaceData, replaceDocumentWorkspaceData for undo snapshot
  - **canvas-store** — src/store/canvas-store via undo restoreSnapshot + hydrateNodeAttachments for flowchart node sync
  - **project-records** — src/project-records/projections.ts — CitationVerifierClaim/Result/Input contracts for deferred AI answer verification (DEF-AI-01); action-journal reads from title-action-log chain
  - **workspace-side-store-reset** — src/storage/workspace-side-store-reset.ts — replaceWorkspaceSideStores/replaceWorkspaceSideStoresWithRollback clears useAIApprovalStore, useAIActionJournalStore, useAIUndoStore on workspace import/replacement
  - **auth/session** — src/auth/session.ts — getIdToken() for hosted proxy requests; triggerUnauthorized() on 401
  - **deploy-env** — src/utils/deploy-env:isHostedMode() — determines tool availability and system prompt build
- **Consumed by** — changing *this* feature can break these:
  - **AIPanel component** — src/ai/AIPanel.tsx reads useAIApprovalStore.proposals, calls removeApprovalProposal, refreshApprovalPreviews, approveAIProposal, restoreSnapshot from useAIUndoStore, reads undoSnapshot.snapshot, calls clearSnapshot
  - **AISettingsPanel component** — src/ai/AISettingsPanel.tsx reads/writes useAISettingsStore (provider, model, ollamaBaseURL, openaiApiKey, anthropicApiKey, hostedContextMode, acceptHostedFullContextDisclosure)
  - **Navbar** — src/components/shared/Navbar.tsx calls importAndOpenWorkspace which triggers workspace lifecycle clear on AI stores
  - **workspace lifecycle** — src/app/project-workspace-lifecycle.ts calls useAIApprovalStore.clear() and useAIUndoStore.clear() on loadWorkspace entry
  - **chat-context** — src/ai/chat-context.ts prepends actionJournal entries as model context before each runChatTurn
  - **runChatTurn** — Called by AIPanel to stream assistant text, handle tool results, and conditionally snapshot on mutations
  - **tools** — Each tool (createRootNode, convey, createNpri, etc.) gates on UNDO_MUTATING_TOOL_NAMES to decide snapshot commit; all return { ok, validation, ...ids }
- **Shared contracts / invariants:**
  - AIApprovalProposal shape: id (string), toolName (string), input (unknown), summary (string), details[], preview (AIApprovalPreview), createdAt (number)
  - AIApprovalPreview contract: canApprove boolean gating; validation.status one of 'valid'|'issues'|'blocked'|'not_applicable'; mutating tools MUST return { ok?: boolean, approvalRequired?: boolean, validation?: AIActionJournalValidation, ...other } from preview.buildAIApprovalPreview(toolName, input)
  - UndoSnapshot contract: titleLedgerLength (for range marking), workspaceId, workspace (full node/deskMap snapshot), owner, curative, map, documents (all deep-cloned), label
  - AI_UNDO_SNAPSHOT_SECTIONS readonly array — workspace, owner, curative, map, documents — defines restoreSnapshot() contract
  - AIApprovalDetail[] for details panel display
  - AIActionJournalEntry: proposalId, toolName, summary, details, status ('applied'|'failed'|'undone'), resultSummary, validation, createdAt
  - AIAppContext mode contract: 'minimal' (counts/structure only, no names/fractions/IDs) or 'full' (bounded project summary with all detail)
  - Hosted context policy: hostedContextMode gates between minimal (always safe) and full (requires per-workspace disclosure); settings.hostedFullContextAcceptedWorkspaceId must match workspaceId before full context sends
  - System prompt contract: buildLandroidSystemPrompt({ toolsAvailable: boolean }) — advisory build (hosted) must pass toolsAvailable=false and describe no tools; tool build (local) passes true and documents each mutator
  - Mutation executor registration: registerAIMutationExecutor(toolName, executor) where executor takes input (unknown) and returns Promise<unknown>; executor is called under withMutationOrigin('ai', ...) scope for title journal origin tagging
- **Guards:**
  - **approval-store.test.ts** (`/Users/abstractmapping/projects/landroid/src/ai/__tests__/approval-store.test.ts`) — live preview refresh on state change (DA-M12); duplicate proposal collapse; concurrent approve idempotence; re-assert before execute blocks invalid mutations
  - **approval-preview.test.ts** (`/Users/abstractmapping/projects/landroid/src/ai/__tests__/approval-preview.test.ts`) — each tool's preview validates against current state; canApprove gates on validation status and graph health
  - **action-journal.test.ts** (`/Users/abstractmapping/projects/landroid/src/ai/__tests__/action-journal.test.ts`) — journal entry creation, detail building, status transitions, undone marking by label
  - **undo-store.test.ts** (`/Users/abstractmapping/projects/landroid/src/ai/__tests__/undo-store.test.ts`) — snapshot capture scope (all five stores), restoration idempotence, deepClone integrity
  - **undo-ledger.test.ts** (`/Users/abstractmapping/projects/landroid/src/ai/__tests__/undo-ledger.test.ts`) — title ledger range marking for undo; undo marks exact records by position, not time
  - **runChat.test.ts** (`/Users/abstractmapping/projects/landroid/src/ai/__tests__/runChat.test.ts`) — tool call streaming, snapshot capture on mutation
  - **runChat-hosted.test.ts** (`/Users/abstractmapping/projects/landroid/src/ai/__tests__/runChat-hosted.test.ts`) — hosted proxy rejects tools/tool_choice; enforces hostedFullContextAcceptedWorkspaceId check before full context; sends advisory prompt on hosted path; returns generic errors
  - **system-prompt.test.ts** (`/Users/abstractmapping/projects/landroid/src/ai/__tests__/system-prompt.test.ts`) — tool build includes tool sections; advisory build omits all tool references; rule 8 differs by build; toolsAvailable flag determines system prompt shape
  - **settings-store.test.ts** (`/Users/abstractmapping/projects/landroid/src/ai/__tests__/settings-store.test.ts`) — persistence of provider/model/ollamaBaseURL only (not cloud keys); migration and merge from persisted state
  - **app-context.test.ts** (`/Users/abstractmapping/projects/landroid/src/ai/__tests__/app-context.test.ts`) — minimal context omits names/fractions/remarks; full context includes bounded summary; MAX_CONTEXT_NODES limit (40) for active desk map; unit filtering
  - **chat-context.test.ts** (`/Users/abstractmapping/projects/landroid/src/ai/__tests__/chat-context.test.ts`) — action journal prepended to messages as model context
  - **workspace-side-store-reset.test.ts** (`/Users/abstractmapping/projects/landroid/src/storage/__tests__/workspace-side-store-reset.test.ts`) — AI stores (approval, journal, undo) cleared after side-store replacement completes
  - **project-workspace-lifecycle.test.ts** (`/Users/abstractmapping/projects/landroid/src/app/project-workspace-lifecycle.test.ts`) — AI stores cleared on loadWorkspace entry
  - **tools.test.ts** (`/Users/abstractmapping/projects/landroid/src/ai/__tests__/tools.test.ts`) — read-only tools (summariseProject, listDeskMaps, etc.) return compact summaries; mutating tools require approval
  - **read-only-tools.test.ts** (`/Users/abstractmapping/projects/landroid/src/ai/__tests__/read-only-tools.test.ts`) — read-only tool determinism — same state returns same output
- **Known fragility / refactor traps:**
  - DA-M12 (approval-preview stale state): preview computed once at enqueue time; user edits graph before approval; AI panel calls refreshPreviews() on workspace changes to keep cards live, but a rare race window exists where user final-clicks approve against stale before refresh fires
  - DA-H4 (workspace replacement ledger/state mismatch): actionJournal clears during replaceWorkspaceSideStores finalization; if a concurrent chat turn is in flight, it could record mutations against the old workspace ID; lifecycle loads and imports both call loadWorkspace before replaceWorkspaceSideStores so concurrent calls are rare but guarded by workspaceId check in runHostedProxyChatTurn
  - ACT-M01 (origin provenance): AI mutations tagged as 'ai' origin in title journal, but host origin (AI vs import vs direct user) not preserved; only first-class fix is passing originSource through entire approval path
  - Hosted context mode disclosure: hostedFullContextAcceptedWorkspaceId must match current workspaceId; user can enable full context per workspace but no audit of when/where the disclosure was accepted
  - Snapshot deep-clone boundary: structuredClone() preferred but falls back to JSON clone, which drops Blob data in owner docs; undo snapshot has null Blobs but IndexedDB restore via replaceDocumentWorkspaceData fetches fresh doc metadata and can rebuild; if a document was deleted between enqueue and undo, the undo restores metadata but not the blob
  - Tool executor in-flight map: inFlightApprovals prevents duplicate execution on fast double-click, but the proposal is removed from state only after executor resolves; if a third approveAIProposal() call fires while the first is awaiting, it gets the same promise but the proposal is not re-added if removed in between
  - MathInputView not passed to approval preview: preview calls executeCreateRootNode etc. directly on cloned state, not via MathInputView projection; if preview math diverges from live math input, canApprove could gate wrong
  - Texas math boundary in AI context: appContext includes all owners/leases without checking jurisdiction; ai/tools.ts:getLessorRoster, tools.ts:attachLease, and approval-preview all reference isTexasMathLeaseJurisdiction to block non-Texas leases, but if a lease record carries the wrong jurisdiction enum, the block is only as strong as that field's hydration integrity
  - Action journal MAX_ACTION_JOURNAL_ENTRIES (25): old entries drop silently when new ones arrive; no persistence, so browser refresh loses history; intentional for now but user cannot audit old approved actions without exporting .landroid
  - Citation verifier deferred: CitationVerifierInput/Output contracts exist but no actual verifier is called in any runChatTurn or response path; AI answers that cite documents cannot yet be vetted
  - Hosted proxy tool rejection: `/api/ai/chat/completions` endpoint rejects `tools` and `tool_choice` fields; no explicit server-side schema validation, so malformed broader OpenAI fields can still pass (LLA-M07)
  - Hosted read-only prompt truthfulness: LANDROID_ADVISORY_SYSTEM_PROMPT states no tools exist; if proxy accidentally forwards tools or model finds a way to call them, the system prompt claim is now false and user trust is broken

### persistence-lifecycle

*View: cross-cutting*

Manages the full lifecycle of workspace persistence, project switching, multi-tab safety, and title-ledger durability across local storage boundaries. Orchestrates IndexedDB reads/writes, .landroid file I/O, workspace side-store reset on import, and audit-chain initialization/hydration.

- **Source of truth:** Dexie database tables (workspaceManifestShards, deskMapShards, ownershipNodeCompatShards, leaseholdStateShards, workspaceUiStateShards; titleActionRecords, titleAuditEvents; savedProjects; per-user dbKey namespace). Fallback: monolithic workspaces row + .landroid export/import.
- **Key files:** `/Users/abstractmapping/projects/landroid/src/storage/workspace-persistence.ts`, `/Users/abstractmapping/projects/landroid/src/app/project-workspace-lifecycle.ts`, `/Users/abstractmapping/projects/landroid/src/main.tsx`, `/Users/abstractmapping/projects/landroid/src/storage/active-workspace-key.ts`, `/Users/abstractmapping/projects/landroid/src/storage/project-workspace-storage.ts`, `/Users/abstractmapping/projects/landroid/src/storage/saved-project-index.ts`, `/Users/abstractmapping/projects/landroid/src/storage/workspace-side-store-reset.ts`, `/Users/abstractmapping/projects/landroid/src/storage/title-ledger-persistence.ts`, `/Users/abstractmapping/projects/landroid/src/storage/title-ledger-stores.ts`, `/Users/abstractmapping/projects/landroid/src/store/title-action-log.ts`, `/Users/abstractmapping/projects/landroid/src/storage/workspace-shards.ts`, `/Users/abstractmapping/projects/landroid/src/storage/workspace-shard-reader.ts`, `/Users/abstractmapping/projects/landroid/src/storage/workspace-write-lease.ts`, `/Users/abstractmapping/projects/landroid/src/storage/db-key-scope.ts`
- **Depends on** — changing these can break *this* feature:
  - **workspace-store** — src/store/workspace-store.ts:WorkspaceData shape + loadWorkspace/setProjectName actions, mutation journal hook setTitleJournalHook
  - **owner-store** — src/store/owner-store.ts:replaceWorkspaceData/exportWorkspaceData, lease records for title-ledger owner context
  - **canvas-store** — src/store/canvas-store.ts:loadCanvas/buildCanvasAutosavePayload
  - **map-store,research-store,curative-store** — replaceWorkspaceData/exportWorkspaceData for side-store reset on import
  - **title-action-log** — src/store/title-action-log.ts:reset/hydrate/record/flushTitleActionLogToStorage, ledger-generation tracking
  - **backend-spine** — src/backend-spine/contracts.ts:ActionRecord/AuditEventRecord shapes + ProjectRecordBundle validation
  - **document-store** — src/storage/document-store.ts:replaceDocumentWorkspaceData/exportDocumentWorkspaceData
  - **auth** — src/auth/AuthProvider:setActiveUserSub (hosted only, per-user dbKey namespacing)
- **Consumed by** — changing *this* feature can break these:
  - **autosave** — src/storage/autosave-change-detection.ts + main.tsx subscribe: saveWorkspaceShardsToDb, saveCanvasToDb triggers
  - **project-picker** — src/components/shared/Navbar.tsx: listSavedProjects, openSavedProject, createAndOpenSavedProject, renameSavedProject, duplicateSavedProject, deleteSavedProject
  - **file-actions** — src/components/shared/Navbar.tsx: importAndOpenWorkspace (both .landroid and CSV), exportLandroidFile
  - **demo-loading** — src/components/shared/Navbar.tsx: importAndOpenWorkspace with replaceExisting flag
  - **rolling-auto-export** — src/storage/rolling-auto-export-runtime.ts: needs active workspace id and export path
  - **views** — useWorkspaceStore.getState().workspaceId + other store hydration after project switch completes
  - **startup-warnings** — WorkspaceStore.setStartupWarning: corruption/fixity/ledger hydration error messages
- **Shared contracts / invariants:**
  - dbKey + workspaceId scoping (dual namespace for multi-user hosted + multi-workspace local)
  - savedProjects as the source-of-truth project index, not inferred from Dexie rows
  - .landroid round-trip invariant: export→import→export preserves nodes, canvas, side stores, and title-ledger chain
  - workspace-shard read fallback: prefer shards, fall back to monolith, warn on incomplete/corrupt shards
  - write-lease single-writer protection for shard/ledger/canvas saves (multi-tab safety via lock)
  - title-ledger chain verification: audit hash continuity + full-effect payload presence + workspace-record consistency checks
  - workspace-side-store-reset atomicity: all side stores (owners, documents, maps, research, curative, canvas assets) replace in parallel or rollback together on target failure
  - title-ledger reset on workspace replacement: generation counter + reconciliation of in-flight recordings vs. new workspace id
  - action-layer provenance tagging (origin, approvedBy) for mutations tracked by the journal
  - LedgerBaselineProvenance for duplicate chain-of-custody (sourceWorkspaceId, ledgerHeadHash, derivedFrom metadata)
- **Guards:**
  - **workspace-persistence.test.ts** (`src/storage/__tests__/workspace-persistence.test.ts`) — .landroid export/import round-trip, node/desk-map/leasehold normalization, corruption detection on load, document/owner/map/research side-store serialization
  - **workspace-shard-reader.test.ts** (`src/storage/__tests__/workspace-shard-reader.test.ts`) — shard/monolith read selection logic, fallback order, incomplete/corrupt shard detection and warning
  - **workspace-shard-writer.test.ts** (`src/storage/__tests__/workspace-shard-writer.test.ts`) — shard build, per-workspace write-fence gating, atomicity of multi-table transaction
  - **title-ledger-persistence.test.ts** (`src/storage/__tests__/title-ledger-persistence.test.ts`) — ledger row storage (action records + audit events), dbKey+workspaceId scoping, quarantine on verification failure
  - **workspace-side-store-reset.test.ts** (`src/storage/__tests__/workspace-side-store-reset.test.ts`) — parallel replacement, rollback atomicity on partial failure, AI state cleanup (approval, undo, journal)
  - **project-workspace-storage-duplicate.test.ts** (`src/storage/__tests__/project-workspace-storage-duplicate.test.ts`) — duplicate project copy with fresh workspace id, ledger-head reference for chain-of-custody
  - **project-workspace-storage-fence.test.ts** (`src/storage/__tests__/project-workspace-storage-fence.test.ts`) — write-lease blocking on read-only tab, multi-tab rename/delete/duplicate safety
  - **active-workspace-key.test.ts** (`src/storage/__tests__/active-workspace-key.test.ts`) — dbKey derivation (hosted per-user sub + local default), storage-key switching on project open
  - **saved-project-index.test.ts** (`src/storage/__tests__/saved-project-index.test.ts`) — project index CRUD, lastOpenedAt tracking, derivedFrom lineage preservation
  - **persistent-storage.test.ts** (`src/storage/__tests__/persistent-storage.test.ts`) — browser persistent-storage request + quota estimation
  - **rolling-auto-export.test.ts** (`src/storage/__tests__/rolling-auto-export.test.ts`) — timestamped export pruning (keep 10 newest, leave hand-named/foreign files alone)
  - **title-action-log-persistence.test.ts** (`src/store/__tests__/title-action-log-persistence.test.ts`) — journal recording, parity divergence surface, session-vs-historical parity count, read-flip governance armed/disarmed
  - **project-workspace-lifecycle.test.ts** (`src/app/project-workspace-lifecycle.test.ts`) — open/create/duplicate/rename/delete flows, flush-then-load ordering, ledger hydration timing relative to side-store reset
  - **.landroid file format contract** (`docs/`) — v9 format carries optional actionLedger + validates AuditEventRecord chain; v8 and earlier remain readable
  - **MathInputView parity** (`src/project-records/projections.ts`) — stable projection so math-engine reads are not broken by storage/schema changes
  - **title-math baseline** (`scripts/title-math-baseline.ts`) — ensures math output survives persistence roundtrips and is not silently altered by load/save
- **Known fragility / refactor traps:**
  - anchoredMonolithWorkspaceId in workspace-persistence.ts is a session-scoped singleton tracking the last backed-up workspace id; re-anchors on import/CSV to keep the fallback backup fresh, but if two workspaces are open in rapid succession, the anchor could stale (unlikely in single-tab, tested in save-then-open). Mitigation: shard rows are preferred; monolith is fallback only. Future: discard monolith on shard adoption.
  - write-lease TTL/3 heartbeat (workspace-write-lease.ts) can race with tab demote if a slow mutation or IndexedDB transaction delays the heartbeat; if a tab fails to renew before the 3-second window, a reader tab can acquire the lease mid-write (DA-M15 fix: assertWorkspaceWriteFence re-checks at transaction start, but readers still cannot safely edit side stores; per-view editing guards remain deferred).
  - title-ledger generation counter (title-action-log.ts) is process-local; a multi-window setup with two browser windows can generate colliding generations if they open the same project simultaneously (rare, and hydration reads the *stored* ledger in both, so divergence is surfaced not silent, but both windows could append to the same chain concurrently before one learns the other's mutation).
  - ledger hydration-then-append ordering in project-workspace-lifecycle.ts: baseline is recorded AFTER workspace hydration and node-attachment hydration complete; if node attachment hydration changes attachments[0] (strict mode), the baseline workspace reflects the post-hydration state, not the state when import started (intentional, but unusual order).
  - side-store reset rollback in workspace-side-store-reset.ts is best-effort: if the rollback's target replacement fails, the error is thrown but the app is left with the target side-store partially written (not full previous state). Mitigation: replaceWorkspaceSideStoresWithRollback wraps both target and rollback; if rollback fails, both errors are reported. Practice: roll back manually via saved .landroid.
  - dbKey scoping in shard/side-store rows relies on caller discipline: only activeDbKey() and activeWorkspaceScope() stamp new rows; legacy v10 manifest rows without dbKey are compared against the CURRENT active dbKey, not a stored history, so a user who signs out/in with a different Cognito sub will lose access to legacy rows (Audit M-1: per-user namespace prevented Alice→Bob accidental leak, but if Bob logs into Alice's browser later, Bob cannot see Alice's pre-namespace rows; intentional security boundary).
  - title-ledger quarantine (title-ledger-persistence.ts) uses content-addressed ids to deduplicate identical bad chains re-quarantined on reload, but the quarantine table is NOT lease-fenced (deliberate: evidence preservation should not block) so concurrent corruption events can create separate quarantine ids (intended, but counts are not monotonic and cleanup is manual).
  - canvas-asset deduplication by contentHash can create false positives if two unrelated images happen to have the same SHA-256 (negligible risk, but image swaps would be silent); no intent of the same image appearing twice is checked (only hash match), so deliberate duplicates are silently coalesced.
  - autosave debounce (AUTOSAVE_DEBOUNCE_MS = 2000 in autosave-config.ts) can drop intermediate mutations if the user makes changes faster than the debounce interval and the browser is closed/navigated before the final flush; the title ledger records mutations, but the workspace store commit is debounced so pre-save state is not captured (acceptable: the ledger is shadow-only; next open rehydrates from storage or baseline).

### flowchart-salesdeck

*View: Flowchart & Sales Deck*

Flowchart provides a presentation-and-print surface for ownership trees with Miro-style canvas editing (shapes, images, freeform annotation). Sales Deck provides a native in-app slide deck for product/status conversations, with content sourced from CHANGELOG.md, DEPLOYMENT_STATE.md, ROADMAP.md, and CONTINUATION-PROMPT.md at build time.

- **Source of truth:** 
- **Flowchart canvas state**: `src/store/canvas-store.ts` (Zustand store for nodes, edges, viewport, history, page/print settings)
- **Flowchart nodes/edges from Desk Map**: derived via `src/engine/tree-layout.ts` (ELK layout + `computeLiveOwnershipFractions` from title-math)
- **Sales Deck slides**: generated at build-time in `src/sales-deck/sales-deck-content.ts` by parsing Markdown files (`CHANGELOG.md`, `DEPLOYMENT_STATE.md`, `ROADMAP.md`, `CONTINUATION-PROMPT.md`) via Vite `?raw` imports
- **Persistence**: Canvas rows in IndexedDB (Dexie v8+) via `src/storage/canvas-persistence.ts`; Sales Deck has no persistence (generated each build)

- **Key files:** `src/store/canvas-store.ts`, `src/views/FlowchartView.tsx`, `src/views/PitchDeckView.tsx`, `src/engine/tree-layout.ts`, `src/sales-deck/sales-deck-content.ts`, `src/storage/canvas-persistence.ts`, `src/types/flowchart.ts`, `src/components/canvas/CanvasToolbar.tsx`, `src/components/canvas/OwnershipNode.tsx`, `src/components/canvas/PrintOverlay.tsx`
- **Depends on** — changing these can break *this* feature:
  - **desk-map / title-tree** — workspace-store:getActiveDeskMapNodes (OwnershipNode[]), Desk Map nodes with type 'related' filtered out before layout, workspace state for reactive fraction sync (DA-H8)
  - **title-math engine** — computeLiveOwnershipFractions from src/title-math/calculators/tree-share.ts; re-exported via tree-layout.ts; takes OwnershipNode[] and returns Map<nodeId, LiveOwnershipFractions> with grantFraction, remainingFraction, relativeShare decimals
  - **page/print metrics** — src/engine/flowchart-pages.ts (getPageDimensions, DEFAULT_PAGE_SIZE), src/engine/flowchart-metrics.ts (BASE_NODE_HEIGHT, BASE_NODE_WIDTH, clampNodeScale, getOwnershipNodeDimensions)
  - **tree-layout ELK integration** — src/engine/tree-layout.ts (layoutOwnershipTreeWithElk); async layout from OwnershipNode[], returns {flowNodes, flowEdges} with positioned React Flow nodes and edges
  - **document registry** — Not currently tight coupling, but Sales Deck mentions Documents as trust layer and first-class registry in slide copy (static only)
- **Consumed by** — changing *this* feature can break these:
  - **app autosave + persistence** — src/app/project-workspace-lifecycle.ts: buildCanvasAutosavePayload(), flushes canvas-store state before project switch; src/storage/canvas-persistence.ts: saveCanvasToDb(CanvasSaveData), saveProjectCanvas() — canvas persists per workspace key alongside workspace/owner/curative/maps/research data in indexed-db; src/app/current-landroid-export.ts exports CanvasSaveData into .landroid file; CanvasSaveData shape includes nodes[], edges[], viewport, gridCols/Rows, orientation, pageSize, spacing factors, snapToGrid, gridSize
  - **main app shell** — src/App.tsx: LazyLoads FlowchartView as 'flowchart' route; src/main.tsx: hydrates canvas-store from Dexie on app startup via useCanvasStore.getState().loadCanvas(), subscribes to canvas-store for live autosave debounce
  - **print pipeline** — src/components/canvas/PrintOverlay.tsx (React portaled to document.body); dispatches nodes/edges to src/components/canvas/print-renderers.tsx for print-layout grid and page breaks; uses canvas-store.viewport, gridCols/Rows, orientation, pageSize, node positions/sizes, ownership node data for label rendering
- **Shared contracts / invariants:**
  - OwnershipNodeData shape (label, grantee, grantor, instrument, date, grantFraction, remainingFraction, relativeShare, nodeId, nodeScale, stale flag) — bridges Desk Map title fractions and flowchart placement
  - CanvasSaveData (nodes[], edges[], viewport?, gridCols?, gridRows?, orientation?, pageSize?, horizontalSpacingFactor?, verticalSpacingFactor?, snapToGrid?, gridSize?) — persisted canvas state across project load/save
  - LiveOwnershipFractions type (grantFraction, remainingFraction, relativeShare as Decimal strings) — computed by title-math, overlaid onto ownership nodes in DA-H8 sync
  - Node/Edge type contracts from @xyflow/react — React Flow's standard Node<T> and Edge<T> carrying flowchart type ('ownership' | 'shape' | 'frame' | 'image') and data payloads
  - SalesDeckSlide interface (id, eyebrow, title, summary, points[], stat?, footer?) — static shape extracted from Markdown sources at build time; no runtime mutation or import
- **Guards:**
  - **canvas-store unit tests** (`src/store/__tests__/canvas-store.test.ts`) — mergeImportGraph preserves user shapes on re-import (DA2-F3); copy/paste/duplicate with fresh IDs; undo/redo history; zoom/pan/selection; shape creation
  - **tree-layout/ELK tests** (`src/engine/__tests__/tree-layout.test.ts`) — computeLiveOwnershipFractions (DA-H8 overlay) math and stale-node flagging; layout node positioning and edge routing
  - **sales-deck content tests** (`src/sales-deck/__tests__/sales-deck-content.test.ts`) — Markdown section extraction (extractFirstBulletsFromSection) with limit; buildSalesDeckSlides produces 10 slides with expected structure; deployment status, recent progress, next milestones sourced from markdown
  - **flowchart pages/metrics tests** (`src/engine/__tests__/flowchart-pages.test.ts`) — Page size and grid layout dimensions (ANSI/Arch sizes); orientation (landscape/portrait) transformations
  - **autosave change detection** (`src/storage/__tests__/autosave-change-detection.test.ts`) — buildCanvasAutosavePayload change detection so click-around-canvas doesn't queue full IndexedDB rewrites (DA2-F8)
  - **workspace persistence canvas validation** (`src/storage/__tests__/workspace-persistence.test.ts`) — parsePersistedCanvasData validation; corrupt edge/node entries fail gracefully one at a time (DA2-F6), not bricking whole canvas
  - **.landroid round-trip** (`src/app/project-workspace-lifecycle.test.ts`) — Canvas included in export/import lifecycle; blankCanvas() on CSV import; canvas loaded before project fully opens
- **Known fragility / refactor traps:**
  - DA2-F1: Pane-click shape creation — when draw-* tool is active, clicking empty canvas drops a shape; no undo pre-history if user immediately undo-clicks. Fixed by pushHistory on tool activation (if needed) or shape insertion.
  - DA2-F2: Miro-style pan/select — left-drag with select tool lassos; middle/right-drag or explicit pan tool pans. Subtle UX if middle-mouse not available (laptops). Mitigated by explicit pan button in toolbar.
  - DA2-F3: Re-import merge behavior — ownership nodes/edges are REPLACED wholesale on re-import to keep layout fresh; user shapes/annotations PRESERVED. If a user draws edges between ownership and non-ownership nodes, those edges are dropped (filtered by type check). Design intent: ownership tree is derived, shapes are user-owned.
  - DA2-F4: Print overlay — dispatches every canvas node through print-renderer registry. Non-ownership nodes must have a registered print-renderer or they fail silently in print. Currently registered: ownership, shape, image, frame. Reserved seam: 'ink' (freehand pen, not implemented yet).
  - DA2-F6: Canvas persistence — validates persisted edges one at a time so one corrupt entry doesn't brick the whole canvas row. However, if normalizeCanvasSaveData rejects the entire payload, canvas loads blank. Edge case: mixed corrupt/valid data may silently skip corrupt entries.
  - DA2-F7: Viewport persistence — saved viewport (x, y, zoom) is restored on load via defaultViewport prop. First import (no saved viewport) auto-fits. If viewport was far off-canvas, next load restores that far-off state (not auto-corrected).
  - DA2-F8: Autosave change detection — buildCanvasAutosavePayload compares deep shapes to avoid queuing redundant IndexedDB writes on every canvas mouse move. Shallow comparison on array length could miss semantic node changes (e.g., position or data updates). Relies on full equality check.
  - DA2-F11: CanvasToolbar features — signature feature and must not be fenced behind UI flags or permissions. All toolbar actions (Import, Fit, Print, Spacing, Resize, Templates) must remain available to all users.
  - DA-H8: Live-fraction overlay — DA-H8 recomputes interest from live title nodes onto placed canvas nodes every time workspace nodes change. Deleted nodes flagged 'stale' instead of removed. If a node is re-created with the same ID after deletion, the overlay does not detect it as 'unstale' (would need node-sequence tracking). Orphaned canvas nodes remain until manual Clear.
  - DA-H9: ELK layout cost — ELK layout is paid asynchronously (ELK worker) on re-import and spacing-factor changes. Layout async requests can race; later requests cancel earlier ones (spacingRequestIdRef pattern). If canvas is cleared mid-layout, stale layout results may be dropped (correct). Heavy trees (1000+ nodes) may block UI during measure phase.
  - Sales Deck Markdown drift — Sales Deck slides are generated at build time from CHANGELOG.md, DEPLOYMENT_STATE.md, ROADMAP.md, CONTINUATION-PROMPT.md. If those files are edited in production without rebuild, the slide content stays stale. Vite `?raw` imports are immutable post-build.
  - Sales Deck fixture hardcoding — Recent Progress slide hardcodes '2026-05-19' section in CHANGELOG. If that date anchor changes or section is renamed, extraction returns empty. No runtime fallback to a different date.
  - No OCR/search in print — Print exports canvas as rendered, not OCR'd text. Printed PDFs from browser print are raster (image-based) unless a specialized print renderer exports SVG.
  - Styling coupling — Flowchart styles (colors, fonts, spacing) are Tailwind-based (var(--color-*) CSS variables). Print overlay reads these dynamically; if theme changes post-render, print may disagree with screen.
  - React Flow version lock — Uses @xyflow/react (the new org); if a major version bump introduces breaking changes in Node/Edge shapes or event signatures, canvas-store and FlowchartView both need updates.
  - No undo on workspace delete — If a Desk Map node is deleted in title-tree, the corresponding flowchart node is not automatically removed; it stays and flagged 'stale'. User must manually Clear canvas or re-import. Orphaned nodes can accumulate.

