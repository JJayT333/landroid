# Title-tree read cutover

Status: Scope A delivered on `feat/title-tree-record-cutover` (in review). Scope B
(live Desk Map read-source move) is scoped and deferred below.

## Background

The rebuild treats the action/record layer becoming the canonical read source as a
near-term governed gate. The write path is already live and durable: every title
mutation journals through `useTitleActionLog` into a durable `ActionRecord` +
hash-chained `audit_event` (Dexie v12, `.landroid` v9), with baseline/hydrate,
divergence surfacing, and a kill switch. The read-flip machinery
(`action-layer/title-read-path.ts`, `title-cutover-gate.ts`, and the `titleReadPath`
hook on `evidence-vault.ts`) was built but inert: the math-parity and `.landroid`
round-trip gate inputs were never computed at runtime, and the banner's flip control
was permanently disabled.

## Scope A — what shipped

1. **Runtime readiness gates** (`action-layer/title-cutover-readiness.ts`).
   `computeTitleParityGates` recomputes the two heavy gate inputs off the live
   workspace + durable ledger: MathInputView parity (`runTitleMathParity`) and a real
   `.landroid` export → import → replay round trip, compared to the live adapter as an
   order-insensitive record set. `deriveTitleCutoverReadiness` composes the
   `TitleTreeCutoverGate` verdict. The status banner now shows the true gate state once
   the parity threshold is reached. Nothing is reimplemented — the math and the adapter
   stay authoritative.

2. **Real reversible flip** (`store/title-action-log.ts`,
   `components/shared/TitleLedgerStatusBanner.tsx`). A governed read-path mode holder
   (`readPathMode` + `flipToCutover`/`revertReadPathToShadow`) is enabled for the
   `title_tree` surface only; the global `DEFAULT_TITLE_READ_PATH_MODE` stays `shadow`.
   The flip requires green readiness gates and a non-empty reviewer token and is always
   reversible. The banner flips automatically on the rising edge of readiness
   (default-to-cutover-when-green), exposes a manual flip/revert control, and shows the
   live read mode. A workspace reset/hydrate returns the mode to shadow.

3. **Record-consumer seam** (`selectTitleReadPathInput` in `store/title-action-log.ts`).
   The single integration point that shapes the live mode + durable records for
   `buildProjectRecordsWithEvidenceVault`'s `titleReadPath`. No production records
   consumer exists yet (the projection is dormant), so this completes the
   reviewer-enabled seam without adding a dead caller.

### Invariant held

Only the per-tract slice scalars and node ownership feed the math, and the **live Desk
Map and math read from `useWorkspaceStore.nodes`** in every mode. Scope A changes only
the project-records read source, behind a reversible flip, with the gates proving the
ledger reconstructs title (records + MathInputView + `.landroid` round trip). Springhill
and the Phase 0 goldens are unaffected.

## Scope B — deferred follow-up

Route the live Desk Map / Leasehold ownership reads + the math through
`reconstructTitleNodes(replayTitleProjection(ledger))` instead of the store. This is the
true canonical-read-source end state and the highest-risk change in the rebuild, because
it **inverts the current divergence invariant**: today a diverged or in-flight mutation
is dropped from the ledger and the store stays canonical (safe because reads come from
the store); under Scope B, ledger-backed reads make divergence a data-loss-in-view risk,
so divergence must become a hard block/rollback rather than a surface. It also needs a
cached, deterministically ordered projection (open question: canonical replay order on
`appliedAt` + a monotonic sequence), reconciliation of store-owned desk-map membership
with ledger-owned node ownership, and a `deleteNode` undo boundary kept consistent.
Build it on Scope A's proven-green gate.

## Revert recipe

Runtime: `revertReadPathToShadow()` (banner control) returns the record read path to the
store immediately. Code: revert this branch, or leave the mode shadow — the Zustand store
stays canonical throughout, so no data migration is required.
