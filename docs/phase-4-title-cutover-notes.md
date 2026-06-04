# Phase 4 — Title-Tree Cutover (Option B, command-sourcing) — Notes

Status: cutover MECHANISM built and proven in shadow; the WRITE path is wired
live (recording-only); and the READ-path flip is wired into the one live record
consumer (evidence-vault), default shadow + reversible.

**Supersession note (2026-06-04).** This file was written under the earlier
additive/snapshot-first posture. LANDroid now uses the rebuild-first posture in
`AGENTS.md` and `docs/rebuild-plan.md`: temporary branch breakage is acceptable
when changes are reversible and validated, and the title read-flip is a
near-term governed gate. The "no live read flip," "never flipped," and
`LIVE_CUTOVER_DISABLED = true` statements below remain accurate historical
status for this Phase 4 shadow branch, but they are no longer permanent
constraints for new work. T3 converts the existing machinery into a
governed/default-off flip path; production enablement remains a separate
reviewed decision after persistence, parity, round-trip, divergence, and revert
gates are green.

**Scope / accuracy note (post 2026-06-02 Codex audit).** The live ledger is
**in-memory shadow instrumentation** held in a Zustand store. The ActionRecords
are durable-*class* (schema-valid) but are **not yet persisted** to Dexie,
`.landroid`, or a record bundle (ACT-H03). It captures title mutations made
**in-session from an empty baseline**; it does **not** yet snapshot a
loaded/imported workspace's pre-existing nodes (ACT-H01) and is **not** reset on
workspace switch (ACT-H04). So it is a faithful *in-session* shadow — **not** yet
a durable or complete read source. Treat any "durable" / "complete
source-of-truth" wording elsewhere in this doc as aspirational until ACT-H01/H03/
H04 land. Full gap list + ownership is in `docs/audit-backlog.md` (ACT-H01…ACT-L01):
the Codex cleanup batch takes ACT-H02/H04/M03/L01; ACT-H01/H03/H05/M01/M02/M04 are
paired (baseline, durable persistence/v9, divergence UX, provenance, ordering).

The Zustand store stays canonical for all reads and the engine stays the math
authority. **No live read flip is enabled** — every read path defaults to the
store; no call site sets `cutover`. Hand back for the durability/baseline/reset
fixes + a real-data soak before enabling the read flip.

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

`applyTitleMutation` is the single entry point around the typed title mutations
(`createRootNode`, `convey`, `createNpri`, `precede`, `graftToParent`,
`deleteNode`, `attachLease`, `update`). For each mutation it:

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
- **Scope (at this step).** When this step landed, only the seven structural
  mutations were journaled. The next step ("Ledger completeness") added field
  edits via `title.update`, so field edits ARE now recorded. (Even so, the ledger
  remains in-session and in-memory — see the Status note and ACT-H01/H03/H04.)

`src/store/__tests__/title-action-log.test.ts` drives the real store for all
seven mutations + a delete and asserts the ledger fills with a verified chain, the
store stays canonical, a forced divergence is surfaced without rollback, and the
kill switch works.

## Ledger completeness + read-path flip at the consumer (follow-up step)

After the live write path landed, two more steps broadened ledger coverage to
field edits and wired the read flip at the real consumer. Coverage is now complete
for *in-session* mutations; it is **not** complete across a load/import or a
workspace switch, and it is in-memory only — see the Status note and ACT-H01/H03/
H04.

**Ledger completeness (`title.update`).** The seven structural mutations weren't
enough — the app also edits node fields via `updateNode`, `rebalance`,
`clearLinkedOwner`, `clearLinkedLease`, and `syncLeaseNodesFromRecord`, which
change a node's projected records. A new generic `title.update` command kind now
captures these. `updateNode` is committed (NodeEditModal holds local form state and
only writes on Save), so journaling per call does not flood the ledger; a no-op
edit (no projected change) produces zero effects and is skipped. The completeness
proof: after a structural mutation **and** a field edit through the real store,
`replayTitleProjection(ledger)` equals the live adapter projection
(`title-action-log.test.ts`).

**Read flip at evidence-vault.** Title records are read in exactly one place,
`buildProjectRecordsWithEvidenceVault`. It now takes an optional
`titleReadPath?: { mode, actionRecords }`: default/`shadow` sources title records
from the adapter (unchanged); `cutover` replays the durable ledger and splices
those title records in, leaving every other record untouched. The flip is
reversible by `mode` alone, and `title-read-flip.test.ts` proves shadow == omitted,
cutover is domain-faithful to shadow when the ledger is complete, and
shadow→cutover→shadow round-trips. `buildProjectRecordsWithEvidenceVault` has no
live caller yet, so this is the read flip *built and wired at the consumer*, still
default-off — the reviewer enables it.

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
- `src/project-records/action-layer/commands.ts` — added the `title.update`
  command kind + its surface mapping. Additive; no existing kind changed.
- `src/project-records/evidence-vault.ts` — added an optional `titleReadPath`
  input and a guarded splice. Behavior-preserving: omitted/`shadow` is the prior
  behavior exactly; only an explicit `cutover` opt-in changes the title source.

PII rule held: `scripts/springhill/` and all real `.landroid` data were never
touched; every fixture is synthetic.

## Commands & results

- `npm run lint` (tsc --noEmit): clean.
- `npm run test` (full vitest suite): **816 passing / 116 files**, including the
  Phase 0 goldens, all Phase 4 action-layer suites, the title-cutover suites, the
  live-journal suite (incl. the completeness proof), and the read-flip suite.
- New suites: `title-command-sourcing`, `title-replay`, `title-divergence`,
  `title-math-parity`, `title-cutover-gate`, `title-read-path`, `title-undo`,
  `title-action-log` (live wiring + completeness), `title-read-flip` (consumer).

## Open questions for the reviewer (batched, non-blocking)

1. **Enabling the read flip (the remaining headline call).** The read flip is now
   built and wired at the one consumer (`evidence-vault`), default shadow. To
   ENABLE it live, a caller passes `titleReadPath: { mode: 'cutover', actionRecords }`
   from `useTitleActionLog`. Two things to settle first: (a) the live ledger is
   eventually-consistent (fire-and-forget), so a `cutover` read must `await
   settleTitleActionLog()` to avoid reading a stale projection — wire that into the
   caller; (b) a real-data parity soak (the 50–500MB import workflow) should run
   green before flipping. Also confirm the live divergence behavior (surface +
   keep out of ledger, never roll back) and whether live records should carry AI
   vs UI origin (currently all `'user'` at the store choke point).
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
6. **Ledger completeness — PARTIAL (not DONE).** Field-level edits (`updateNode`,
   `rebalance`, `clearLinked*`, `syncLeaseNodesFromRecord`) are now captured as
   `title.update` commands, so *in-session* mutations replay faithfully (replay ==
   adapter after a field edit). But the 2026-06-02 audit correctly flags that full
   completeness is not reached: a loaded/imported workspace's pre-existing nodes
   are not captured (ACT-H01), the log is not reset on workspace switch (ACT-H04),
   and it is in-memory only (ACT-H03). Those three (plus replay failing closed,
   ACT-H02) must land before the ledger is a complete or durable read source.
   Separately, if you later want field-level provenance (which field changed, by
   whom) that is a richer `title.update` payload — not required for cutover parity.
