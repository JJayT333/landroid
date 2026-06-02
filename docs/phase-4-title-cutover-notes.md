# Phase 4 — Title-Tree Cutover (Option B, command-sourcing) — Notes

Status: cutover MECHANISM built and proven in shadow, **and the WRITE path is now
wired live** (recording-only). The current Zustand store stays canonical for all
READS and the engine stays the math authority. **No READ flip happened** —
`title_tree` stays `shadow`, the read path defaults to the store. Hand back to the
reviewer for the read-path flip.

Branch: `feat/phase-4-title-cutover` (off `feat/phase-4-action-layer`). Commit
range: see `git log feat/phase-4-action-layer..HEAD`. The first four commits are
additive-only (one existing file touched: `action-layer/index.ts`); a later
follow-up commit wires the live write-path journal (see "Live write-path wiring"
below), which touches `workspace-store.ts` and `main.tsx`.

## What this delivers (maps to the brief's required work)

| # | Required work | Where |
|---|---|---|
| 1 | Full-effect persistence + `replayTitleProjection` | `title-command-sourcing.ts` (rich `result`), `title-replay.ts` |
| 2 | Title command-sourcing wrapper (1 entry point, inline parity, gate) | `title-command-sourcing.ts`, `title-projection.ts` |
| 3 | Continuous parity gate (≥10 real mutations) | `title-cutover-gate.ts` |
| 4 | Flag-gated read path (default shadow) | `title-read-path.ts` |
| 5 | Math parity gate (MathInputView vs live + Phase 0 goldens) | `title-math-parity.ts` |
| 6 | Tests + rollback (parity, replay, reversibility, divergence, undo) | `__tests__/title-*.test.ts` |

## The command-sourcing wrapper — how a mutation becomes a durable record

`applyTitleMutation` is the single entry point around the seven title mutations
(`createRootNode`, `convey`, `createNpri`, `precede`, `graftToParent`,
`deleteNode`, `attachLease`). For each mutation it:

1. **Snapshots** the live workspace (`readWorkspace`).
2. **Performs** the mutation through the caller's thunk (`runMutation`) — the
   real store/engine does the math; this module never mutates the store.
3. **Re-snapshots** and runs the **canonical adapter** before vs after
   (`titleRecordsFromWorkspace` = `buildProjectRecordsFromWorkspace` filtered to
   `instrument_record` + `interest_reference`). The adapter stays the
   field-mapping authority — we never re-derive it.
4. **Diffs** the two title slices into record-level effects (`diffTitleMutation`):
   full `upsert` records for new/changed nodes, `delete` tombstones for removed
   ones, each aligned to the affected node's full snapshot.
5. **Builds** the typed command (`buildTitleCommand` → `parseActionCommand`).
6. **Checks parity INLINE and THROWS on divergence** (`assertTitleInlineParity`,
   guardrail 3) — see below.
7. **Materializes** a durable `action_record` + a hash-chained `audit_event`
   (`materializeTitleCommand`, reusing the Phase 4 chain).
8. **Routes AI-proposed mutations through the gate**
   (`assertTitleCommandRoutesThroughGate`): every title mutation maps to a tool
   inside `HOSTED_BLOCKED_TOOL_NAMES`, so nothing bypasses the existing
   approval/undo/hosted policy (guardrail 5).

### Full-effect (self-sufficient) persistence

Phase 4 open question #2 is resolved here. The adapter's title records are
**lossy for the math** — `buildMathInputView` reads `royaltyKind`,
`fixedRoyaltyBasis`, `linkedOwnerId`, and `type` from nodes, none of which the
`instrument_record`/`interest_reference` round-trip. So the durable
`ActionRecord.result` (freeform `z.record`, no contract change) carries **both**:

- `recordEffects` — the full title record bodies → replay to the title records
  (`replayTitleProjection`; test: `replay == adapter`), and
- `titleNodeSnapshots` — the full `OwnershipNode`s the engine produced → rebuild
  the math node set (`reconstructTitleNodes`).

The store/engine remains the producer of both; the action layer only records what
it produced. This keeps the layer a **ledger, not a second title engine** (the
Phase 4 scope principle), so it adds no divergence risk against guardrail 3.

## Inline parity proof (records AND math)

**Per-mutation record parity** (`assertTitleInlineParity`) runs two checks, both
of which must pass or recording throws `ParityDivergenceError`:

1. *Delta reproduces after*: replaying `before` + this command yields exactly the
   after title projection. A dropped or corrupted effect fails here — this is
   what **blocks** a bad mutation instead of shadowing it.
2. *Round-trip*: the after projection round-trips through encode→reduce with no
   loss (the standing surface invariant).

Proven against the **real store** for all seven mutations
(`title-command-sourcing.test.ts`): each produces a durable `action_record`
(correct `actionKind`) + `audit_event`, the full chain verifies, and the
accumulated log **replays to exactly the final adapter output** (records and
nodes).

**Math parity** (`title-math-parity.ts`, required by the migration strategy):
`MathInputView` built from the action-derived node set equals the live store's,
key by key (`runTitleMathParity` / `assertTitleMathParity`). Against the **Phase 0
Vulcan Mesa goldens** the reconstructed nodes reproduce the frozen
`demo.leasehold-decimals.json` `unitRows` + `transferOrderReview` (decimal/
fraction + lease allocation order), with `jurisdictionIsolation = passed` and
warning-only states intact. A tampered-live test proves the comparison has teeth.

## Reversible read-path flip (DEFAULT OFF) + revert

`selectTitleProjection({ mode, storeTitleRecords, actionRecords })` is the entire
switch: `shadow` returns the store projection, `cutover` returns
`replayTitleProjection(actionRecords)`. `DEFAULT_TITLE_READ_PATH_MODE = 'shadow'`,
the store keeps shadow-running in both modes, and the flip/revert is one flag
(`TitleReadPathFlag.cutOver()` / `.revertToShadow()`). `title-read-path.test.ts`
proves default-shadow, that the two modes return identical content while parity
holds, and that flip-then-revert is lossless. **No application call site
constructs `cutover` or calls `cutOver` in this run.**

## Continuous parity gate

`TitleTreeCutoverGate` (composes the Phase 4 `CutoverRegistry`, leaving the other
surfaces unchanged): `title_tree` cannot advance `shadow → candidate` until
`MIN_PASSED_TITLE_PARITIES = 10` real mutations have passed inline parity **and**
the math-parity gate is clean. `candidate → shadow` is always allowed
(reversible). `candidate → cutover` stays hard-blocked by
`LIVE_CUTOVER_DISABLED = true` (guardrail 2) — verified in the test.

## Undo / rollback boundary for title commands

`title-undo.ts` reuses the action layer's append-only `undoActionRecord`: a title
undo emits a new `undone` `action_record` + an `action_record.undone` audit event
that extends the chain (history is never rewritten; double-undo is refused). The
**live-store** rollback boundary is unchanged — the existing single-level AI
`UndoSnapshot` (workspace/owner/curative/map/documents). This matters for
`deleteNode`, whose live cascade is owned by the store and reverts via the
snapshot, not by replaying records. `title-undo.test.ts` covers append-only,
chain extension, double-undo refusal, and non-title refusal.

## Live write-path wiring (recording-only, follow-up step)

After the mechanism was proven, the reviewer authorized wiring it live. The live
WRITE path now records every successful title mutation as a durable ActionRecord;
the READ path is untouched (still the store). Design:

- **Single choke point.** Both the UI and the AI tools mutate the title tree
  through the seven `useWorkspaceStore` methods, so the journal is wired there
  (plus `batchAttachConveyance`, recorded as `graftToParent`). One hook captures
  everything.
- **Dependency-injected hook (no cycle).** `workspace-store.ts` exposes
  `setTitleJournalHook` and calls the hook fire-and-forget AFTER its canonical
  `set()`; it never imports the action layer. `src/store/title-action-log.ts`
  registers the hook at app startup (`main.tsx` side-effect import) and turns each
  mutation into a durable record via `recordTitleMutation`.
- **Canonical store is never affected.** The hook runs after `set()`, is wrapped
  so it cannot throw into the store, and recording is fire-and-forget + serialized
  (so the append-only chain threads its head hash even under rapid edits).
- **Divergence is surfaced, not swallowed (guardrail 3), and never rolls back.**
  On a parity divergence the recorder sets `lastDivergence` + `console.error`s and
  keeps the diverged record OUT of the ledger; the canonical store already
  committed and reads still come from it, so surfacing (not rollback) is correct.
- **Reversible.** `useTitleActionLog.setEnabled(false)` is a kill switch;
  removing the `main.tsx` import unregisters the hook entirely (prior behavior).
- **Provenance simplification (noted).** At the store choke point AI vs UI origin
  is not distinguishable, so live records are tagged `origin: 'user'`. The gate
  assertion still supports `origin: 'ai'` (tested in the wrapper); per-origin live
  tagging is a later refinement (see open question 1).
- **Scope (noted).** Only the seven typed mutations are journaled. Field-level
  edits (`updateNode`, `rebalance`, `clearLinked*`, `syncLeaseNodesFromRecord`)
  are not in the typed catalog and are intentionally not recorded — this is a
  structural-mutation ledger, not yet a complete node source-of-truth (which the
  READ-path cutover would require). See open question 6.

`src/store/__tests__/title-action-log.test.ts` drives the real store for all
seven mutations + a delete and asserts the ledger fills with a verified chain, the
store stays canonical, a forced divergence is surfaced without rollback, and the
kill switch works.

## Confirmation: NO read flip / NO cutover happened

- `LIVE_CUTOVER_DISABLED = true`; `title_tree` stays `shadow`.
- `DEFAULT_TITLE_READ_PATH_MODE = 'shadow'`; no call site sets `cutover`; reads
  still come from the store.
- The write-path journal is **recording-only** and reversible (kill switch /
  remove the startup import). The engine, adapter, and contracts are unmodified.

## Existing files modified

- `src/project-records/action-layer/index.ts` — additive barrel re-exports for the
  seven new `title-*` modules. Behavior-preserving (no existing export changed).
- `src/store/workspace-store.ts` — added `setTitleJournalHook` + a fire-and-forget
  `journalTitleMutation` call at the end of each successful title mutation.
  Behavior-preserving: the hook defaults to null, runs only after the canonical
  `set()`, and is wrapped so it can never alter the store's result or state.
- `src/main.tsx` — one side-effect import to register the journal hook at startup.
  Behavior-preserving: recording-only; reads and all existing flows unchanged.

PII rule held: `scripts/springhill/` and all real `.landroid` data were never
touched; every fixture is synthetic.

## Commands & results

- `npm run lint` (tsc --noEmit): clean.
- `npm run test` (full vitest suite): **811 passing / 115 files**, including the
  Phase 0 goldens, all Phase 4 action-layer suites, the 24 title-cutover tests
  (7 files), and the 3 live-journal tests.
- New suites: `title-command-sourcing`, `title-replay`, `title-divergence`,
  `title-math-parity`, `title-cutover-gate`, `title-read-path`, `title-undo`,
  `title-action-log` (live wiring).

## Open questions for the reviewer (batched, non-blocking)

1. **Read-path flip (the remaining headline call).** The write path now records
   live (recording-only); the read path is still the store. Flipping reads to the
   action-derived projection is the actual cutover. It is blocked until the ledger
   is a *complete* node source-of-truth (open question 6) and a full real-data
   parity soak is green. Also confirm the live divergence behavior is what you want
   (currently: surface + keep the record out of the ledger, never roll back the
   canonical store) and whether live records should distinguish AI vs UI origin
   (currently all `'user'` at the store choke point).
2. **Desk-map / leasehold scope at cutover.** Math parity holds the live desk
   maps + leasehold unit/assignments/orris fixed and only swaps the title node
   set, because those are not Phase 4 title surfaces. Confirm desk_map/unit stay
   store-owned until their own (later) cutover, so `interest_reference.deskMapIds`
   keeps sourcing from the store.
3. **Replay ordering.** `replayTitleProjection` / `reconstructTitleNodes` fold the
   ActionRecords in input (application) order. At cutover, what is the canonical
   persisted order — `appliedAt` + a monotonic sequence on the audit chain? (Ties
   on `appliedAt` are possible.)
4. **Node-snapshot persistence cost.** Each title command stores full node
   snapshots in `result`. That is the price of math self-sufficiency. Acceptable,
   or should the snapshot be trimmed to the math-relevant fields at the v9 format
   step (Phase 4 open question #4 names v9 but does not define it)?
5. **PII.** No `scripts/springhill/` or real `.landroid` data was touched; all
   fixtures synthetic. Confirm that remains the rule through cutover.
6. **Ledger completeness for the read flip.** The live journal records only the
   seven structural mutations. Field-level edits (`updateNode`, `rebalance`,
   `clearLinked*`, `syncLeaseNodesFromRecord`) are not in the typed command
   catalog, so the ledger is not yet a complete node source-of-truth — the read
   flip cannot be pulled until those are captured (either as new typed commands or
   as a generic `title.update` command). This is the natural next step after this
   one, and is the same boundary that motivates the eventual Option A reducer.
