# Phase 0 Behavior Inventory and Golden Masters

Status: draft master inventory (produced by Phase 0 ultra-review on `main` checkpoint 2026-05-22; adopted for reconciliation on `codex/phase-0-reconcile-2026-05-23`).
Source of truth: [`docs/rebuild-plan.md`](rebuild-plan.md), sections "Phase 0 Operating Plan" and "Phase 0: Current Behavior Inventory And Golden Masters". Where this doc and the rebuild plan disagree, the rebuild plan wins.

This document is the single consolidated master inventory for Phase 0. It freezes current observable behavior on `main` before any rebuild implementation begins. It is read-only review output: no app code is proposed for change here.

## Reconciliation Status

This file is now the working Phase 0 master inventory draft. Treat rows as
inventory targets until they are verified by the lead thread. High-risk rows
reviewed during reconciliation should be marked `verified` or `needs
verification` rather than promoted by assumption.

Verified high-risk claims as of 2026-05-23:

- PER-018: current core workspace persistence is a single JSON string in the
  `workspaces.data` row (`src/storage/workspace-persistence.ts`,
  `src/storage/db.ts`).
- PER-001 / PER-002: workspace and canvas autosave are debounced for 2000ms in
  `src/main.tsx`.
- PER-024: no current `BroadcastChannel`, Web Locks, or equivalent multi-tab
  write lock was found in `src/main.tsx`, `src/storage`, or `src/store`.
- DM-016 / LH-002 / CL-03: lease allocation sorts by effective date, then
  `createdAt`, `updatedAt`, and `id` in `src/components/deskmap/deskmap-coverage.ts`.
- AI-027 / CL-12: mutating-tool undo behavior depends on explicit tool-name
  sets in `src/ai/tools.ts`, with tests proving hosted-blocked coverage but not
  a compile-time registry guard.
- DOC-017: packet manifest generation exists in `src/documents/document-registry.ts`
  and `src/views/DocumentsView.tsx`; Phase 0 still needs a frozen schema
  golden.
- FED-016 / CL-20: federal/reference lease records are separate from Texas math
  through jurisdiction helpers and filters; Phase 1 should centralize this as a
  `MathInputView` precondition.

Validation run during reconciliation:

- `npm test -- src/components/deskmap/__tests__/deskmap-coverage.test.ts src/storage/__tests__/workspace-persistence.test.ts src/storage/__tests__/document-migration.test.ts`
  - passed, 3 files / 54 tests.
- `npm test -- src/ai/__tests__/read-only-tools.test.ts src/ai/__tests__/approval-preview.test.ts src/documents/__tests__/document-registry.test.ts src/storage/__tests__/federal-lease-seed.test.ts src/federal-leasing/__tests__/federal-lease-tracking.test.ts`
  - passed, 5 files / 22 tests.
- `npm test -- src/storage/__tests__/autosave-change-detection.test.ts src/storage/__tests__/workspace-side-store-reset.test.ts src/storage/__tests__/document-store.test.ts`
  - passed, 3 files / 5 tests.
- `npm test -- src/store/__tests__/workspace-store-doc-actions.test.ts src/engine/__tests__/fraction-display.test.ts src/storage/__tests__/runsheet-export.test.ts`
  - passed, 3 files / 40 tests.
- `npm run lint` - passed.
- `npm test` - passed, 78 files / 627 tests. Existing intentional stderr
  coverage for simulated Dexie failures appeared.
- `npm run build` - passed with existing Vite dynamic/static import warnings,
  chunk-size warning, and Node `module.register()` deprecation warning.

Corrected during reconciliation:

- The legacy v7 document-migration code records orphaned node IDs and assigns
  affected PDFs to a fallback workspace. A literal `__orphaned_pre_v8__`
  workspace was not found in the current source during reconciliation, so rows
  referring to that hidden workspace should be read as "fallback/orphan
  migration path with no user-facing discovery UI" until further verified.

## Scope

Reviewed lanes (per Phase 0 plan, lines 619–633 of `rebuild-plan.md`):

1. Desk Map — title-tree actions, invariants, fit/clear, graph/math warnings (`DM-*`)
2. Leasehold — unit focus, ORRI/WI, payout review, formulas, transfer-order (`LH-*`)
3. Documents — packet preview/export, chips, imports, metadata, PDF preview (`DOC-*`)
4. AI — approval flow, undo, blocked previews, action journal, proposal lifecycle (`AI-*`)
5. Persistence — `.landroid` round trip, side stores, autosave, multi-tab risk (`PER-*`)
6. Runsheet — spreadsheet staging, package assumptions, source rows, export (`RS-*`)
7. Flowchart — print fidelity, canvas layout, import-from-Desk-Map (`FC-*`)
8. Maps — reference data, GIS evidence, featured map, region overlay (`MAP-*`)
9. Research — RRC dataset catalog, formula starters, decoder status (`RES-*`)
10. Federal Leasing — reference records, Texas math isolation (`FED-*`)

Performance & scale fixtures (Raven Forest-like project shapes) are covered in §"Performance Baseline Plan".

## Inventory Row Schema

Every behavior row carries:

- **id** — stable, lane-prefixed
- **page / workflow** — UI surface or backstage step
- **behavior** — one atomic, testable statement
- **acceptance check** — how to verify the behavior holds
- **current coverage** — `unit` / `integration` / `playwright` / `golden master` / `none`
- **proposed golden master** — yes/no + fixture pointer
- **implicit?** — sort order, default filter, threshold, timing, confirmation, layout
- **migration risk** — severity if Phase 0.5+ touches the surface
- **validation command** — how to run the check locally / in CI

Tables below are compact; full prose findings for each lane live in the lane reports captured in the Phase 0 review thread.

---

## Lane: Desk Map (`DM-*`)

| id | workflow | behavior | acceptance | coverage | golden? | implicit | risk | validate |
|---|---|---|---|---|---|---|---|---|
| DM-001 | Tab bar | Auto-create first desk map on hydration if none exist | After hydration, ≥1 DeskMap exists | partial | yes — `views/__tests__/DeskMapView.bootstrap.test.tsx` | yes (post-hydration timing) | low | `npm test -- DeskMapView` |
| DM-002 | Tab bar | Group tabs under unit headers only when >1 unit OR unitCode set | Mixed-unit map renders headers; single-unit hides them | unit (UnitFocusSelector) | yes — `desk-map-units.test.ts` | yes (header threshold) | low | `npm test -- desk-map-units` |
| DM-003 | Tab bar | Tab order preserved from `deskMaps` array | Insertion order matches DOM order | none | yes | no | low | snapshot test on `DeskMapTabs` |
| DM-004 | Tab bar | Double-click rename; Enter/blur saves; Esc cancels; empty save silently discarded | Rename committed only with non-empty trimmed value | unit | yes | no | low | `npm test -- DeskMapTabs.rename` |
| DM-005 | Tab bar | Delete × visible only on active tab hover | Hover inactive tab → no × shown | none | yes | yes (active-only delete gate) | low | playwright hover check |
| DM-006 | Tab bar | Red dot if description matches `/NPRI.discrepancy|over-conveyance|orphan/i` | Tab with discrepancy shows red dot; remove text → dot clears | none | yes | yes (substring detection, not validation flag) | medium — string drift | unit on `hasWarning()` |
| DM-007 | Canvas | Pan starts after 3px drag; <3px still fires card onClick | 2px drag → click; 5px drag → pan | none | yes — `deskmap-pan-zoom.test.ts` | yes (3px dead zone) | low | playwright pointer test |
| DM-008 | Canvas | Wheel zoom factor 0.92 (down) / 1.08 (up); clamped [0.1, 3.0] | Zoom out past 0.1 → stays at 0.1 | none | yes | yes (factor, range hardcoded) | low | unit on zoom helper |
| DM-009 | Canvas | Fit button clamps zoom [0.25, 1.15], 96px padding | Small tree zooms ≤115% on fit | none | yes — `measureDeskMapFitContent` | yes (max-zoom 1.15) | low | unit on `computeDeskMapFitViewport` |
| DM-010 | Canvas | Card type → component routing: Lease → `DeskMapLeaseCard`, NPRI → `DeskMapNpriCard`, else `DeskMapCard` | Each type renders the right card | unit (existing) | yes (snapshot per type) | no | low | snapshot test |
| DM-011 | Card tint | Precedence: discrepancy (seal red) > NPRI healthy (green) > present mineral (sky) > parchment | Mark NPRI then add discrepancy → tint goes green → red | none | yes — `DeskMapCard.tint.test.tsx` | yes (precedence not labeled) | medium — math/UI drift | snapshot per state |
| DM-012 | Card fractions | Three rows: Granted / Of Whole / Remaining; "Remaining" hidden when initial == remaining | Convey-all → Remaining `—`; convey-some → row appears | unit (`fraction-display`) | yes — golden fixture per conveyance shape | yes (third-row visibility) | medium — display contract | `npm test -- fraction-display` |
| DM-013 | Card tooltip | Formula tooltip 150ms hover delay; immediate on focus; pin tray max 8 | Hover < 150ms → no popover; pin 9 → 8th drops oldest | none | yes | yes (150ms, max 8) | low | unit on tooltip timer |
| DM-014 | Coverage | Found in Chain = Σ present-owner fractions (excludes NPRI + related) | 2 owners at 1/2 each → 1/1 | unit (`deskmap-coverage`) | yes (existing) | no | low | `npm test -- deskmap-coverage` |
| DM-015 | Coverage | Linked Owners = Σ fraction where `linkedOwnerId != null` | Link one owner → Linked == its fraction | unit | yes | yes (link gate) | low | unit |
| DM-016 | Coverage | Leased = allocated-fraction via `allocateLeaseCoverage`, ordered by effectiveDate → createdAt → updatedAt → id | Two leases same date → older `createdAt` claims first | unit | yes — fixture w/ tie | **yes (tie-break by timestamp)** | **high** — non-deterministic if timestamps drift | unit on `allocateLeaseCoverage` |
| DM-017 | Coverage | Over-100% warning lists top 6 contributors; warning-only (not blocking) | Add owners summing to 1.2 → warning shown, export still allowed | none | yes — golden assertion | yes (top-6, non-blocking) | **high** — user may publish unbalanced title | `npm test -- coverage-overflow` |
| DM-018 | Coverage | Lease overlap warning lists top 3; clipped fraction shown in tooltip | A claims 1/2 then B claims 1/2 → B clipped to 0; warning shown | unit | yes | yes (top-3) | medium | unit |
| DM-019 | Toolbar | Card count excludes related docs that aren't leases | Owner + 1 related doc + 1 lease → count == 2 | none | yes | yes (lease counted, others not) | low | unit on count helper |
| DM-020 | Owner search | Substring case-insensitive match on grantee for mineral conveyance nodes only | NPRI holders not searchable | unit | yes | yes (search scope) | low | unit on `buildDeskMapOwnerSearchMatches` |
| DM-021 | Owner search | Enter cycles forward; Shift+Enter backward; wraps; resets on query change | Last match → Enter → first | unit | yes | yes (wrap, reset) | low | unit |
| DM-022 | Owner search | Active match switches activeDeskMapId if needed, scrolls/highlights node | Match on Tract 2 from Tract 1 → tab switches | none | yes | yes (cross-tract jump) | medium — confusing context shift | playwright |
| DM-023 | NPRI math | `findNpriBranchDiscrepancies` returns 3 kinds: floating_over_royalty, fixed_branch_over_branch, whole_tract_over_branch | Floating NPRI > lease royalty → discrepancy detected | unit (math-engine) | yes (existing) | no | low | `npm test -- math-engine.npri` |
| DM-024 | NPRI UI | Red ring on burdened branch and all NPRI nodes in discrepancy; persists until resolved (no dismiss) | Fix royalty → red clears; no manual dismiss | unit | yes | yes (no-dismiss) | medium — UX confusion | playwright |
| DM-025 | Modals | Node editor route resolves to {kind: 'node'/'convey'/'precede'/'npri'/'attach_doc'} | Click card → correct modal opens | unit (`node-editor-route`) | yes | no | low | `npm test -- node-editor-route` |
| DM-026 | Convey modal | 5 modes × 3 bases = 15 documented combinations; math engine validates | Convey 1/3 of remaining 1/2 → child 1/6, parent 1/3 | unit (math-engine) | yes — fixture per combination | yes (combination matrix not in UI) | medium | math-engine tests |
| DM-027 | Predecessor modal | Inserted node inherits parent's `initialFraction`; descendants scaled by ratio | A→B(1/2)→C(1/4); insert B′ → C′ becomes 1/4 of B′ | unit | yes | no | low | math-engine `executeRebalance` test |
| DM-028 | Doc chips | Max 4 visible; "+N more" expands inline | 5 attachments → 4 + "+1 more" | unit (`DeskMapDocumentChips`) | yes | yes (maxVisible=4) | low | unit |
| DM-029 | Delete node | Lease cleanup: removes lease record only if no other links remain | Delete shared-lease lessee card → lease record kept | unit (`deskmap-lease-delete`) | yes | yes (cleanup rule) | medium | unit |
| DM-030 | Delete node | Post-delete check; if node still present, expose `lastError` to user | Math rejects delete → error visible | none | yes | no | medium | playwright |
| DM-031 | Card hover | Action buttons (PRECEDE / CONVEY / ATTACH / DELETE) hidden by default, shown on group-hover | Mouse leave → buttons hidden immediately | none | no (CSS-only) | yes (Tailwind group-hover) | low | playwright |
| DM-032 | Related chips | Lease → emerald; other related → gold | Distinct chip colors per kind | none | yes | yes (color semantic) | low | snapshot |
| DM-033 | Chip click | Click chip → edit modal for chip (stopPropagation prevents parent edit) | Chip click ≠ parent click | none | yes | yes (event scope) | low | unit |
| DM-034 | Lease card | Lessee card shows terms parsed from `remarks` split by `\|`: Royalty, Leased, Status, Expires, Notes | Remarks string formatted via `buildLeaseNodeRemarks` | unit | yes | yes (delimiter contract) | medium — drift breaks UI | unit on remark parser |
| DM-035 | NPRI card | "Floating" vs "Fixed" + basis label ("Whole tract" / "Burdened branch") | Set floating → Floating badge; fixed whole → Fixed + Whole tract | none | yes | no | low | snapshot |
| DM-036 | NPRI fraction label | "Of Lease Royalty" (floating) / "Of Whole Tract" / "Of Burdened Branch" (fixed) | Label matches `royaltyKind` + `fixedRoyaltyBasis` | unit | yes | yes (label contract) | low | `deskmap-formulas` test |
| DM-037 | Tree CSS | Parent-child connectors are CSS borders on nested DIVs, not SVG | Connectors render when tree-children classes present | none | no (visual) | yes (CSS-only) | low | snapshot |
| DM-038 | Card active state | Gold ring + leather border on `activeNodeId == node.id` | Click → setActiveNode → ring next render | none | yes | yes (store-driven) | low | playwright |

## Lane: Leasehold (`LH-*`)

| id | workflow | behavior | acceptance | coverage | golden? | implicit | risk | validate |
|---|---|---|---|---|---|---|---|---|
| LH-001 | Unit summary | Mineral coverage = Σ present-owner fractions (excludes NPRI) | 2 owners at 1/2 → coverage 1/1 | unit | yes | no | low | `npm test -- leasehold-summary` |
| LH-002 | Unit summary | Leased ownership = Σ `allocateLeaseCoverage` slices per owner | Earlier lease wins on overlap | unit | yes — overlap fixture | yes (allocation order) | **high** | `npm test -- leasehold.allocation` |
| LH-003 | Slice math | Owner Tract Royalty = leasedFraction × royaltyRate | 1/2 × 1/8 = 1/16 | unit | yes | no | low | unit |
| LH-004 | Slice math | Unit Royalty Decimal = (tractPooledAcres × leasedFraction × royaltyRate) / totalPooledAcres | 100/1000 × 1/2 × 1/8 = 0.00625 | unit | yes | no | low | unit |
| LH-005 | NPRI math | Floating NPRI burden per slice = leasedFraction × royaltyRate × npri.fraction | 1/2 × 1/8 × 1/4 = 1/64 | unit | yes | no | low | unit |
| LH-006 | NPRI math | Fixed NPRI floating-basis burden = same formula as floating NPRI | "Fixed (basis floating)" formula identical to floating | unit | yes — explicit fixture | **yes — confusing naming** | medium | unit |
| LH-007 | NPRI math | Fixed NPRI whole-tract basis = (leasedFraction / burdenedBranchOwnership) × npri.fraction; treats 0 divisor as 0 | Branch 1/4 of 1/2 + 1/8 NPRI → 1/16 | unit | yes — divisor-zero fixture | yes (zero-divisor) | medium | unit |
| LH-008 | ORRI math | Gross 8/8 basis: orri × leasedOwnership | 1/2 × 1/80 = 1/160 | unit | yes | no | low | unit |
| LH-009 | ORRI math | Working Interest basis: same calc; stacks before NRI basis | WI basis before NRI in cascade | unit | yes | yes (cascade point) | medium | unit |
| LH-010 | ORRI math | NRI basis: cumulative consumption; order = effectiveDate → sourceDocNo → id | Two NRI ORRIs same date → doc# breaks tie | unit | yes — explicit ordering fixture | **yes — order matters** | **high** | unit on `compareOrriStackingOrder` |
| LH-011 | WI math | NRI before ORRI = leasedOwnership − weightedRoyalty − fixedNpriBurden (floating NPRIs subtracted per-slice, not here) | 1/2 − 1/8 − 1/16 = 5/16 | unit | yes | yes (order of burden) | medium | unit |
| LH-012 | WI math | Pre-WI = max(0, npriAdjustedNriBeforeOrri − ORRI total); `overBurdened` flag if negative | Heavy NPRI+ORRI → preWI clamped 0, flag set | unit | yes | yes (clamp + flag) | medium | unit |
| LH-013 | WI math | Assigned WI = preWI × assignmentShare | preWI 1/8 × assignment 1/2 = 1/16 | unit | yes | no | low | unit |
| LH-014 | WI math | Retained WI = preWI − assigned, clamped 0; `overAssigned` flag if share > 1 | assignment 9/8 → retained 0, flag true | unit | yes | yes (clamp + flag) | medium — user can assign >100% | unit |
| LH-015 | Input parsing | Strict parse on royalty / ORRI / WI; malformed → 0 + warning | "1/3.5" → null → 0 with warning | unit (`interest-string`) | yes — golden warning text | no | low | `npm test -- interest-string` |
| LH-016 | Unit summary | Unit totals = Σ per-tract values (no inter-tract math) | T1 0.125 + T2 0.0625 → unit 0.1875 | unit | yes | no | low | unit |
| LH-017 | Transfer order | Rows sorted by category order (royalty/npri/orri/retained_wi/assigned_wi), then decimal desc; empty rows skipped | Royalty rows before NPRI; largest first | unit | yes — fixture per category | yes (sort contract) | medium | unit on `buildLeaseholdDecimalRows` |
| LH-018 | Transfer order | Expected Decimal = Σ unitParticipation × leasedOwnership (or focused tract); variance shown | All rows included, variance 0 → balanced | unit | yes | no | low | unit |
| LH-019 | Transfer order | Category summaries shown only when rowCount > 0 | No assignments → no assigned_wi section | unit | yes | no | low | unit |
| LH-020 | Transfer order | Source tracking: counts of rows with complete source / missing date / missing doc#; retained_wi excluded from reviewable | All complete → reviewable == complete | unit | yes | yes (review scope) | low | unit |
| LH-021 | Unit selector | Unit dropdown + Add Unit; auto-generates unit code from initials | "Raven Forest A" → "RFA" | unit (`desk-map-units`) | yes | no | low | unit |
| LH-022 | Unit focus | Switching active unit re-filters all leasehold tables; **silently discards in-progress TO draft** | Switch mid-edit → draft gone | none | yes — golden Playwright | **yes — no confirmation** | **high — data loss** | playwright |
| LH-023 | Sorting | Owner display sort: leasedFraction desc, mineralFraction desc, ownerName asc | Owners visible largest-leased first | unit | yes | yes (sort purpose) | low | unit |
| LH-024 | Sorting | NPRI display sort: includedInMath desc, tractBurdenRate desc, payee asc | Zero-burden NPRIs at end | unit | yes | yes | low | unit |
| LH-025 | Acres | unitParticipation = tractPooledAcres / totalPooledAcres; >1 allowed (warning-only) | gross 640 / pooled 320 → 50% | unit | yes | yes (no clamp) | medium | unit |
| LH-026 | Tooltip | Formula tooltip wraps every decimal in Leasehold; same 150ms delay; auto-positions above/below | Hover decimal → popover shows arithmetic | none | yes | yes (positioning rule) | low | playwright |
| LH-027 | Unit focus | UnitFocusSelector controls visibility across all leasehold tables | Switch unit → tables reload | unit | yes | no | low | playwright |

## Lane: Documents (`DOC-*`)

| id | workflow | behavior | acceptance | coverage | golden? | implicit | risk | validate |
|---|---|---|---|---|---|---|---|---|
| DOC-001 | Registry | Sort: newest doc date (recording > effective > createdAt) | Newest appears first | unit | yes (existing) | yes (fallback chain) | low | `document-registry.test.ts` |
| DOC-002 | Registry | Display title fallback: `displayTitle` > `fileName` > `docId` | Title never blank | unit | yes | yes (fallback) | low | unit |
| DOC-003 | Registry | Area resolution: lease → `leasehold`, deed → `runsheet_mineral_title`, else `inbox` | Kind → default area mapping | unit | yes | yes (default logic) | low | unit |
| DOC-004 | Registry | "Missing metadata" badge if any of 6 fields blank: title, instrument type, county, recording ref, date, parties | All 6 present → no badge | unit | yes | no (explicit field list) | low | unit |
| DOC-005 | Filter | View selector across 12 views (all / inbox / runsheet / leasehold / unlinked / missing_metadata / needs_ocr / duplicates / …) | Each view filters as labeled | unit | yes | no | low | unit |
| DOC-006 | Filter | Kind filter narrows by enum (deed/lease/obit/affidavit/probate/related/other) | Each enum value filterable | unit | yes | no | low | unit |
| DOC-007 | Filter | Tract filter scopes to attachments linked to active desk map's nodes | Cross-desk-map docs filtered out | unit | yes | yes (indirect scope) | medium | unit |
| DOC-008 | Filter | Linked-state filter: all / linked / unlinked | Linked count atomic | unit | yes | no | low | unit |
| DOC-009 | Filter | Date range inclusive on both bounds | doc at `from` and `to` both visible | unit | yes | no | low | unit |
| DOC-010 | Sidebar | Active doc auto-selects first visible after filter change; preserved if still visible | Filter that hides active → select row[0] | unit | yes | yes (auto-select) | low | unit |
| DOC-011 | Metadata panel | Edits buffered in draft; Save required (no autosave) | Edit then leave → changes lost | none | yes — Playwright | no | low | playwright |
| DOC-012 | Metadata save | Whitespace trimmed; empty stored as `undefined` | "  " → undefined | unit | yes | no | low | unit on `normalizeMetadataPatch` |
| DOC-013 | OCR status | 4 states: not_started / not_needed / complete / failed | All render in select | unit | yes | no | low | snapshot |
| DOC-014 | Search | Full-text index covers display title, file name, area label, kind label, all metadata fields | Substring case-insensitive | unit | yes | yes (index scope) | medium — drift | unit |
| DOC-015 | Packet source | 3 sources: Filter (current rows) / Selected / Runsheet (resolvedArea == runsheet_mineral_title) | Source toggle changes packet preview | unit | yes | no | low | unit |
| DOC-016 | Packet preview | Doc count, total bytes, missing-metadata count, duplicate count, up to 25 titles | Preview truncates at 25 | unit | yes | yes (25-title cap) | low | unit |
| DOC-017 | Manifest | Manifest JSON download named `landroid-document-packet-manifest-YYYY-MM-DD.json`; includes metadata, linked entities, dup info | File downloads with stable schema | **none** | **yes — schema golden** | yes (filename format) | medium | snapshot of manifest JSON |
| DOC-018 | PDF viewer | Click PDF → modal renders blob in iframe (sandbox `allow-downloads`) | Blob loads w/o crash | none | yes | no | low | playwright |
| DOC-019 | Linked entities | Each link card shows label (instrument + doc#), detail (type \| parties \| tracts), navigation button | Click button → tab + tract switches | unit | yes | yes (label fmt) | low | unit |
| DOC-020 | Attach modal | Related-doc create: makes `type:'related'` node + attachment in one transaction | Atomic on save | unit | yes | no | low | unit on `AttachDocModal` |
| DOC-021 | Attach modal | PDF validated at selection AND at save via `normalizePdfBlob` (magic bytes %PDF-) | Bad PDF rejected before write | unit (`pdf-validation`) | yes | no | low | `pdf-validation.test.ts` |
| DOC-022 | Attach modal | PDF size limit 25 MB | Reject >25MB with byte label | unit | yes | yes (limit) | low | unit |
| DOC-023 | Attachment section | Inline rename on blur/Enter; Esc cancels; no-op when unchanged | Rename committed only on real change | unit | yes | no | low | unit |
| DOC-024 | Attachment section | Up/down reorder; disabled at boundaries | Adjacent swap; no wrap | unit | yes | no | low | unit |
| DOC-025 | Attachment section | Remove detaches but keeps doc in registry; positions recompact to [0,n) | Remove middle → positions re-indexed | unit | yes | **yes — auto-compaction** | medium | unit on `compactAttachmentPositions` |
| DOC-026 | Document store | `saveDoc` writes doc + first attachment in one Dexie transaction; position = existingCount | Append assigns dense index | unit | yes | yes (dense indexing) | low | unit |
| DOC-027 | Document store | `updateDocMetadata` patches fields, strips empties, bumps `updatedAt`; blob + hash untouched | Rename doesn't rehash | unit | yes | no | low | unit |
| DOC-028 | Document store | `listDocumentRegistryData` returns docs (no blobs) + all attachments | Blob omitted on list | unit | yes | yes (perf optimization) | low | unit |
| DOC-029 | Document store | Duplicate detection via SHA-256 content hash; flagged in registry rows | Two identical PDFs → both flagged with count | unit | yes | no | low | unit |
| DOC-030 | Document store | Delete cascades: `deleteDoc` removes doc + all attachments | After delete, no orphan attachments | unit | yes | yes (cascade) | medium | unit |
| DOC-031 | Document store | After detach, attachment positions recompact synchronously | Positions remain [0,n) | unit | yes | yes (side effect) | low | unit |
| DOC-032 | Document store | `reorderAttachments`: unknown IDs appended, missing IDs keep relative order | Partial order accepted | unit | yes | no | low | unit |
| DOC-033 | Document store | All queries scoped by `workspaceId` | Cross-workspace returns 0 | **none** | **yes — isolation test** | yes (implicit scoping) | medium | unit |
| DOC-034 | PDF validation | Magic-byte check (`%PDF-`) | Wrong header → throws | unit | yes | no | low | `pdf-validation.test.ts` |
| DOC-035 | File validation | `assertFileSize` formats byte counts in error message | "PDF too large (X MB)" | unit | yes | no | low | unit |
| DOC-036 | Blob serialize | `serializeBlob` → {mimeType, base64}; idempotent round-trip | Round trip equals original | unit | yes | no | low | unit |
| DOC-037 | Blob deserialize | 25 MB cap via `estimateDecodedByteLength` before decode | >25MB base64 throws pre-decode | unit | yes | yes (decode-bomb guard) | low | unit |
| DOC-038 | Hash | `sha256HexOfBlob` via Web Crypto subtle.digest | Identical bytes → identical hex | unit | yes | no | low | unit |
| DOC-039 | Migration v7→v8 | Migrates legacy pdfData.pdfs to documents+attachments; orphaned node IDs are recorded and affected PDFs use a fallback workspace | Orphans captured, not lost | unit | yes — orphan fixture | **yes — fallback/orphan path, no UI** | **high** — users can't discover migration orphans | unit on `migratePdfsToDocuments` |
| DOC-040 | Desk Map chips | Max 4 visible, "+N more" expands inline | 5 attachments → 4 + 1 more | unit | yes | yes (maxVisible=4) | low | unit |

## Lane: AI (`AI-*`)

| id | workflow | behavior | acceptance | coverage | golden? | implicit | risk | validate |
|---|---|---|---|---|---|---|---|---|
| AI-001 | Chat | Streamed responses; tool calls render inline; errors caught & logged | Chat works without tool calls AND with them | unit | yes | no | low | `runChat.test.ts` |
| AI-002 | Chat | Status text: "Thinking…" → tool names → "Writing response…" | Status updates during stream | none | no (UX) | yes (status copy) | low | playwright |
| AI-003 | Undo | Single-level undo button; disabled when no snapshot | After undo button greys out | unit | yes | no | medium — scope must match mutation | `undo-store.test.ts` |
| AI-004 | Approval | Mutating tools enqueue proposals; user approves in panel | Proposal → approve → journal entry | unit | yes | no | low | `approval-store.test.ts` |
| AI-005 | Settings | Settings panel auto-opens when unconfigured | First load → settings visible | none | no | yes (auto-open) | low | playwright |
| AI-006 | Mode | Chat / Wizard tab toggle | Switching modes preserves each side | none | no | no | low | playwright |
| AI-007 | Approval queue | Proposals stored with ID/tool/input/summary/details/preview/createdAt | Each proposal serializes/restores | unit | yes | no | low | unit |
| AI-008 | Approval exec | Approve → validate preview → capture undo snapshot → run executor → record journal → remove proposal | One-shot atomic sequence | unit | yes | no | medium — sequence integrity | unit |
| AI-009 | Approval preview | status enum: valid / issues / blocked / not_applicable; canApprove iff != blocked | Blocked never approvable | unit | yes | no | low | `approval-preview.test.ts` |
| AI-010 | Preview: root | Validates target desk map; renders fraction + class + owner | Missing desk map → blocked | unit | yes | no | low | unit |
| AI-011 | Preview: convey | Validates parent exists; shows parent remaining, new child fraction | Missing parent → blocked | unit | yes | no | low | unit |
| AI-012 | Preview: NPRI | Warns if fixed basis not explicit | Fixed w/o basis → warning | unit | yes | yes (warn not block) | medium | unit |
| AI-013 | Preview: delete | Blocked if descendants exist ("delete limited to leaves") | Delete with children → blocked | unit | yes | yes (leaf-only rule) | low | unit |
| AI-014 | Preview: attachLease | 6 checks: mineral node exists, lease exists, node not related, node is mineral, lease Texas-eligible, linked owner matches | Any fail → blocked | unit | yes | no | low | unit |
| AI-015 | Action journal | Entry: id, proposalId, tool, summary, details, status (applied/failed/undone), resultSummary, validation, createdAt; **max 25 entries** | 26th entry drops oldest | unit | yes | **yes — circular buffer** | medium — silent overflow | `action-journal.test.ts` |
| AI-016 | Journal details | `buildAIApprovalDetails` extracts per-tool fields | Tool-specific labels per entry | unit | yes | yes (per-tool extractor) | medium — drifts with tool sig changes | unit |
| AI-017 | Journal result | `summarizeActionResult` extracts IDs/counts per tool | 1-2 sentence summary | unit | yes | no | medium | unit |
| AI-018 | Journal validation | Up to 6 issues normalized into entry | 10 issues → truncated to 6 | unit | yes | yes (6-issue cap) | low | unit |
| AI-019 | Journal context | `formatAIActionJournalForModel` uses last 12 entries in system prompt | 15 entries → last 12 only | unit | yes | yes (12-entry context) | low | unit |
| AI-020 | Chat context | System message prepends action journal if entries exist | Order: journal → user → assistant | unit | yes | no | low | `chat-context.test.ts` |
| AI-021 | App context | Read-only markdown packet of active view, tract, visible cards, linked leases, coverage; **capped at 40 nodes** | 50 visible nodes → truncated to 40 | unit | yes | **yes — silent truncation** | medium — incomplete analysis | unit |
| AI-022 | App context | Coverage summary lines: current ownership, linked owners, leased, lease warnings | 4-5 line summary | unit | yes | no | low | unit |
| AI-023 | Client | Model resolved per provider (ollama / openai / anthropic); SDK-specific | Provider switch loads correct SDK | unit | yes | no | low | unit |
| AI-024 | Client hosted | Hosted mode uses `/api/ai` proxy with Cognito bearer token; 401 → session logout | Token expiry kills chat | unit | yes — golden 401 path | yes (auth model) | **high — kills mid-stream** | unit |
| AI-025 | runChat | `streamText` with `stepCountIs(8)` cap | 9-step loop stops at 8 | unit | yes | yes (8-step cap) | low | unit |
| AI-026 | runChat | Tool events: onToolStart → onToolCall before next token | Event ordering deterministic | unit | yes | no | low | unit |
| AI-027 | runChat | `UNDO_MUTATING_TOOL_NAMES` triggers snapshot once per turn | Mutation → 1 snapshot | unit | yes | **yes — list must stay in sync with `tools.ts`** | **high — new tool silently lacks undo** | unit + lint |
| AI-028 | runChat timeout | 2 min for OpenAI/Anthropic; 10 min for Ollama | Slow stream cancels at limit | none | yes | yes (provider-specific) | low | unit (mocked timers) |
| AI-029 | runChat abort | User cancel propagates AbortSignal; "Canceled" msg shown | Click cancel mid-stream → stops | unit | yes | no | low | unit |
| AI-030 | Undo snapshot | Deep-clones all 4 stores (workspace, owner, curative, map) + document data | Snapshot independent of post-mutation state | unit | yes | yes (all-stores capture) | **high — new store silently dropped** | unit |
| AI-031 | Undo restore | Replaces all 4 stores + documents; re-hydrates node.attachments | Restore yields exact pre-state | unit | yes | yes (re-hydration step) | medium | unit |
| AI-032 | Undo deep clone | `structuredClone` if available, else JSON round-trip | Both paths produce same shape | unit | yes | yes (fallback) | low | unit |
| AI-033 | Settings store | Defaults: ollama=`gpt-oss:20b`, openai=`gpt-4o-mini`, anthropic=`claude-sonnet-4-6` | Provider switch updates model | unit | yes | yes (default per provider) | low | `settings-store.test.ts` |
| AI-034 | Settings persistence | Provider + model persisted via Zustand `partialize`; **API keys NOT persisted** | Reload → keys blank, model kept | unit | yes | yes (key non-persist) | low | unit |
| AI-035 | Settings fallback | If `localStorage` unavailable, in-memory Map used | Tests work in jsdom | unit | yes | yes (fallback storage) | low | unit |
| AI-036 | System prompt | 10 non-negotiable rules (Texas-only, no invented citations, etc.) | All rules present verbatim | none | **yes — system-prompt golden** | yes (rule set) | **high — silent removal** | snapshot test on system prompt |
| AI-037 | System prompt | Texas math reference embedded (~70 lines markdown) | Math markdown injected | none | yes — snapshot | no | low | snapshot |
| AI-038 | System prompt | 13 mutating tools documented with input/output/sequencing hints | All 13 tools described | none | yes | yes (tool docs) | low | snapshot |
| AI-039 | Wizard parse | Upload → file validated → parsed off-thread in worker | Status: idle → parsing → parsed | unit | yes | no | low | `parse-workbook.test.ts` |
| AI-040 | Wizard analyze | Parsed workbook → AI classifies sheets, proposes column mappings | `analyzed` state has proposal | unit | yes | no | low | `analyze-workbook.test.ts` |

## Lane: Persistence (`PER-*`)

| id | workflow | behavior | acceptance | coverage | golden? | implicit | risk | validate |
|---|---|---|---|---|---|---|---|---|
| PER-001 | Autosave | **2000ms debounce** on workspace store changes | After 2s idle, IndexedDB updated | unit | yes — extract `AUTOSAVE_DEBOUNCE_MS` constant | **yes — hardcoded in `main.tsx`** | medium — drift on rebuild | `autosave-change-detection.test.ts` |
| PER-002 | Autosave | Same 2000ms debounce on canvas store | Canvas viewport/layout saved at same cadence | unit | yes | yes (same constant) | medium | unit |
| PER-003 | Bootstrap | Await workspace-key resolution before any Dexie read; hosted blocks until Cognito sub set | Hosted signed-out → never reads | unit | yes | yes (ready barrier) | low | `active-workspace-key.test.ts` |
| PER-004 | Bootstrap | Load workspace from IndexedDB; null → seed; corrupt JSON → throw + fallback | Corrupt JSON → fresh workspace | unit | yes — corrupt-JSON fixture | yes (fallback) | low | unit |
| PER-005 | Bootstrap | Load canvas; missing/corrupt → blank canvas | Empty canvas on first load | unit | yes | yes (default) | low | unit |
| PER-006 | Backup | One-shot v7→v8 PDF backup before first v8 boot; `localStorage` flag prevents repeat | Auto-downloads `pre-v8-backup-*.landroid` once | unit | yes | yes (localStorage flag) | medium — hosted quota | `post-v8-backup.test.ts` |
| PER-007 | Import .landroid | Destructive load: user must type **"LOAD WORKSPACE"** to confirm; rollback prepared | Wrong text → no replace | unit | yes — golden confirmation text constant | **yes — magic string** | medium | unit |
| PER-008 | Import .landroid | Reject files with `version > LANDROID_FILE_VERSION (8)` | v9 file → "Unsupported .landroid file version 9" | unit | yes | no | low | `workspace-persistence.test.ts` |
| PER-009 | Import .landroid | v7 inline migration: pdfData.pdfs → documents[] + attachments[]; orphaned node IDs are recorded and affected PDFs use a fallback workspace | v7 file imports cleanly; orphans captured | unit | yes | yes (fallback/orphan path) | **high — no UI to discover** | unit |
| PER-010 | Export .landroid | v8 export includes documentData + ownerData + mapData + researchData + curativeData; pdfData omitted | Round-trip preserves all side stores | unit | yes — round-trip fixture | yes (side store scope) | low | unit |
| PER-011 | Export .landroid | JSON with 2-space indent in Blob; no size cap | Export size = data size | unit | yes | no | low | unit |
| PER-012 | Side stores | `replaceWorkspaceSideStoresWithRollback`: clears owner/map/research/curative + AI stores; rollback on Dexie error | Mid-replace failure → rollback | unit | yes | yes (atomicity scope) | medium — AI stores non-txn | `workspace-side-store-reset.test.ts` |
| PER-013 | CSV load | CSV import clears all side stores | After CSV load, owners empty | unit | yes | yes (side-effect scope) | low | unit |
| PER-014 | Doc store | Save doc + first attachment in one txn; position = existingCount (auto-append) | Append always gets dense next index | unit | yes | yes (dense) | medium — concurrent race | unit |
| PER-015 | Doc store | After detach, positions compact to [0, n) | Remove middle → positions reindexed | unit | yes | yes | medium | unit |
| PER-016 | Doc store | `deleteDocsForAttachments` cascade deletes orphan docs only when no surviving links | Shared doc survives single-link delete | unit | yes | yes (cascade rule) | medium | unit |
| PER-017 | Doc store | Rename keeps `contentHash`; only `fileName` + `updatedAt` change | Rename never rehashes | unit | yes | no | low | unit |
| PER-018 | Serialization | Workspace persisted as **single JSON string** in `workspaces.data` | One row per workspace; monolithic | unit | yes | **yes — monolithic** | **high — Phase 0.5 sharding blocker** | unit |
| PER-019 | Curative | Title issues sorted on load: open→closed, then dueDate, then updatedAt desc | Load → deterministic order | unit | yes | yes (load-time sort) | low | `curative-persistence.test.ts` |
| PER-020 | Hosted | Per-user workspace key = `user-${sub}` (else `default` locally); throws if sub missing in hosted | Hosted signed-out → throws | unit | yes | yes (sub → key) | medium | unit |
| PER-021 | Blob | Serialize: base64 + mimeType; 25 MB per-blob cap; cap estimated before decode | >25MB base64 throws pre-decode | unit | yes | yes (cap) | low | `blob-serialization.test.ts` |
| PER-022 | Version | Rejection message specifies rejected version | "Unsupported … file version 9" | unit | yes | no | low | unit |
| PER-023 | Owner normalize | Records missing `id` dropped; string fields default to `''` | Malformed owner → discarded silently | unit | yes — golden silent-drop log | yes (silent drop) | low | unit |
| PER-024 | Multi-tab | **No multi-tab detection or write locking; last-write-wins** | Concurrent tabs → lost write | **none** | **yes — multi-tab golden** | yes (absence of locking) | **high** | new test in `__tests__/multi-tab.test.ts` |

## Lane: Runsheet (`RS-*`)

| id | workflow | behavior | acceptance | coverage | golden? | implicit | risk | validate |
|---|---|---|---|---|---|---|---|---|
| RS-001 | Export | **Column order**: Docs Hyperlink, Instrument, Order by Date, Image Path, Vol, Page, Inst. No., File Date, Inst./Eff. Date, Grantor, Grantee, Land Desc., Remarks | CSV columns match `RUNSHEET_HEADERS` exactly | unit | yes — CSV golden | yes (order is a contract) | **high — landman import templates** | `runsheet-export.test.ts` |
| RS-002 | Display | Default sort: instrument date ascending | Initial render uses date asc | none | yes | yes (default field & dir) | medium — users expect file date | playwright |
| RS-003 | Filter | Default tract filter: "All Tracts" | First render shows All Tracts | none | yes | yes (default) | low | playwright |
| RS-004 | Sort | Click same header toggles asc↔desc; different header resets to asc | A asc→desc; click B → asc | unit | yes | yes (toggle semantics) | low | unit |
| RS-005 | Export | CSV has UTF-8 BOM; commas/quotes escaped per RFC 4180 | Export with quotes parses in Excel | unit | yes | no | low | unit |
| RS-006 | Import | Spreadsheet max 10 MB | 11 MB → reject | unit | yes | no | low | `parse-workbook.test.ts` |
| RS-007 | Import | Sheet detection: CSV uses fallback `allRows` if `rows` missing | CSV without rows[] still parses | unit | yes | no | medium | unit |
| RS-008 | Import | Header detection threshold: **≥2 alias matches per field** | 1-match row not treated as header | unit | yes | yes (MIN_HEADER_SCORE=2) | medium | unit |
| RS-009 | Import | Tract code inferred via regex `T{n}` from sheet name; else `T{sheetIndex+1}` | "Tract 2" → T2 | unit | yes | yes (regex pattern) | medium — sheet naming | `row-staging.test.ts` |
| RS-010 | Import | Fraction parsing accepts decimal, fraction, percent, chained `x` / `/` math | "1/3 x 4/5" → 0.2667; "50%" → 0.5 | unit | yes | no (documented in code) | medium — expression syntax | unit on `parseImportFraction` |
| RS-011 | Import | NPRI rows need fixed/floating answer before "Create" enabled | NPRI w/o royaltyKind → status `needs_question` | unit | yes | **yes — silent gate** | **high — broken NPRI math if skipped** | unit on `stagedImportRowNeedsQuestion` |
| RS-012 | Import | Fixed NPRI also needs basis (burdened_branch or whole_tract) | Fixed w/o basis → warning | unit | yes | yes (second gate) | **high** | unit |
| RS-013 | Import | Skip empty rows and "Subtotal/Total" rows | "Subtotal" row → omitted | unit | yes | yes (skip rule) | medium — false positive on data named Subtotal | unit |
| RS-014 | Import | Legacy DOTO format: if grantor set but grantee looks like exhibit ref, swap and annotate in remarks | "Smith / Exh. A / DOTO" → swap + note | unit | yes | yes (legacy handler) | medium | unit |
| RS-015 | Import | Subsequent rows inherit instrument/docNo/dates from previous if context block matches | Header instrument + blank-instrument rows → all inherit | unit | yes | yes (block inheritance) | medium — context break drops rows | unit |
| RS-016 | Import | Parent suggestion: name-similarity score; ≥100 exact, ≥70 substring/fuzzy → high/medium confidence | "Smith Family" grantor matches existing grantee "Smith Family" → high | unit | yes | no | medium | unit |
| RS-017 | Export | Image path `TORS_Documents\{docNo}.pdf` only if docNo exists AND attachments[] non-empty | No attachments → blank | unit | yes | yes (two-condition gate) | low | unit |
| RS-018 | Export | Filename sanitized; joined with `-`; ends `-runsheet.csv` | "My / 2024" → "My-2024-runsheet.csv" | unit | yes | no | low | unit |

## Lane: Flowchart (`FC-*`)

| id | workflow | behavior | acceptance | coverage | golden? | implicit | risk | validate |
|---|---|---|---|---|---|---|---|---|
| FC-001 | Auto-import | Canvas auto-imports active desk map when it has nodes but canvas is empty | Open Flowchart after creating desk-map → tree appears | none | yes — playwright | yes (auto-trigger) | medium — unexpected populate | playwright |
| FC-002 | Tree layout | ELK hierarchical layout; H/V spacing factors [0.25, 3.0] step 0.25 | Spacing factors change ELK gaps | unit (`tree-layout`) | yes | no | low | unit |
| FC-003 | Tree center | Imported tree centered at (pw*gridCols/2, y=40) | Root x ≈ mid grid | unit (`flowchart-pages`) | yes | yes (anchor) | low | unit |
| FC-004 | Fit to grid | Uniform scale all nodes+edges to fit bbox in page grid w/ 40px margin; clamped [MIN_NODE_SCALE, MAX_NODE_SCALE] | Large tree shrinks uniformly | unit | yes | yes (margin + clamp) | low | unit |
| FC-005 | Resize mode | Drag corner handles → uniform scale; Escape cancels; Done commits | 100%→75% scales all proportionally | none | yes | no | low | playwright |
| FC-006 | Page grid | Dashed page tiles labeled A1, A2, B1, etc.; labels at top-left; zoom-independent stroke/text | Labels stay readable at any zoom | none | no (visual) | yes (zoom-invariant) | low | snapshot |
| FC-007 | Toolbar | Tools: select, pan, connect, draw-rect, draw-round, draw-ellipse, draw-diamond, draw-note | Escape resets to 'select' | unit | yes | no | low | `useCanvasKeyboardShortcuts` |
| FC-008 | Toolbar | Page size dropdown: ANSI/Arch A–E; updates grid dimensions | ANSI B → 11" DPI grid | unit | yes | no | low | unit |
| FC-009 | Toolbar | Orientation toggle landscape↔portrait | Grid proportions swap | unit | yes | no | low | unit |
| FC-010 | Toolbar | H/V spacing steppers; step=0.25; bounds [0.25, 3.0] | +0.25 widens gaps | unit | yes | yes (step constant) | low | unit |
| FC-011 | Print | One page per grid tile; clipped per page; page-break-after set | 2×2 grid → 4 pages | unit (`flowchart-pages`) | yes | yes (clip + break) | medium — printing contract | snapshot |
| FC-012 | Print | PrintCard rendering matches on-screen card exactly (no React Flow; pure DIV) | Print PDF visually identical | none | yes — golden screenshot | yes (duplicated styling) | medium — drift if React Flow restyle | playwright + screenshot |
| FC-013 | Print | Edge SVG paths rendered per page; edges entirely off-page omitted; crossing edges clipped both pages | Edge across page boundary → both pages | none | yes | yes (clip rule) | medium | playwright |
| FC-014 | Card header | Instrument + date in top-right; truncated with ellipsis if long | Long instrument → "…" | none | no (visual) | no | low | snapshot |
| FC-015 | Card body | "From: {grantor}" optional; grantee bold; fallback "Unknown" | Missing grantee → "Unknown" | none | yes | yes (fallback) | low | snapshot |
| FC-016 | Card fractions | 3 lines: Granted / Of Whole / Remaining; Remaining hidden when not conveyedSome | Convey-all → 2 lines | unit | yes | yes (line gate) | medium — display contract | unit |
| FC-017 | Card scale | All sizes scale with `nodeScale` (0.2–3.0); fonts, padding, radius, handles | scale=0.5 → text half-size | unit | yes | no | low | unit on metrics |
| FC-018 | Edge geom | `getSmoothStepPath`; related edges thinner (1px) and smaller gap (8px) | Related edges visually thinner | unit | yes | yes (variant) | low | unit |
| FC-019 | Edge hit-box | Interaction width = max(8, 14 × edgeScale); larger than visible stroke | Thin edge still clickable | unit | yes | yes (affordance) | low | unit |
| FC-020 | Undo | Ctrl+Z / Ctrl+Shift+Z; history max **50** snapshots; captures nodes/edges/grid/spacing | 51st snapshot drops oldest | unit | yes | yes (50-cap) | low | `canvas-store.test.ts` |
| FC-021 | Keyboard | Ctrl+A select all nodes + edges | All selected | unit | yes | no | low | unit |
| FC-022 | Keyboard | Delete/Backspace removes selected; history pushed first | Delete reversible via undo | unit | yes | no | low | unit |
| FC-023 | Keyboard | Ctrl+0 fit; Ctrl+= zoom in; Ctrl+- zoom out; 200-300ms animated | Smooth animated zoom | none | no | yes (animation timing) | low | playwright |
| FC-024 | Keyboard | Escape deselects all + tool→'select' | Combined effect | unit | yes | yes (combined reset) | low | unit |
| FC-025 | Snap | Snap-to-grid toggle; gridSize default 20px | Snap on → drag aligns 20px | unit | yes | yes (gridSize default) | low | unit |
| FC-026 | Drag history | `pushHistory()` once per drag (on start) | 5 drags → 5 undo snapshots | unit | yes | yes (start-only) | low | unit |
| FC-027 | Viewport persist | `onMoveEnd` saves pan/zoom to canvas-store; **NOT persisted to IndexedDB on reload** | Reload → viewport resets | **none** | **yes — viewport persistence golden** | **yes — incomplete persistence** | **high** — user reload loses view | new test in canvas-persistence |
| FC-028 | Persistence | Saves nodes, edges, tool, grid, spacing, viewport to IndexedDB (debounced) | Modify → reload → restored | unit | yes | yes (debounce) | medium | `canvas-persistence.test.ts` |
| FC-029 | Shape nodes | 5 shape types: rect, roundRect, ellipse, diamond, note; draggable, resizable, connectable; min 60×40 | Draw note → gold left border | unit | yes | no | low | unit |
| FC-030 | Metrics | Base units: 288×160; tree gap 32/48; ELK layer gap = NODE_HEIGHT × 0.55 = 88 | `getOwnershipNodeDimensions(1)` → (288,160) | unit | yes | yes (constants) | low | `flowchart-metrics.test.ts` |
| FC-031 | Metrics | Layer gap proportional to node height (0.55 factor) | 3-level tree → ~88px gaps | unit | yes | yes (factor) | low | unit |
| FC-032 | Page size | DPI=96; ANSI A 8.5×11 → 816×1056 px | Landscape → swapped axes | unit | yes | yes (DPI) | low | unit |

## Lane: Maps (`MAP-*`)

| id | workflow | behavior | acceptance | coverage | golden? | implicit | risk | validate |
|---|---|---|---|---|---|---|---|---|
| MAP-001 | Upload | Passive allowlist: PDF, PNG, JPG, JPEG, GeoJSON, JSON; SVG/HTML blocked even if MIME image/* | SVG upload → rejected | unit | yes — golden allowlist (existing) | yes (allowlist not MIME-sniff) | low | `file-validation.test.ts` |
| MAP-002 | Upload | Size limits: PDF 25 MB, image 10 MB, GeoJSON 20 MB | 26 MB PDF → reject w/ formatted bytes | unit | yes | yes (per-type) | low | unit |
| MAP-003 | Upload | PDF magic bytes enforced via `normalizePdfBlob` | Fake-PDF text → throws | unit | yes | no | low | `pdf-validation.test.ts` |
| MAP-004 | Upload | GeoJSON/JSON accept any valid JSON; summary derived but not validated against FeatureCollection schema | `{"any":"json"}` accepted | unit | yes | yes (non-validating) | medium | unit on `parseGeoJsonSummary` |
| MAP-005 | Featured | First asset auto-marked featured on workspace load; `ensureFeaturedAsset` enforces | Two-asset workspace none featured → first becomes featured | unit | yes — `ensureFeaturedAsset` test | yes (state-machine invariant) | low | `map-asset-upload.test.ts` |
| MAP-006 | Featured | Badge rendered on `isFeatured == true` | Badge visible only on featured | unit | yes | no | low | snapshot |
| MAP-007 | Featured | Only one featured at a time | Make B featured → A.isFeatured false | unit | yes | no | low | unit |
| MAP-008 | Selection | Asset selection re-uses stored order on reload; no explicit last-selected memory | Reload → first valid asset selected | none | yes | yes (order-based) | medium | playwright |
| MAP-009 | GeoJSON preview | Text tab shows JSON.stringify with indent 2 | Indented JSON in `<pre>` | none | yes | no | low | snapshot |
| MAP-010 | GeoJSON preview | Feature summary: count, bbox, up to 8 feature cards w/ name/geometry; label priority: name → label → tract → lease → title | Labels picked from properties in order | unit | yes | yes (label priority) | low | `geojson-summary.test.ts` |
| MAP-011 | Region overlay | "New Region" enabled only for image assets | PDF → disabled | unit | yes | yes (gate) | low | unit |
| MAP-012 | Region overlay | Click → rect centered, normalized to 0-1, clamped to image bounds | Click near edge → clamped inside | unit | yes | yes (coord system) | low | unit |
| MAP-013 | Region overlay | Default new region: width 18%, height 16% | Place → dims match | unit | yes | yes (default dims) | low | unit |
| MAP-014 | Map kind | Inferred from filename/MIME: PDF → "Map"; .geojson → "GeoJSON"; else "Other" | `.tiff` → "Other" | unit | yes | yes (inference rules) | low | unit |
| MAP-015 | Metadata | Editable: title, kind, county, prospect, effectiveDate, source, presentationSummary, notes, linked refs | Edit + save persists | unit | yes | no | low | unit |
| MAP-016 | Links | Asset → owner, lease, node, deskMap, researchSource, researchProjectRecord | Each link type persists | unit | yes | no | low | unit |
| MAP-017 | Region metadata | Status enum: Idea/Open/Active/Leased/Follow-up/Closed; acreage; color; rect; linked refs | Edit status → persists | unit | yes | no | low | unit |
| MAP-018 | Region links | Same link surface as asset | Region links persist | unit | yes | no | low | unit |
| MAP-019 | Refs | URL protocol whitelist `{http:, https:}`; `javascript:` blocked | `javascript:` → reject w/ message | unit | yes | yes (allowlist) | low | unit |
| MAP-020 | Refs | Plain domain auto-prefixed with `https://` | "example.com" → "https://example.com" | unit | yes | yes (normalize) | low | unit |
| MAP-021 | Refs | Blocked URL renders "Blocked unsupported link…" | Saved bad URL → blocked line | unit | yes | yes (UI block) | low | unit |
| MAP-022 | Delete | Delete asset cascades to all linked regions + refs (asset-level and region-level) | After delete → store empty | unit | yes | yes (cascade) | medium | unit |
| MAP-023 | Delete | Delete region cascades only to region-scoped refs; asset refs survive | Asset refs survive region delete | unit | yes | yes (scoped cascade) | low | unit |
| MAP-024 | Unlink | Deleting desk map nulls `deskMapId` on assets/regions | Link cleared after parent gone | unit | yes | no | low | unit |
| MAP-025 | PDF render | `<iframe sandbox="allow-downloads" src=objectUrl>` | PDF inline + download works | none | no | yes (sandbox flags) | low | playwright |
| MAP-026 | Text preview | Non-image, non-PDF → text in scrollable `<pre>` | .txt → formatted | none | no | no | low | playwright |
| MAP-027 | Unsupported | Fallback message "Use Preview or Download" | .dbf → fallback | none | no | yes (fallback copy) | low | snapshot |
| MAP-028 | Preview modal | Click Preview → fullscreen modal | Open + close works | none | no | no | low | playwright |
| MAP-029 | Download | Original `fileName` preserved | Download keeps filename | none | yes | no | low | unit |

## Lane: Research (`RES-*`)

| id | workflow | behavior | acceptance | coverage | golden? | implicit | risk | validate |
|---|---|---|---|---|---|---|---|---|
| RES-001 | Upload | Accept PDF, PNG, JPG, JPEG, TIF, TIFF, GeoJSON, JSON, CSV, TXT, DAT, ASC, DBF, ZIP | All extensions accepted | unit | yes | yes (extension set) | low | unit |
| RES-002 | Upload | Per-type size limits (spreadsheet 15, PDF 25, image 10, GeoJSON 20, default 25 MB) | 26 MB CSV → reject | unit | yes | yes (defaults) | low | unit |
| RES-003 | Format detect | Extension first, then MIME fallback | `.csv` w/ MIME text/plain → CSV | unit | yes | yes (priority) | low | `research-import-metadata.test.ts` |
| RES-004 | Decoder status | Enum: "Preview Ready" / "Structured Later" / "Needs Decoder" | ASCII → Structured Later | unit | yes | no | low | unit |
| RES-005 | Delimited preview | Delimiter `}`; auto-detect header row when ≥80% normalized matches known columns | Strong header → detected | unit | yes — header detection golden | **yes — `}` delimiter (RRC legacy)** | medium — delimiter contract | `rrc-delimited-text.test.ts` |
| RES-006 | Delimited preview | Column count mismatch → warning; extra ignored, missing padded blank | 1 extra column → row still parsed | unit | yes | yes (forgive + warn) | low | unit |
| RES-007 | Drilling Permit Master | ASCII fixed-width spec; record types 01/02 (status root, permit) | DPM file → permits visible | unit | yes | yes (record-type contract) | medium | `rrc-drilling-permit-master.test.ts` |
| RES-008 | Drilling Permit Master | Joins `dpm_*` and `dpm_*_lat` variants by fileStem | Both files → joined w/ lat/long | unit | yes | yes (stem pattern) | medium | unit |
| RES-009 | Horizontal Drilling | ASCII fixed-width; `HORIZONTAL_DRILLING_FIELDS` spec | HDP file → permit preview | unit | yes | no | low | `rrc-horizontal-drilling.test.ts` |
| RES-010 | Pending Drilling | Joins permit/wellbore/lat-long on `UNIVERSAL_DOC_NO` | Both files → joined | unit | yes | yes (join key) | medium | `rrc-pending-drilling.test.ts` |
| RES-011 | Pending Drilling | File kind inferred from filename stem | Wrong stem → not recognized | unit | yes | yes (stem fmt) | medium | unit |
| RES-012 | Source | Manual record: title, citation, sourceType, context, status, URL, notes, links | Create + save persists | unit | yes | no | low | unit |
| RES-013 | Source links | Link to desk map, node, owner, lease, map asset, region, import | All link types persist | unit | yes | no | low | unit |
| RES-014 | Formula | Categories: Ownership/Leasehold/NPRI/ORRI/Federal Lease Math/Decimal Interest/Unit Math/Royalty Math/Title Math/Transfer Order/Other; default = Ownership | New formula default Ownership | unit | yes | yes (default) | low | unit |
| RES-015 | Formula starters | 16+ seeded formulas linked to LANDMAN Math Reference source | New workspace → starters present | unit | yes — starter snapshot | yes (count + linkage) | low | `formula-starters.test.ts` |
| RES-016 | Project record | recordType enum (Federal Lease/Private Lease/Mapped Tract/Acquisition Target/Unit/Other); jurisdiction enum (Texas/Federal-BLM/Private/General); default Federal Lease + Federal/BLM | Create + save persists | unit | yes | yes (defaults) | low | unit |
| RES-017 | Question | Status enum: Draft/Answered/Needs Review; links to sources/formulas/projectRecords | Create + save persists | unit | yes | no | low | unit |
| RES-018 | Import metadata | Title auto-filled from filename | `file.csv` → title `file` | unit | yes | yes (auto-fill) | low | unit |
| RES-019 | Import lifecycle | Delete import → linked sources/projects have `importId` cleared | After delete, link nulled | unit | yes | yes (clear-link cascade) | low | unit |
| RES-020 | Links | Sources/formulas/questions/records carry ID arrays; sanitizer removes orphaned IDs | Delete source → formula's sourceIds drops it | unit | yes | yes (sanitizer) | low | unit |
| RES-021 | Search | All record types substring-searchable across field set + linked labels | "foo" in citation finds source | unit | yes | no | low | unit |
| RES-022 | RRC catalog | 35+ datasets; filter by category (Production/Well/GIS/Field/Organization/Tax) | Catalog filterable | unit | yes — catalog integrity test | no | low | `rrc-datasets.test.ts` |
| RES-023 | Delimited cols | Header values normalized: trim → uppercase → spaces→`_`; matched to known column names | "District No" → DISTRICT_NO | unit | yes | yes (normalize rule) | medium | unit |
| RES-024 | Fixed-width parse | 1-indexed `start`/`end`; values trimmed by default; `trim:false` preserves whitespace | DPM record 01 statusNumber cols 3-9 | unit | yes | yes (1-indexed COBOL legacy) | medium — off-by-one risk | `rrc-fixed-width.test.ts` |
| RES-025 | Import warnings | Parser warnings array for col mismatch, unknown record types, missing fields | Warnings shown but rows still processed | unit | yes | yes (warn + continue) | low | unit |
| RES-026 | CSV preview | RrcDelimitedPreviewTable shows headers + first 100 rows | 200-row CSV → 100 shown | none | yes | yes (100-row cap) | low | snapshot |
| RES-027 | Project record seed | New workspace seeds 5 Raven Forest federal lease records | Workspace boot → 5 federal leases | unit | yes — seed-data golden | no | low | unit on `buildRavenForestFederalLeases` |
| RES-028 | Project record sanitization | Deleting a referenced entity nulls the link on project records | Delete owner → record's ownerId cleared | unit | yes | yes (sanitizer) | low | unit |

## Lane: Federal Leasing (`FED-*`)

| id | workflow | behavior | acceptance | coverage | golden? | implicit | risk | validate |
|---|---|---|---|---|---|---|---|---|
| FED-001 | Seed | Workspace seeds 5 federal lease ResearchProjectRecord entries (Raven Forest TXNM A+B) | Boot → 5 records present | unit | yes | yes (auto-seed) | low | `federal-lease-seed.test.ts` |
| FED-002 | Record model | recordType="Federal Lease", jurisdiction="Federal/BLM", status default "Under Review" | New federal record matches defaults | unit | yes | yes (defaults) | low | unit |
| FED-003 | Document metadata | Separate in-memory `FederalLeaseDocument` registry holds BLM 3100-11 metadata (royalty, bonus, rental, stipulations) | Form metadata accessible separately | unit | yes | **yes — in-memory only, NOT persisted** | **medium — re-seed required each boot** | unit on `registerFederalLeaseDocuments` |
| FED-004 | Expiration bucket | 4 buckets: missing / expired / upcoming (≤180 days) / future | 90 days → upcoming; 200 days → future | unit | yes | yes (180-day threshold) | medium | `federal-lease-tracking.test.ts` |
| FED-005 | Urgency sort | Rank order: expired(0) > nextActionDate(1) > upcoming(2) > missing(3) > future(4); ties → nextActionDate → expirationDate → updatedAt | Expired sorts first | unit | yes | yes (rank weights) | medium — weight drift | unit |
| FED-006 | Tab: Inventory | All federal records visible | All jurisdiction=Federal/BLM listed | unit | yes | no | low | unit |
| FED-007 | Tab: Targets | Filters to status="Target" OR recordType="Acquisition Target" | Non-target hidden | unit | yes | yes (OR clause) | low | unit |
| FED-008 | Tab: Expirations | Excludes bucket="future" | Future records hidden | unit | yes | yes (bucket filter) | low | unit |
| FED-009 | Tab: Maps | Filters to records with `mapAssetId` OR `mapRegionId` OR `deskMapId` OR `nodeId` | Records w/ map link shown | unit | yes | no | low | unit |
| FED-010 | Tab: Sources | Filters by sourceIds.length > 0 OR importId OR non-empty sourcePacketStatus | Source-tracked records shown | unit | yes | yes (3-condition OR) | low | unit |
| FED-011 | Search | Substring across all fields + linked entity labels | "Raven Forest" finds 5 records | unit | yes | no | low | unit |
| FED-012 | Summary | Dashboard counts: current/targets/under review/expired/upcoming/missing/next-actions | Counts update with records | unit | yes | no | low | unit |
| FED-013 | Next action | `nextAction` + `nextActionDate` (ISO date only, no time); affects urgency rank | nextActionDate filled → rank 1 | unit | yes | yes (ISO-only) | low | unit |
| FED-014 | Expiration parsing | ISO-only date format; not YYYY-MM-DD → bucket "missing" | "5/15/2026" → missing bucket | unit | yes | yes (strict ISO) | medium | unit on `parseIsoDateOnly` |
| FED-015 | Editing | Uses standard ResearchProjectRecord edit modal | Edit MLRS serial persists | unit | yes | no | low | unit |
| FED-016 | Math isolation | **Federal leases do NOT participate in Desk Map tinting, leasehold math, NPRI/ORRI/WI, ONRR** | Desk Map / Leasehold filters by `jurisdiction !== Federal/BLM` | unit | **yes — math-isolation golden** | yes (jurisdiction filter contract) | **high — contamination breaks Texas math** | new isolation test |

---

## Cross-Lane Contracts

Shared contracts whose breakage cascades across lanes:

| id | contract | callers | failure mode |
|---|---|---|---|
| CL-01 | `decimal.js` config (precision 40, ROUND_HALF_UP) | All math (DM/LH/RS/FC) | Precision change re-renders every fraction; rounding drift |
| CL-02 | `fraction-display.ts` `dualDisplay()` + `formatAsFraction()` (continued-fractions + GCD) | Desk Map cards, Leasehold tables, formula tooltips, AI previews | Algorithm change drifts display contract (`0.500000000 \| 1/2`); fraction-only displays a regression |
| CL-03 | `allocateLeaseCoverage` order: effectiveDate → createdAt → updatedAt → id | DM coverage card, LH lease-slice math | Tie-break on timestamps → non-deterministic if timestamps drift; over-allocation silent |
| CL-04 | Lease scope index (`buildLeaseScopeIndex`, keyed by parentNodeId) | DM + LH | Wrong scope → lease applies to unintended branches |
| CL-05 | NPRI node fields (`royaltyKind`, `fixedRoyaltyBasis`) | DM card display, DM discrepancy detection, LH burden math | Propagation failure through Convey/Predecessor → NPRI math diverges between display and payout |
| CL-06 | `linkedOwnerId` linking | DM coverage (Linked Owners), LH owner list/naming/filter | Unlinked nodes count in title chain but not in leasehold payees — documented but confusing |
| CL-07 | `parseStrictInterestString` (`utils/interest-string.ts`) | LH royalty/ORRI/WI inputs | Loose parsing silently coerces typos to 0; strict parsing is required for warning behavior |
| CL-08 | Unit code grouping (`normalizeUnitCodeText`, `getDeskMapUnitOptions`) | DM tabs, LH summary, UnitFocusSelector, FED tabs | Inconsistent null/undefined/`''` handling → filters miss tracts |
| CL-09 | `DEFAULT_DEPTH_RANGE = 'all_depths'` placeholder | Node storage, LH ORRI/assignment | Phase 7 depth severance will require filter on every math call |
| CL-10 | Conveyance math (5 modes × 3 bases = 15 combinations) | DM convey modal, AI convey tool | Untested combination → math engine error or silent corruption |
| CL-11 | Related node taxonomy (`type='related'` + `relatedKind`) | DM card routing, LH owner filter, Documents view | New relatedKind without router update → silent fallback |
| CL-12 | `UNDO_MUTATING_TOOL_NAMES` list vs. `tools.ts` registry | AI runChat snapshot, AI undo | New mutating tool added to registry but not list → undo silently doesn't capture |
| CL-13 | `DocumentWorkspaceData` in undo snapshots | AI undo, document store | Large registry → snapshot heavy; missing new store → data loss on undo |
| CL-14 | Approval preview vs. document metadata | AI approval preview, Documents validation | Previews skip doc-metadata checks → AI approves mutation against incomplete docs |
| CL-15 | Workspace `workspaceId` scoping in all Dexie queries | All persistence (DOC/PER/MAP/RES) | Missing filter → cross-workspace bleed |
| CL-16 | Autosave debounce (2000ms) and snapshot reference equality | PER workspace, PER canvas | Reference-equality miss → no save fires; mid-edit unit switch silently discards |
| CL-17 | Workspace JSON monolith (`workspaces.data` single column) | All Zustand-backed lanes | Sharding (Phase 0.5) must split this without losing v8/v9 import compat |
| CL-18 | Magic-byte / passive allowlist for uploads | DOC, MAP, RES, AI wizard | Removing allowlist → SVG/HTML XSS surface |
| CL-19 | `.landroid` format `version: 8` and rejection of v > 8 | All persistence | Forward-version rollback path not documented |
| CL-20 | Federal/BLM jurisdiction filter on all Texas math surfaces | DM tinting, LH math, ORRI/NPRI/ONRR | Removing filter → federal leases contaminate Texas decimal |
| CL-21 | RRC delimiter `}` and 1-indexed fixed-width positions | RES delimited + fixed-width parsers | Delimiter change breaks all RRC ingests |
| CL-22 | `parseIsoDateOnly` strict YYYY-MM-DD | FED expiration buckets, FED next-action | Locale-formatted date → bucket="missing" silently |
| CL-23 | `localStorage` "LOAD WORKSPACE" confirmation magic string | PER import flow | Typo/localization change → confirmation breaks |
| CL-24 | Action journal 25-entry circular buffer + 12-entry model context | AI panel, AI system prompt | Older actions silently dropped from model view |
| CL-25 | Print/screen styling duplication (PrintCard vs. OwnershipNode) | FC print, FC view | Visual restyle in one path drifts from the other; goldens needed on both |

---

## Implicit / Surprising Behavior Log

Cross-cutting implicit behaviors users (and the rebuild) need to know:

**Thresholds and timing**
- Autosave debounce `2000ms` (hardcoded in `main.tsx`).
- Tooltip hover delay `150ms`; pin tray cap `8`.
- Desk Map drag dead zone `3px`.
- Fit-to-content max zoom `1.15`; default padding `96px`.
- Wheel zoom factors `0.92` / `1.08`; clamp `[0.1, 3.0]`.
- AI step-count cap `8` per chat turn; cloud timeout `2 min`; Ollama timeout `10 min`.
- AI action journal `25 entries` total, `12 entries` in model context.
- AI app context `40 visible nodes` max (silent truncation).
- Header detection `≥2 alias matches` per field.
- Federal lease "upcoming" window `180 days`.
- 25 MB cap on per-blob serialization, 25 MB on PDF upload, 10 MB on image upload, 15 MB on spreadsheet upload, 20 MB on GeoJSON upload, default 25 MB.
- Document preview titles truncated at `25`.
- Desk Map document chips show first `4`, then "+N more".
- Coverage-warning top contributors capped at `6`; lease overlap at `3`.
- Canvas undo history capped at `50`.
- RRC delimited preview shows first `100` rows.

**Defaults and fallbacks**
- Runsheet sort default = `date` (instrument date) ascending (not file date).
- Runsheet tract filter default = "All Tracts".
- Documents area resolution: lease → leasehold, deed → runsheet_mineral_title, else inbox.
- Display title fallback: `displayTitle` > `fileName` > `docId`.
- Featured map: first asset becomes featured automatically if none set.
- Map references: bare domain auto-prefixed with `https://`.
- AI default models: Ollama `gpt-oss:20b`, OpenAI `gpt-4o-mini`, Anthropic `claude-sonnet-4-6`.
- Federal lease default jurisdiction `Federal/BLM`, recordType `Federal Lease`.
- ISO-only date parsing for federal expirations and next-action dates (no locale formats).

**Sort / ordering contracts (non-obvious)**
- Lease allocation: `effectiveDate → createdAt → updatedAt → id`.
- NRI ORRI stacking: `effectiveDate → sourceDocNo → id`.
- Curative title issues: open → closed, then dueDate, then updatedAt desc (sort on load).
- Title issues sorted on load only; replace accepts unsorted input.
- Mineral owner table sort: leasedFraction desc → mineralFraction desc → ownerName asc.
- NPRI table sort: includedInMath desc → tractBurdenRate desc → payee asc.
- Transfer order rows: category order (royalty=0, npri=1, orri=2, retained_wi=3, assigned_wi=4) then decimal desc.

**Confirmations and destructive flows**
- `.landroid` import requires typing the magic text **"LOAD WORKSPACE"** to confirm.
- Lease-node delete: removes lease record only when no other links remain (and only with confirmation).
- Unit-focus switch in Leasehold: **no confirmation; silently discards in-progress transfer-order draft**.
- Multi-tab: no detection or lock; concurrent writes are last-write-wins.
- v7→v8 PDF migration: one-shot auto-download backup; orphaned attachments are assigned through a fallback/orphan path with no UI to discover them.
- Document detach: doesn't delete shared docs; cascade only on last attachment.
- AI undo: single-level only; restores all 4 stores + documents.

**Display contracts**
- Card tint precedence: discrepancy > NPRI healthy > present mineral > parchment.
- Lease chip color: emerald (lease) vs gold (other related doc).
- "Remaining" fraction line hidden when initial == remaining.
- Print page labels: A1, A2, B1, B2…
- CSV UTF-8 BOM and RFC 4180 escaping; image path only emitted when both docNo and attachments present.

**Validation behaviors**
- NPRI rows in spreadsheet import require fixed/floating + (if fixed) basis answer before "Create" becomes enabled (silent gate).
- Strict interest parsing: malformed value → `0` + warning (visible).
- Over-100% coverage: warning-only, **non-blocking**.
- Lease overlap: warning-only, **non-blocking**.
- "Over-burdened" / "Over-assigned" leasehold flags: warning-only.
- PDF validation enforced via magic bytes (`%PDF-`).
- Map upload allowlist is by extension, not MIME sniffing.

---

## Known Coverage Gaps (explicit)

Areas where Phase 0 confirmed there is **no current test or golden master**:

1. **Multi-tab concurrent-write behavior** — no detection, no lock, no test. (PER-024)
2. **Canvas viewport persistence across page reload** — saved in store but not persisted to IndexedDB. (FC-027)
3. **Document manifest JSON schema** — output not validated against a fixture. (DOC-017)
4. **Cross-workspace document isolation** — `workspaceId` filter present in queries but not asserted in tests. (DOC-033)
5. **`.landroid` orphaned-PDF discovery UI** — v7 migration records orphaned node IDs and keeps affected PDFs via a fallback workspace path, but there is no user-facing discovery/recovery UI. (DOC-039, PER-009)
6. **AI snapshot completeness vs. growing store list** — no compile-time check that all stores get captured. (CL-13, AI-030)
7. **`UNDO_MUTATING_TOOL_NAMES` ↔ `tools.ts` registry drift** — no compile-time check. (CL-12, AI-027)
8. **AI app-context truncation log** — silent at 40 nodes; no warning. (AI-021)
9. **AI 8-step cap behavior** — no test asserting 9-step loop stops. (AI-025)
10. **Approval preview vs. document-metadata completeness** — no joint check. (CL-14)
11. **System prompt rule integrity** — 10 non-negotiable rules not snapshot-tested. (AI-036)
12. **Hosted 401 token-refresh path** — no test; session logout is the only handler. (AI-024)
13. **Lease-allocation tie-break determinism** — timestamps tie-break, no test fixture for same-effective-date leases. (DM-016, LH-002)
14. **NRI ORRI stacking order** — no fixture explicitly proving order matters. (LH-010)
15. **Print/screen styling drift** — PrintCard duplication vs. OwnershipNode; no visual-diff guard. (FC-012, CL-25)
16. **Multi-sheet wizard classification** — full Parse→Analyze→Stage→Apply not tested end-to-end. (AI-039, AI-040)
17. **Performance baselines** — no recorded baseline for autosave, packet preview, `.landroid` round trip, print, or large Desk Map. (See §Performance Baseline Plan.)
18. **Federal math isolation** — no explicit golden test asserting Texas math filters by jurisdiction. (FED-016, CL-20)
19. **GeoJSON schema validation** — accepted as any-JSON; no FeatureCollection enforcement. (MAP-004)
20. **RRC fixed-width 1-indexed position drift** — sliceFixedWidthValue not tested with off-by-one fixtures. (RES-024)

---

## Reference Workspaces

Three reference workspaces are required as Phase 0 fixtures. Two are derivable from existing seed code; one is new.

### W1 — Vulcan Mesa Demo Fixture (existing seed)
- Source: `src/storage/seed-vulcan-mesa.ts`.
- Shape: small Texas project, two non-pooled units, mixed mineral + NPRI,
  leases, planted warnings, and federal references seeded by
  `buildRavenForestFederalLeases`.
- Use: smoke/regression of all lanes; .landroid round trip; print fidelity; AI approval previews.
- Note: this fixture was renamed from the prior internal-only demo name before
  external sharing. The current name intentionally mixes Texas/Wild West flavor
  with Roman mythology.
- Export target: `fixtures/phase-0/demo.landroid` (committed; check size before committing).
- Checksum target: `fixtures/phase-0/demo.sha256`.
- Expected outputs: `fixtures/phase-0/demo.runsheet.csv`, `demo.packet-manifest.json`, `demo.leasehold-decimals.json`, `demo.flowchart-print.pdf` (or PNG screenshots if PDF unstable).

### W2 — Raven Forest (production-shape reference)
- Source: existing `buildCombinatorialWorkspaceData()` in
  `src/storage/seed-test-data.ts`.
- Shape: multi-tract, multi-unit, 5 federal leases (read-only reference), 1,476
  title nodes, 145 PDF mappings, lease + NPRI + ORRI overlap fixtures.
- Use: scale & performance baselines; lease-allocation tie-break determinism; coverage-warning golden; transfer-order golden.
- Policy: do not freeze today's exact Raven Forest export as the long-term
  rebuild fixture. Keep W2 as a documented stress-test recipe and generate a
  similar deterministic project specifically for the rebuild.
- Recipe: `fixtures/phase-0/raven-forest-stress-recipe.md`.
- Future outputs: generated manifest, performance baselines, and targeted
  golden summaries. Commit a full `.landroid` only if the stubbed artifact stays
  small enough to review.

### W3 — Migration Stress (v7 + orphan)
- Source: hand-crafted v7 `.landroid` with one orphaned PDF (no matching workspace node).
- Use: assert v7→v8 migration semantics; verify fallback/orphan handling; verify post-v8 backup auto-download.
- Export target: `fixtures/phase-0/migration-v7-orphan.landroid`.
- Expected outputs: `fixtures/phase-0/migration-v7-orphan.expected.json` (post-import workspace shape).

---

## Golden Master Fixture Plan

File layout (proposed):

```
fixtures/phase-0/
  README.md                          # how to regenerate, where checksums live
  demo.landroid                      # W1 reference workspace after rename
  demo.sha256
  demo.runsheet.csv                  # CSV golden (matches RS-001 column order)
  demo.packet-manifest.json          # DOC-017 manifest golden
  demo.leasehold-decimals.json       # LH math golden (all categories)
  demo.flowchart-pages.json          # FC tile layout + page count golden
  demo.coverage-summary.json         # DM coverage card golden
  raven-forest-stress-recipe.md      # W2 rebuild stress-test recipe
  migration-v7-orphan.landroid       # W3
  migration-v7-orphan.expected.json
  ai/
    system-prompt.snapshot.md        # AI-036 rule integrity
    action-journal.last-12.json      # AI-019 context format
    approval-preview/                # AI-009 through AI-014 per-tool fixtures
      create-root-node.json
      convey.json
      create-npri.json
      delete-node.json
      attach-lease.json
  rrc/
    drilling-permit-master.sample.asc
    drilling-permit-master.expected.json
    horizontal-drilling.sample.asc
    horizontal-drilling.expected.json
    pending-drilling-permit.sample.txt
    pending-drilling-wellbore.sample.txt
    pending-drilling.expected.json
  maps/
    allowlist.cases.json             # MAP-001 passive allowlist
    geojson.summary.cases.json       # MAP-010 label-priority
  print/
    flowchart-2x2-grid.snapshot.png  # FC-011/FC-012
    flowchart-1x1-grid.snapshot.png
```

Test pointers (new files to add or existing files to expand):

Implemented W1 fixture guard:

- `src/phase0/__tests__/vulcan-mesa-fixtures.test.ts` validates the committed
  Vulcan Mesa `.landroid` checksum, exported workspace counts, runsheet CSV,
  packet manifest, leasehold decimal/transfer-order output, and Desk Map
  coverage summary against the generated goldens. It also imports the W3 v7
  migration-stress fixture and asserts the orphaned legacy PDF stays attached
  through the fallback workspace path.

| Lane | Test file (existing or new) | New goldens |
|---|---|---|
| DM | `src/__tests__/deskmap-behaviors.test.ts` (new) | pan/zoom, drag threshold, fit-to-content, card click during drag |
| DM | `src/__tests__/coverage-formulas.test.ts` (new) | over-100% warning, lease overlap, top-N caps |
| DM | `src/__tests__/npri-discrepancy.test.ts` (new) | 3 discrepancy kinds, red persistence |
| LH | `src/__tests__/leasehold-orri-math.test.ts` (new) | 3 basis types, stacking order, clamp |
| LH | `src/__tests__/leasehold-npri-math.test.ts` (new) | floating, fixed branch, fixed whole-tract zero-divisor |
| LH | `src/__tests__/leasehold-transfer-order.test.ts` (new) | category sort, expected vs total, variance |
| LH | `src/__tests__/leasehold-input-validation.test.ts` (new) | strict parse warnings |
| DOC | `src/storage/__tests__/document-store.test.ts` (new) | Dexie txn atomicity, workspace scoping, cascade, reorder |
| DOC | `src/__tests__/integration/documents-end-to-end.test.ts` (new) | upload → attach → filter → manifest schema |
| DOC | `src/__tests__/unit/pdf-validation.test.ts` (new) | magic-byte enforcement |
| AI | `src/ai/__tests__/system-prompt.test.ts` (new) | 10 rules snapshot, math reference present, tool list complete |
| AI | `src/__tests__/integration/ai-approval-end-to-end.test.ts` (new) | propose → approve → journal → undo → state restored |
| AI | `src/ai/wizard/__tests__/wizard-integration.test.ts` (new) | Parse → Analyze → Stage → Apply |
| PER | `src/storage/__tests__/multi-tab.test.ts` (new) | concurrent-tab conflict |
| PER | `src/storage/__tests__/autosave-config.test.ts` (new) | `AUTOSAVE_DEBOUNCE_MS` extracted + tested |
| FC | `src/__tests__/flowchart-print-golden.test.ts` (new) | 2×2 and 1×1 grid screenshot baselines |
| FC | `src/storage/__tests__/canvas-viewport-persistence.test.ts` (new) | viewport restored on reload |
| RES | `src/research/__tests__/rrc-catalog-integrity.test.ts` (new) | 35 datasets, all fields present |
| FED | `src/federal-leasing/__tests__/math-isolation.test.ts` (new) | jurisdiction filter on every Texas-math entry point |

---

## Performance Baseline Plan

Phase 0 now has a repeatable capture walkthrough, but it still has **no
recorded PERF-01 through PERF-08 baseline measurements** on the current branch.
To close the exit gate, capture the following with a single fixed machine
profile (declared in the fixture README) and a deterministic seed.

Machine profile (record at capture time): CPU model, core count, total RAM, OS version, Node version, Chrome version, dev-server mode (Vite dev vs prod build).

Workflows to baseline:

| id | workflow | command | fixture | metric | drift budget |
|---|---|---|---|---|---|
| PERF-01 | Large Desk Map render | `npm run dev` → open Raven Forest workspace → activate biggest tract | W2 (Raven Forest seed) | First contentful paint of Desk Map view; time to interactive | ±15% |
| PERF-02 | Document registry load | open Documents view with 30+ PDFs registered | W2 with stubbed blobs | Time to render first 25 rows; time to compute duplicate map | ±15% |
| PERF-03 | Packet preview build | switch packet source to "Filter" with all filters wide | W2 | Time to compute `buildPacketPreview` for ~40 docs | ±15% |
| PERF-04 | `.landroid` round trip | export then re-import W2 | W2 | Total round-trip wall-clock; peak heap during base64 decode | ±20% |
| PERF-05 | Autosave debounce | edit Desk Map node → wait → confirm IndexedDB write | W1 | Observed debounce delay (target 2000ms ± 50ms); snapshot serialize time | ±10% |
| PERF-06 | Flowchart print | Ctrl+P on auto-imported W2 canvas | W2 | Time to render print overlay; number of pages; per-page render time | ±15% |
| PERF-07 | Spreadsheet import (Parse only) | wizard upload of a 5,000-row CSV | new fixture `fixtures/phase-0/import-stress.csv` | Worker parse time; main-thread block time (should be ~0) | ±20% |
| PERF-08 | Leasehold transfer-order build | open Leasehold view with W2, unit focus = Raven Forest A | W2 | Time to compute `buildLeaseholdDecimalRows` | ±15% |

Baseline capture walkthrough:
```
scripts/capture-phase-0-baselines.md
```

Current status template:
```
fixtures/phase-0/perf/baseline-status.json
```

Rows must remain `not_captured` or `blocked_*` until raw browser profiles,
commands, machine context, fixture checksums, and measured results exist. Do not
convert a row to `captured` from observation or judgment alone.

Manual smoke-check runbook:
```
docs/phase-0-manual-smoke-checks.md
```

Manual smoke results should link back to this inventory by row id or mark the
row `needs verification` if the observed behavior is ambiguous.

---

## Sequencing Notes for Phase 0.5 / 0.75 / 1

Phase 0 findings that should reshape the rebuild plan:

### Phase 0.5 (Workspace Storage Sharding)

1. **Extract `AUTOSAVE_DEBOUNCE_MS` constant before sharding**. The hardcoded `2000ms` in `main.tsx` combined with reference-equality snapshot comparison is fragile; sharding will multiply snapshot points. Extract first to de-risk. *(PER-001, CL-16)*
2. **Multi-tab pessimistic locking belongs in 0.5, not later**. Hosted mode will expose last-write-wins immediately; add a session-id-on-workspace-row check before splitting tables. Optimistic versioning is more complex than needed for local-first MVP. *(PER-024, CL-16)*
3. **Don't combine version-field addition with shard split**. Use one Dexie version bump (`v9 → v10`) for the shard, another for optimistic-locking metadata. Easier to roll back. *(PER-018)*
4. **Orphaned-PDF cleanup UI is Phase 0.6, not 0.5**. Phase 0.5 is high-risk enough. Orphans exist but are rare (only from v7→v8). *(DOC-039, PER-009)*
5. **Canvas viewport persistence belongs in 0.5**. Viewport-on-reload is a current bug (FC-027); sharding canvas state without fixing this would freeze the gap.
6. **Carry forward the v8 import-rejection contract**. Phase 0.5 must keep "version > 8" rejection and add a `v10` write path; do not break the v8 read path. *(PER-008, CL-19)*

### Phase 0.75 (Backend Architecture Decision)

7. **Federal lease documents are currently in-memory only** (`FederalLeaseDocument` registry). If the backend decision is "yes," document-metadata persistence belongs server-side; if "no," it must migrate into Dexie via `ResearchProjectRecord` extension. *(FED-003)*
8. **Hosted-mode 401 mid-stream is unaddressed**. Phase 0.75 should decide whether the answer is (a) silent token refresh in the proxy, (b) explicit re-auth modal mid-chat, or (c) server-side session anchoring. Current behavior is "session logout" — destructive. *(AI-024)*
9. **AI app-context 40-node cap warrants backend-side context assembly**. If backend lands, server-side context with full-record awareness sidesteps the silent truncation. *(AI-021, CL-13)*
10. **RRC dataset catalog is static**. Backend changes whether refresh becomes server-pushed or stays client-bundled. *(RES-022)*

### Phase 1 (Project Record Schema Foundations)

11. **`UNDO_MUTATING_TOOL_NAMES` ↔ `tools.ts` drift needs a compile-time guard**, not just a list. Add a TypeScript discriminated-union check or test that every mutating tool registered in `tools.ts` appears in the list. Without it, every new Phase 1 typed-command is a silent undo regression. *(AI-027, CL-12)*
12. **`MathInputView` projection must preserve current display contracts**, including the "Remaining hidden when initial == remaining" rule (FC-016) and the lease-allocation tie-break (DM-016, LH-002, CL-03). These are display+math joints, not pure math.
13. **CSV column order (RS-001) is a Phase 1 schema-level contract**, not a Phase 0 UI behavior. The runsheet column list is what landman import templates depend on; record it as a typed `RunsheetColumn` enum tied to schema migrations.
14. **Federal math isolation belongs in Phase 1 type design**. The jurisdiction filter is currently spread across multiple math entry points; the rebuild should put `Jurisdiction === 'Texas'` as a precondition on the `MathInputView` projection rather than re-checking per surface. *(FED-016, CL-20)*
15. **Phase 1 should preserve, not improve, the "lease delete cleans up record only if no other links" rule** (DM-029) — it's an invariant of the current `Lease ↔ DocumentLink` relation.

### Plan File Updates Recommended

Reconciliation status for the plan-file updates:

- Reflected in `docs/rebuild-plan.md`: Phase 0.5 now includes multi-tab conflict behavior, autosave timing, canvas viewport persistence, PWA/iPad persistent storage, lazy PDF loading, and Raven Forest-scale acceptance.
- Reflected in `docs/rebuild-plan.md` and `docs/adr/0008-backend-spine-decision-gate.md`: Phase 0.75 now records backend architecture approved in principle, implementation deferred until a hard trigger, and backend-ready local record requirements.
- Reflected in `docs/rebuild-plan.md` and `TESTING.md`: Phase 1 now requires a mutating-tool approval/undo drift guard and `MathInputView` preservation of Phase 0 display/math contracts.

---

## Exit Gate Status

Status against the Phase 0 exit gate from `docs/rebuild-plan.md` (lines 657–665):

| Gate | Status | Missing |
|---|---|---|
| Current branch has a documented page/workflow inventory | **Partially met** (this document is the draft master and is now cross-linked from source docs) | Commit decision; lead-thread row review |
| Frozen reference workspaces and expected outputs checked in (or explicitly documented if too large) | **Partially met** (W1 Vulcan Mesa export, checksum, and expected outputs exist under `fixtures/phase-0/`) | W2 needs a deterministic seed; W3 needs to be hand-crafted; checksum manifest beyond W1 pending |
| Performance baselines recorded with command, fixture, machine, drift | **Not met** | Capture walkthrough and status template exist; all 8 PERF-* measurements remain unfilled |
| Full relevant tests pass | **Partially met** (`npm test`, `npm run lint`, and `npm run build` pass on this branch) | Proposed new golden-master tests still need implementation before Phase 0 can close |
| Missing coverage listed in `docs/rebuild-plan.md` or `TESTING.md` | **Met for draft inventory** | Keep list updated as rows are verified or marked `needs verification` |

### Concrete Checklist to Close the Gate

- [x] Commit `docs/phase-0-inventory.md` (this file)
- [x] Cross-link from `TESTING.md` and `docs/rebuild-plan.md` Phase 0 section
- [x] Generate `fixtures/phase-0/demo.landroid` + `.sha256` after the demo workspace is renamed
- [x] Produce `fixtures/phase-0/demo.runsheet.csv` and freeze as golden
- [x] Produce `fixtures/phase-0/demo.packet-manifest.json` and freeze as golden
- [x] Produce `fixtures/phase-0/demo.leasehold-decimals.json` and freeze as golden
- [x] Produce `fixtures/phase-0/demo.coverage-summary.json` and freeze as golden
- [x] Add W1 golden-master test coverage for the committed fixture files
- [x] Document W2 Raven Forest-scale fixture strategy without freezing today's
  exact workspace export
- [x] Author `fixtures/phase-0/migration-v7-orphan.landroid` + expected
- [ ] Add the 18 new test files listed in §"Golden Master Fixture Plan"
- [x] Snapshot AI system prompt rules (AI-036)
- [x] Commit `scripts/capture-phase-0-baselines.md` and `fixtures/phase-0/perf/baseline-status.json`
- [ ] Capture all 8 PERF-* baselines on a declared machine and attach raw profiles/results
- [x] Run `npm test` and confirm green or document failing rows here
- [x] Update `docs/rebuild-plan.md` Phase 0.5 / 0.75 / 1 exit-gate language per §"Sequencing Notes"

When every box is checked, Phase 0 is complete and the rebuild plan may be revisited before Phase 0.5 implementation begins, per `docs/rebuild-plan.md` Phase 0 Operating Plan item 6.
