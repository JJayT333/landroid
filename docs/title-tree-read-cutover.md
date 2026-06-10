# Title-tree read cutover

Status: Scope A merged (PR #138). Scope B merged (PR #139, 2026-06-09).
2026-06-10 deep audit found Scope B's chokepoint claim incomplete — see
`docs/deep-audit-2026-06-10.md` DA-C1 (unjournaled `clearDeskMapNodes`/`deleteDeskMap`),
DA-H3 (rollback gaps), DA-H4/H5 (durability/tamper coverage); hardening lane is first
in `ROADMAP.md`.

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

## Scope B — delivered (ledger-authoritative live reads)

Scope B makes the ledger authoritative for what the live UI shows, without rewriting any
screen. Two facts made a per-consumer rewrite unnecessary: (1) when a mutation passes its
parity check the store **already equals** what the ledger records (the ledger's
`titleNodeSnapshots` are the engine's own output), so the store can only drift from the
ledger on a mutation that *fails* the check; and (2) `assertTitleInlineParity` is
synchronous and every title mutation flows through one chokepoint, `journalTitleMutation`.

So Scope B is a single rule: **in cutover, if a mutation fails the synchronous parity
check, roll the store back to the pre-mutation snapshot** (`restoreTitleSlice`,
`store/workspace-store.ts`) so the store never holds state the ledger rejected, and keep
the diverged record out of the ledger. The check is factored as `checkTitleInlineParity`
(`action-layer/title-command-sourcing.ts`, no new math, no async); the rollback is wired
in the title journal hook (`store/title-action-log.ts`) for cutover only. The store thus
stays provably equal to the ledger projection, every existing screen reads it unchanged,
and the ledger has veto power. **Shadow mode is untouched** (divergence surfaced, store
stays canonical); the flip stays default-off and reversible via `revertReadPathToShadow()`.

This deliberately did **not** add a cached/ordered projection, per-consumer selector, or
re-derive-on-render — none are needed while the store is kept equal to the ledger by
rollback. Remaining minor follow-up: the sync check recomputes records the async recorder
also builds; a cached projection only becomes relevant if reads ever move off the store.

## Scope B hardening (deep audit 2026-06-10, branch feat/scope-b-hardening)

The audit found the chokepoint claim was false and the rollback leaky; both are now
enforced in CI:

- **Journal coverage is a test, not prose.** Every workspace-store action whose execution
  changes the title slice must fire the journal hook
  (`src/store/__tests__/title-journal-coverage.test.ts`, with a completeness guard over
  every store action). That gate forced journaling onto eight previously-silent
  title-visible mutations: `clearDeskMapNodes`, `deleteDeskMap`, `createDeskMap` (via
  `initialNodeIds`), `addNodeToDeskMap`, `addNodeToActiveDeskMap` (desk-map membership is
  `interest_reference.deskMapIds`), and `attachDocToNode`/`detachDocFromNode`/
  `reorderNodeAttachments` (`attachments[0].docId` is `instrument_record.documentId`).
- **The journal hook returns a verdict** (`{rolledBack}`): vetoed mutators report failure
  (false/null/ok:false) and skip their destructive cascades, a parity check that throws
  rolls back (unverified state never stands), and hook exceptions surface as `lastError`
  instead of being swallowed. The diverged-`deleteNode` cascade gap is closed.
- **The flip no longer self-arms.** `cutoverEnabled` defaults to false; the banner's
  auto-flip is gone. ARMED at boot (`main.tsx` calls `setTitleCutoverArmed(true)`) by
  operator decision on 2026-06-10 after the Springhill soak of the merged hardening.
  Arming only permits the flip — it still requires green readiness gates plus the
  banner's explicit manual click, and `revertReadPathToShadow()` is always available.
  Disarming is deleting the one boot call.
- **AI undo hydrates-then-appends** (`src/ai/undo-ledger.ts`): the persisted chain is
  re-hydrated after the snapshot restore and the turn's records are marked `undone`
  append-only on the audit chain (`undoTitleActionRecord` now has its live caller);
  `importAndOpenWorkspace` owns ledger hydration for imports. Ledger writes are fenced
  behind the write lease and reader-tab hydration is memory-only.

## Revert recipe

Runtime: `revertReadPathToShadow()` (banner control) returns the record read path to the
store immediately. Code: revert this branch, or leave the mode shadow — the Zustand store
stays canonical throughout, so no data migration is required.
