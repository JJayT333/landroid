# Phase 4 — Title-Tree Cutover (Option B, command-sourcing) — Notes

Status: cutover MECHANISM built and proven in shadow. The current Zustand store
stays canonical and the engine stays the math authority. **No live workflow was
flipped** — `title_tree` remains `shadow`, the read path defaults to the store,
and no live call site was rewired. Hand back to the reviewer for the flip.

Branch: `feat/phase-4-title-cutover` (off `feat/phase-4-action-layer`).
Additive only; **one** existing file touched (`action-layer/index.ts`, a
re-export). Commit range: see `git log feat/phase-4-action-layer..HEAD`
(impl → tests → docs).

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

## Confirmation: NO live flip happened

- `LIVE_CUTOVER_DISABLED = true`; `title_tree` stays `shadow`.
- `DEFAULT_TITLE_READ_PATH_MODE = 'shadow'`; no call site sets `cutover`.
- The live store, AI tools, engine, adapter, and contracts are **unmodified**
  (`git diff --name-only` shows only `action-layer/index.ts`).
- The wrapper is proven end-to-end by driving the real store in tests, but the
  live AI-tool/UI call sites still call the store directly — **rewiring the live
  write path is the reviewer's flip**, the same class of decision as the read-path
  flip (see open question 1).

## Existing files modified (behavior-preserving)

- `src/project-records/action-layer/index.ts` — added re-exports for the seven
  new `title-*` modules. Pure additive barrel change; no existing export altered,
  nothing executes at import beyond module evaluation of additive pure code (the
  barrel already pulled `ai/tools` via `undo-boundary`, so no new side effect).

No other existing file changed. PII rule held: `scripts/springhill/` and all real
`.landroid` data were never touched; every fixture is synthetic.

## Commands & results

- `npm run lint` (tsc --noEmit): clean.
- `npm run test` (full vitest suite): **807 passing / 114 files**, including the
  Phase 0 goldens, all Phase 4 action-layer suites, and the 23 new title-cutover
  tests across 7 files.
- New suites: `title-command-sourcing`, `title-replay`, `title-divergence`,
  `title-math-parity`, `title-cutover-gate`, `title-read-path`, `title-undo`.

## Open questions for the reviewer (batched, non-blocking)

1. **Live write-path wiring (the headline call).** The wrapper is built and
   proven against the real store, but the live AI tools / UI still call
   `useWorkspaceStore` directly. Wiring `applyTitleMutation` into those call sites
   makes "every live title mutation produces a durable record" literally true —
   but it inserts an async, throw-on-divergence step into the (today synchronous)
   store mutations, which is a live behavior change. Guardrails 1 & 2 ("store
   stays canonical", "build the flip; stop before pulling it") pointed me to
   **build + prove, don't rewire**. Confirm you want the write-path wiring done as
   the cutover step (and whether it should block the live mutation on divergence,
   or record-and-alert).
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
