# Audit Remediation Plan

This note merges:

- the repo audit performed in-chat
- the newer `AUDIT_REPORT.md`

Severity below reflects what should be fixed first for correctness and data
integrity, not which issue is easiest.

## Severity Scale

- `P0`
  - Silent math corruption or invalid state that can survive validation
- `P1`
  - High-risk correctness, import, or user-data integrity problems
- `P2`
  - Important but more localized correctness, transparency, or resilience work
- `P3`
  - Lower-risk polish, hardening, or build hygiene

## Accepted Fixes

### P0. Refund the source parent during attach-conveyance

Status:

- verified locally

Files:

- `src/engine/math-engine.ts`
- `src/engine/__tests__/math-engine.test.ts`

Problem:

- `executeAttachConveyance` debits the destination parent and rescales the moved
  branch, but it never restores the detached branch amount to the old parent.
- This leaks value out of the source branch and leaves the graph under-allocated.

Fix:

- capture the original parent before reparenting
- if the move allocates against the old parent, add the moved branch's
  `initialFraction` back to that old parent's remaining `fraction`
- keep the destination debit and subtree rescale logic
- validate the final graph after both sides are updated

Tests to add:

- moving a child from one mineral root to another restores the exact detached
  amount to the source parent
- moving a multi-level subtree preserves same-class branch totals on both source
  and destination sides

### P0. Make graph validation catch under-allocation, not just over-allocation

Status:

- verified locally

Files:

- `src/engine/math-engine.ts`
- `src/engine/__tests__/math-engine.test.ts`

Problem:

- `validateOwnershipGraph` currently flags `allocated > initial` but not
  `allocated < initial`
- this allows leaked branch value to pass as valid

Fix:

- compare `allocated - initial` in both directions against epsilon
- emit separate issue codes for `over_allocated_branch` and
  `under_allocated_branch`
- keep serialized details for `initial`, `remaining`, `childInitialTotal`, and
  `allocated`

Tests to add:

- explicit under-allocated branch rejected
- attach-regression graph fails validation before the engine fix and passes after
  the engine fix

### P1. Reject malformed ownership graphs on import and load

Status:

- verified locally for `.landroid` import

Files:

- `src/storage/workspace-persistence.ts`
- `src/types/node.ts`
- `src/storage/__tests__/workspace-persistence.test.ts`

Problem:

- `.landroid` import currently normalizes shape but does not enforce graph
  invariants strongly enough
- a payload with a cycle and a negative fraction can make it through import
- IndexedDB load also trusts normalized nodes without revalidating the graph

Fix:

- strengthen runtime node normalization for numeric/text fields
- run `validateOwnershipGraph` after import and after DB load
- reject or quarantine bad payloads instead of promoting them into store state
- distinguish schema errors from graph-integrity errors in the thrown message

Tests to add:

- import rejects negative fractions
- import rejects cycles
- import rejects missing parents
- load path surfaces invalid persisted graph as corrupt, not valid

### P1. Distinguish missing autosave from corrupt autosave

Files:

- `src/storage/workspace-persistence.ts`
- `src/storage/canvas-persistence.ts`
- `src/main.tsx`
- UI surface for recovery/error messaging

Problem:

- parse failure currently behaves like "no saved workspace"
- that can silently boot the app into a blank workspace and later overwrite the
  corrupt state

Fix:

- return a typed load result such as:
  - `missing`
  - `loaded`
  - `corrupt`
- gate app initialization on that result
- show a recovery message before any fresh autosave can replace the bad record

Tests to add:

- corrupt workspace payload yields `corrupt`, not `null`
- app startup does not overwrite corrupt saved state without user action

### P1. Align ORRI burden-basis UI with actual math

Status:

- fixed in the current branch

Files:

- `src/types/leasehold.ts`
- `src/components/leasehold/leasehold-summary.ts`
- leasehold UI that exposes burden-basis choices
- `src/components/leasehold/__tests__/leasehold-summary.test.ts`

Resolved:

- the UI/type model and the tract/unit math now both support:
  - `gross_8_8`
  - `net_revenue_interest`
  - `working_interest`

Applied fix:

- implemented basis-aware ORRI math for all three declared burden bases
- updated tract/unit summaries and ORRI decimal rows to use the selected basis

Tests added:

- supported burden bases now produce deterministic tract and unit decimals

### P1. Replace the single-primary-lease simplification or enforce it explicitly

Status:

- fixed in the current branch

Files:

- `src/components/deskmap/deskmap-coverage.ts`
- `src/components/leasehold/leasehold-summary.ts`
- lease data entry UI
- related tests

Resolved:

- Desk Map coverage, Leasehold summaries, and royalty decimal rows now aggregate
  multiple active leases per owner instead of collapsing to one record

Applied fix:

1. active leases are aggregated by owner
2. leased fractions are allocated in effective-date order and capped at the
   owner's current fraction
3. owner tract royalty and unit royalty decimal now sum all active lease slices

Tests added:

- owner with two active leases now summarizes deterministically

### P2. Preserve precision in CSV import

Files:

- `src/storage/csv-io.ts`
- `src/storage/__tests__/csv-io.test.ts`

Problem:

- CSV fractions are routed through `Number(...)` and `toFixed(9)`
- this can permanently round or flatten precise source values during import

Fix:

- parse decimal strings directly instead of coercing through `Number`
- preserve source precision as string input to the decimal layer
- normalize only at the display/serialization boundary that truly needs it

Tests to add:

- high-precision CSV fractions round-trip without unintended truncation
- scientific notation or malformed numeric text is rejected clearly

### P2. Clarify or correct the tract-acre basis used for `netMineralAcres`

Status:

- fixed in the current branch

Files:

- `src/components/leasehold/leasehold-summary.ts`
- leasehold UI labels/tests

Resolved:

- gross-acre `netMineralAcres` and pooled-acre `netPooledAcres` are now both
  computed and surfaced explicitly

Applied fix:

1. compute tract NMA from gross acres
2. compute pooled-acre participation separately
3. show both labels in the tract owner table

### P2. Add an application error boundary and failure surfaces

Status:

- fixed in the current branch

Files:

- `src/App.tsx`
- new boundary component
- any startup/import failure surfaces

Resolved:

- render or lazy-load failures now land on a root fallback screen with a reload
  action and visible error details

Applied fix:

- added a root error boundary around the application shell
- added a user-facing fallback with reload guidance and technical details

Tests added:

- fallback rendering and boundary error-state behavior are covered

### P3. Avoid precision loss in rare fraction-display fallback cases

Files:

- `src/engine/fraction-display.ts`
- `src/engine/__tests__/fraction-display.test.ts`

Problem:

- `formatAsFraction` uses the exact BigInt path first, but its fallback converts
  to `number`
- extremely precise values above the exact-path threshold can lose display
  fidelity

Fix:

- keep the exact path
- replace the floating-point fallback with a string/Decimal-friendly rational
  approximation path when possible

### P3. Build hygiene follow-up

Files:

- Tailwind content configuration
- docs/examples that contain bracket-heavy text
- bundle-splitting follow-up for `FlowchartView`

Status:

- the recurring Tailwind Markdown-scan warning is fixed
- the recurring large `FlowchartView` chunk warning is fixed

Remaining follow-up:

- keep repo docs excluded from Tailwind scanning so bracket-heavy audit text does
  not reintroduce warnings
- revisit lazy chunk size only if future flowchart work grows meaningfully again

Fix already applied:

- exclude repo Markdown docs from Tailwind scanning
- split `FlowchartView` dependencies so React Flow and ELK do not land as one
  oversized lazy chunk

## Findings From `AUDIT_REPORT.md` I Accept

- CSV precision loss on import
- missing application error boundary
- ORRI burden-basis mismatch between UI/options and implemented math
- single-primary-lease limitation
- fraction-display fallback as a lower-severity precision/display issue

## Findings From `AUDIT_REPORT.md` I Reject Or Downgrade

### Rejected: desk-map delete leaves phantom assignments or ORRIs behind

Reason:

- current delete flow removes tract-scoped assignments and ORRIs when the desk
  map is deleted
- this did not reproduce as a valid finding in the current code

### Downgraded: fraction-display issue is critical

Reason:

- the exact BigInt path runs first
- the risk is real but localized to fallback display behavior, not core branch
  math

## Fix Order

Recommended implementation order:

1. attach refund bug
2. under-allocation validator
3. import/load graph validation
4. corrupt-autosave recovery path
5. ORRI burden-basis decision
6. multi-lease decision
7. CSV precision
8. acre-basis terminology cleanup
9. error boundary
10. lower-risk hardening

## Minimum Regression Suite To Add

- attach move restores source-parent remaining fraction
- under-allocated graph is invalid
- import rejects cycle / negative / missing-parent graph
- corrupt autosave is surfaced as corrupt, not missing
- ORRI basis coverage for every supported basis
- multiple active leases per owner behave according to the chosen product rule
- CSV high-precision fractions round-trip safely

## Bottom Line

The repo is not in bad shape structurally, but the first fixes should be about
preserving fractional truth.

If the branch math can silently leak value, every downstream acreage, royalty,
ORRI, WI, and transfer-order number becomes suspect.
