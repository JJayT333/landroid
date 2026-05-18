# LANDroid Audit Report — 2026-03-31

> ARCHIVED / HISTORICAL.
> This audit predates later architecture, AI, Federal Leasing, and workflow
> changes. Use the root `AUDIT_REPORT.md` and `PATCH_PLAN.md` for current
> audit/remediation status.

## Executive Summary

LANDroid is in **strong health** for a pre-release application. The math engine is well-architected with consistent Decimal.js usage, every mutation validates the full graph, and the type system is exceptionally clean (zero `any`, zero `@ts-ignore`). The biggest risks are: (1) a precision boundary in fraction display where `Decimal.toNumber()` drops to 64-bit float, (2) no Error Boundary so a lazy-load or render failure crashes the entire app, and (3) CSV import converts fractions through `Number()` which silently loses precision for complex ownership chains.

## Baseline Health
- **Tests:** 142/142 passed (25 files, 687ms)
- **Lint:** Clean — `tsc --noEmit` zero errors
- **Build:** Succeeds — 1 CSS warning (`file` property), FlowchartView chunk **1.67 MB** (gzip 510 KB)

---

## Findings by Severity

### 🔴 Critical

**1. Fraction display drops to 64-bit float — silent precision loss**
- **File:** `src/engine/fraction-display.ts:127`
- `const num = dec.toNumber()` converts a Decimal (40-digit precision) to a JavaScript `Number` (15-16 significant digits) before running the continued-fraction algorithm (`bestRational`).
- **Impact:** For ownership fractions with denominators requiring > 15 digits of precision, the displayed fraction will be wrong. The stored value is correct, but the UI fraction (e.g., "1/420") may not match the actual decimal.
- **Fix:** Rewrite `bestRational()` to operate on `Decimal` or `BigInt` values directly, or accept that the `exactFiniteFraction()` path (which uses BigInt) handles exact cases and `bestRational` is a fallback approximation — but document this as an explicit tradeoff and add a test that verifies the boundary.

**2. CSV import converts fractions through `Number()` — precision truncation**
- **File:** `src/storage/csv-io.ts:88`
- `toDecimalString()` does `Number(value ?? 0)` then `.toFixed(9)`. Any fraction with > 15 significant digits loses precision at the `Number()` step.
- **Impact:** Importing a v1 CSV with deep ownership chains (e.g., 1/3 of 1/3 of 1/3) will have tiny rounding drift that accumulates. The system then validates these as-if exact, so the drift is locked in.
- **Fix:** Replace `Number(value)` with `d(value).toFixed(9)` to route through Decimal.js.

**3. No Error Boundary — any render crash kills the app**
- **File:** `src/App.tsx` (entire file)
- Six lazy-loaded views are wrapped in `<Suspense>` (good), but there is **no `<ErrorBoundary>`** anywhere in the component tree. If a lazy chunk fails to load (network error), or any component throws during render, the entire app white-screens.
- **Impact:** User loses access to all views. No recovery path.
- **Fix:** Add an ErrorBoundary component wrapping each `<Suspense>` (or one at the `<main>` level) that shows a "Something went wrong — click to retry" UI.

---

### 🟡 Warning

**4. Autosave can persist mid-operation state (2s debounce window)**
- **File:** `src/main.tsx:58-71`
- The workspace subscription fires on every Zustand `set()` call. A multi-step operation (e.g., `attachConveyance` which updates destination, source, and all descendants) triggers a single atomic `set()` from the store — so this is safe for engine operations. However, a user doing rapid sequential edits (e.g., edit two form fields back-to-back) could have the first save capture only the first field change.
- **Impact:** Low — the 2s debounce means the final state will be saved, but if the browser crashes within that 2s window, one field change could be lost.
- **Fix:** Acceptable risk, but consider `beforeunload` to flush pending saves.

**5. `parseInterestString` clamps to [0, 1] — cannot model interests > 1.0**
- **File:** `src/utils/interest-string.ts:22`
- Uses `clampUnit()` which caps at 1.0. This is correct for individual fractional interests but could silently truncate if someone enters a gross royalty share like "1.25" (a 1/8 overriding on 10/8 basis — unlikely but legal).
- **Impact:** Edge case, but worth documenting as an intentional constraint.
- **Fix:** Add a code comment explaining the domain rationale for the [0,1] clamp.

**6. Conveyance share comparison uses epsilon tolerance one-directionally**
- **File:** `src/engine/math-engine.ts:228`
- `shareAmt.greaterThan(clamp(parent.fraction).plus('0.000000001'))` allows a child to take up to 0.000000001 MORE than the parent's remaining fraction. This micro-tolerance prevents nuisance rounding errors, but the same tolerance appears in `executeAttachConveyance:520` and the validator at `:727`.
- **Impact:** In theory, a conveyance chain that consistently hits the epsilon boundary could accumulate drift. 40-digit internal precision makes this extremely unlikely, but the tolerance should be documented as a known engineering constant.
- **Fix:** Extract `EPSILON = new Decimal('0.000000001')` as a named constant (it already is in the validator at line 712, but not in convey/attach). Unify.

**7. FlowchartView chunk is 1.67 MB (gzip 510 KB)**
- **File:** `vite.config.ts` / build output
- The FlowchartView lazy chunk includes `@xyflow/react` and `elkjs`, which are large libraries.
- **Impact:** First load of the flowchart view will be slow on poor connections.
- **Fix:** Consider splitting elkjs into its own chunk via `manualChunks`, or dynamically importing it only when the user triggers a layout operation.

**8. `normalizeAcreage` uses `Number()` for acreage parsing**
- **File:** `src/types/node.ts:82`
- `Number(trimmed)` is used for acreage fields. Acreage values don't require Decimal precision, but this means the normalizer silently accepts `Number` values like `"3.1415926535897932384626"` truncated to 64-bit float.
- **Impact:** Negligible for acreage (which never needs > 10 decimal places), but inconsistent with the Decimal discipline elsewhere.
- **Fix:** Acceptable — acreage does not participate in ownership math.

**9. Dexie schema migrations have no explicit `upgrade()` handlers**
- **File:** `src/storage/db.ts:48-104`
- All 5 schema versions define table structures but zero call `.upgrade()` to transform data between versions. Dexie handles additive schema changes (new tables, new indexes) automatically, but if any migration needed data transformation, it would silently skip it.
- **Impact:** Current migrations are all additive (new tables: canvases in v2, owners/leases/maps in v3, mapRegions/mapExternalReferences in v4, researchImports in v5). No data loss expected. But if a future migration needs to rename a field or transform data, the pattern isn't established.
- **Fix:** Add a comment documenting this intentional pattern, and note that any non-additive migration will need an explicit `upgrade()`.

**10. `PlaceholderView` used for both loading and error states**
- **File:** `src/App.tsx:16-31`
- The `PlaceholderView` component is used as a Suspense fallback, which is fine. But since there's no ErrorBoundary, if a chunk fails the user sees nothing (React 18 unmounts the entire tree).
- **Impact:** See finding #3.

---

### 🔵 Info

**11. v1 code is fully removed from `src/`**
- The old `app.jsx`, `mathEngine.js`, and `auditLog.js` no longer exist in the active `src/` directory. They only appear in `.claude/worktrees/` (a Claude Code artifact, not shipped code). Clean.

**12. Zero `any` types, zero `@ts-ignore`, zero `@ts-expect-error`**
- Exceptional TypeScript discipline. The codebase is fully strictly typed with no escape hatches.

**13. Zero `eval()`, `innerHTML`, `dangerouslySetInnerHTML`, or `new Function()`**
- No security surface from code injection vectors.

**14. Autosave change detection is reference-based (efficient)**
- `src/storage/autosave-change-detection.ts` uses reference equality for arrays/objects and value equality for primitives. This is O(1) and avoids JSON.stringify overhead. The tradeoff is it can't detect deep mutations — but Zustand's immutable update pattern means this is safe.

**15. Stern-Brocot max denominator is 1,000,000 (documented as default)**
- `src/engine/fraction-display.ts:117` — `maxDenominator = 1_000_000`. Most oil & gas fractions have denominators well under 10,000. The million limit is generous.

**16. `exactFiniteFraction` uses BigInt correctly for exact cases**
- The fraction display first tries an exact BigInt-based reduction (no precision loss), only falling back to `bestRational` (float approximation) when the exact denominator exceeds `maxDenominator`. This is well-designed.

**17. All tests are deterministic**
- No `Date.now()`, `Math.random()`, or network calls in test files. The `seed-test-data` tests use static fixture data.

**18. All Zustand stores are fully typed**
- Every store has explicit `interface` for state + actions. No `any` leakage.

**19. Workspace/canvas load paths have full normalization**
- `loadWorkspaceFromDb` runs every loaded value through normalizer functions (`normalizeOwnershipNode`, `normalizeDeskMap`, `normalizeLeaseholdUnit`, etc.). Missing fields get defaults. This is robust against schema evolution.

**20. Graph validator checks all 5 invariants post-operation**
- Every engine operation (convey, rebalance, predecessorInsert, attachConveyance, deleteBranch) calls `validateCalcGraph()` before returning, which checks: no negative fractions, finite values, no cycles, valid parent refs, and branch allocation within epsilon.

---

## Coverage Gaps

### Math Engine — Untested Edge Cases
| Edge Case | Status |
|-----------|--------|
| Convey 100% of a node (zero remainder) | ✅ Covered (`all` mode) |
| Convey to node that already has children | ⚠️ Not explicitly tested |
| Predecessor insert on root node | ⚠️ Not explicitly tested (root has `parentId: null`) |
| Rebalance when siblings already sum correctly | ⚠️ Not explicitly tested |
| Delete the only child of a node | ✅ Covered |
| Attach subtree exceeding target capacity | ⚠️ Error path not explicitly tested |
| Single-node tree operations | ⚠️ Not explicitly tested |
| Fraction display round-trip (parse → display → parse) | ⚠️ Not tested |

### Storage — Untested Paths
| Path | Status |
|------|--------|
| CSV import with Unicode names | ⚠️ Not tested |
| CSV import with quoted commas in fields | ⚠️ Relies on PapaParse (probably fine) |
| `.landroid` import from older schema version | ⚠️ Not tested |
| Autosave during browser crash | ⚠️ Not testable in Vitest, needs manual verification |
| XLSX export formula correctness | ⚠️ Tests check structure, not formula evaluation |

### Domain Model Gaps
| Gap | Description |
|-----|-------------|
| Lease expiration/termination | No mechanism to model lease termination and interest reversion |
| Life estate / remainder | Type system doesn't distinguish fee simple from life estate |
| Executive rights | No separate modeling of executive vs. non-executive mineral interests |
| Reservation vs. grant | Both modeled as conveyances — no semantic distinction in the data model |
| Gap detection in runsheet | No automated detection of missing instruments in the chain |
| Multi-owner-in-multi-tree | An owner appearing in multiple desk maps has no cross-tree reconciliation |

---

## Recommended Fix Order (All Findings, Prioritized)

### Tier 1 — Fix now (correctness & crash risk)

| # | Finding | Effort | Why first |
|---|---------|--------|-----------|
| 1 | **🔴 Error Boundary** (#3) | 30 min | App white-screens on any render error. One component fixes it. |
| 2 | **🔴 CSV import precision** (#2) | 5 min | One-line fix: `d(value)` instead of `Number(value)`. Prevents drift on every import. |
| 3 | **🔴 NRI/WI burden-basis ORRI math not implemented** (L1) | 2-4 hrs | Users can select these options but they silently do nothing. Either implement or remove from UI. |

### Tier 2 — Fix soon (data model gaps, silent wrong answers)

| # | Finding | Effort | Why |
|---|---------|--------|-----|
| 4 | **🟡 One lease per owner across all tracts** (L4) | 4-6 hrs | Wrong answer for any multi-tract deal where owners have different leases on different tracts. Requires lease-to-tract scoping. |
| 5 | **🔴 Fraction display `.toNumber()` boundary** (#1) | 2-3 hrs | Display-only (stored values are correct), but misleading fraction strings for complex denominators. Design decision needed. |
| 6 | **🟡 Cascade cleanup on desk map deletion** (L6) | 1-2 hrs | Phantom assignments/ORRIs after deleting a tract. Low-effort fix. |
| 7 | **🟡 Warn when lease cap triggered** (L3) | 1 hr | Silent leased-coverage reduction. Add `leasedInterestCapped` flag. |
| 8 | **🟡 Extract EPSILON constant** (#6) | 15 min | Three locations use `'0.000000001'` — unify to a named constant. |

### Tier 3 — Harden (performance, resilience, documentation)

| # | Finding | Effort | Why |
|---|---------|--------|-----|
| 9 | **🟡 `beforeunload` autosave flush** (#4) | 30 min | Prevents data loss if browser closes during 2s debounce. |
| 10 | **🟡 FlowchartView 1.67 MB chunk** (#7) | 1-2 hrs | Slow first-load on poor connections. Split elkjs into own chunk. |
| 11 | **🟡 Dexie migration pattern docs** (#9) | 15 min | Future-proofing: document that all current migrations are additive. |
| 12 | **🟡 Over-assignment visual escalation** (L5) | 1 hr | Red badge on Leasehold view when any tract is over-assigned. |
| 13 | **🟡 Assignment overlap detection** (L2) | 2-3 hrs | Unit + tract assignments can double-count the same WI. No warning. |

### Tier 4 — Polish (test coverage, documentation, edge cases)

| # | Finding | Effort | Why |
|---|---------|--------|-----|
| 14 | **🔵 Leasehold tests: zero-owner tracts, NPRI interaction** (L8) | 1-2 hrs | Untested edge cases in leasehold summary. |
| 15 | **🔵 Math engine edge-case tests** | 2-3 hrs | Predecessor insert on root, attach exceeding capacity, single-node tree. |
| 16 | **🔵 Fraction display round-trip test** | 30 min | Verify `parse(display(value)) === value` for edge values. |
| 17 | **🔵 CSV import: Unicode, BOM, quoted commas** | 1 hr | Relies on PapaParse but no explicit tests. |
| 18 | **🔵 `.landroid` import from older versions** | 1 hr | Schema evolution test — import a v1-era file. |
| 19 | **🔵 `parseInterestString` [0,1] clamp documentation** (#5) | 5 min | Comment explaining why > 1.0 is intentionally rejected. |

### Domain Model Gaps (future features, not bugs)

| Gap | Priority | Notes |
|-----|----------|-------|
| Lease expiration/termination modeling | Medium | No mechanism to revert interests on lease expiry |
| Life estate / remainder distinction | Low | Type system treats all interests as fee simple |
| Executive vs. non-executive rights | Low | No separate tracking |
| Reservation vs. grant semantics | Low | Both modeled as conveyances |
| Runsheet gap detection | Medium | No automated chain-of-title gap detection |
| Cross-tree owner reconciliation | Medium | Same owner in multiple desk maps has no reconciliation |

---

## Leasehold Module — Deep Dive

The agents read every leasehold file but ran out of tokens before writing findings. Here is the complete leasehold audit:

### 🔴 Critical

**L1. ORRI burden basis `net_revenue_interest` and `working_interest` are defined but never computed**
- **File:** `src/types/leasehold.ts:24-28` defines three ORRI burden bases: `gross_8_8`, `net_revenue_interest`, `working_interest`
- **File:** `src/components/leasehold/leasehold-summary.ts:225-227, 296-301, 425-426`
- The summary math **only includes ORRIs with `burdenBasis === 'gross_8_8'`** in calculations. If a user enters an ORRI with `net_revenue_interest` or `working_interest` basis, it is tracked (appears in the ORRI list) but `includedInMath` is false and its decimal is `'0'`.
- The test at line 186-190 confirms this: `orri-tracked-only` with `burdenBasis: 'net_revenue_interest'` has `includedInMath: false, unitDecimal: '0'`.
- **Impact:** A user enters an NRI-basis ORRI expecting it to affect the WI calculation. It doesn't. The UI shows it as "tracked" but it silently contributes nothing to the math. This is a correctness gap for any deal with NRI-basis overrides.
- **Fix:** Either implement the NRI and WI burden-basis computations (NRI-basis ORRI = burden × NRI, WI-basis ORRI = burden × WI), or remove the options from the UI and only allow `gross_8_8` until the others are implemented. At minimum, show a visible "Not included in math" warning badge on the ORRI row.

### 🟡 Warning

**L2. Assignment shares are additive across scopes — can double-count**
- **File:** `src/components/leasehold/leasehold-summary.ts:319-326`
- `relevantAssignments` includes both unit-scope AND tract-scope assignments. Their `workingInterestFraction` values are summed to get `assignmentShare`. A unit-scope assignment of 50% plus a tract-scope assignment of 25% results in `assignmentShare = 0.75` for that tract.
- **Impact:** This is mathematically correct if the assignments are from the same operator assigning portions of the same WI. But in practice, a tract-scope assignment might overlap with a unit-scope assignment (same WI assigned twice). The system has no mechanism to detect or warn about overlapping assignment sources.
- **Fix:** Add a warning when `assignmentShare > 1.0` (already done — `overAssigned: assignmentShare.greaterThan(1)`). Consider adding an `assignmentBasis` field to clarify whether tract assignments are additive to or nested within unit assignments.

**L3. `leaseFractionForOwner` caps at owner fraction — partial lease on partial interest silently capped**
- **File:** `src/components/leasehold/leasehold-summary.ts:173-183`
- If a lease's `leasedInterest` exceeds the owner's current mineral `fraction`, it's silently capped to the owner fraction. This is correct behavior (you can't lease more than you own), but there's no warning or audit trail.
- **Impact:** If a deed reduces an owner's interest after a lease is already recorded, the leasehold summary silently reduces the leased coverage without alerting the user.
- **Fix:** Track whether the cap was triggered and surface it in the summary (e.g., `leasedInterestCapped: boolean` per owner).

**L4. Primary lease selection uses `pickPrimaryLease` — only one lease per owner counts**
- **File:** `src/components/leasehold/leasehold-summary.ts:204-215`
- Each owner can have multiple leases in the owner store, but only one "primary" lease participates in the leasehold math. The selection logic is in `pickPrimaryLease` (from `deskmap-coverage.ts`).
- **Impact:** If an owner has separate leases on different tracts (e.g., a NE/4 lease and a SE/4 lease), only the "primary" one is used for all tracts. This is wrong for multi-tract scenarios where different leases cover different tracts.
- **Fix:** The lease-to-tract association should be per-tract, not per-owner. Either allow linking a specific lease to a specific desk map, or allow multiple leases per owner with tract-level scoping.

**L5. Retained WI can go negative but is clamped to zero — over-assignment is visible but not prevented**
- **File:** `src/components/leasehold/leasehold-summary.ts:316-318, 367-370`
- When `assignmentShare > 1.0`, `retainedWorkingInterestDecimal` would be negative. It's clamped to `'0'`, and the tract is flagged `overAssigned: true`.
- The test at line 430 confirms: `totalAssignedWorkingInterestDecimal = 1.09375` and `retainedWorkingInterestDecimal = '0'`.
- **Impact:** The transfer order review shows a variance (`0.21875` in the test), but the user can still proceed. There's no block or escalation.
- **Fix:** This is appropriate for a professional tool (landmen need to see the problem, not be blocked). Consider adding a prominent visual indicator (red badge) on the Leasehold view when any tract is over-assigned.

**L6. Transfer order entries are orphan-prone**
- **File:** `src/store/workspace-store.ts:193-198, 224-229`
- When an assignment or ORRI is deleted, its associated `leaseholdTransferOrderEntry` is removed by matching `sourceRowId` prefix (`assignment-{id}` or `orri-{id}`). But if a desk map is deleted, the assignments/ORRIs scoped to that tract become stale — they still exist but their `deskMapId` no longer resolves.
- **Impact:** Phantom assignments/ORRIs that reference a deleted tract. They'll have `includedInMath: false` (since the tract is gone), so they won't affect calculations, but they pollute the list.
- **Fix:** When deleting a desk map, cascade-delete or flag tract-scoped assignments and ORRIs that reference it.

### 🔵 Info

**L7. The leasehold math is all Decimal.js — no float leaks**
- `buildLeaseholdUnitSummary` uses `d()` for every arithmetic operation. No raw `Number` math on ownership/royalty/WI values. This is correct and consistent with the engine pattern.

**L8. The test is thorough for the happy path**
- The single large test (lines 12-362) covers: multi-tract participation, weighted royalty, unit/tract ORRI, unit/tract assignments, decimal row generation, transfer order review with variance. The over-assignment test (lines 364-476) covers the edge case.
- **Missing tests:** No test for: empty tracts (zero owners), tracts with zero pooled acres, owners with no linked lease, NPRI nodes in the leasehold summary (currently filtered out by `!isNpriNode(node)`), and the NRI/WI burden basis computations (because they're not implemented).

**L9. Transfer order review variance calculation is correct**
- `varianceDecimal = totalDecimal - expectedDecimal` using absolute value. `expectedDecimal` is the unit/tract coverage fraction (participation × leased ownership). When all rows sum to coverage, variance is zero.

### Leasehold Coverage Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| NRI-basis and WI-basis ORRI math not implemented | 🔴 | Options exist in UI but contribute nothing |
| One lease per owner across all tracts | 🟡 | Wrong for multi-tract deals |
| No cascade cleanup on desk map deletion | 🟡 | Phantom assignments/ORRIs remain |
| No warning when lease cap is triggered | 🟡 | Silent reduction of leased coverage |
| No test for zero-owner tracts | 🔵 | Edge case |
| No test for NPRI interaction with leasehold | 🔵 | NPRI nodes filtered, but untested |
| No test for empty `leasedInterest` (defaults to owner fraction) | 🔵 | Logic at line 178-179, not explicitly tested |

---

## Architecture Notes

- **The v2 rewrite is clean.** No v1 code remains in the active source tree. The `.claude/worktrees/` directory contains v1 files as a Claude Code artifact, not shipped code.

- **The Decimal.js discipline is excellent.** 40-digit internal precision, 9-digit display, 24-digit storage — all configured in a single module (`src/engine/decimal.ts`). The only leaks are in `fraction-display.ts` (float fallback) and `csv-io.ts` (Number conversion).

- **The normalization-on-load pattern is the right call.** Every deserialization path runs through type-specific normalizers. This makes the system resilient to schema evolution and import from older formats without explicit migration code.

- **The ownership model correctly separates mineral and NPRI interest classes.** NPRI creation is a distinct operation from conveyance, preventing accidental cross-class transfers. The `allocatesAgainstParent` guard ensures NPRI interests don't reduce mineral remaining fractions.

- **State management is lean.** Zustand stores are well-scoped (workspace, canvas, owner, map, research, UI). No global re-render issues — the UI store only exposes the active view, and views subscribe to specific slices.
