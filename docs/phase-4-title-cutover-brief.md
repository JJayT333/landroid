# Brief: Title-Tree Cutover (Phase 4 cutover, Option B — command-sourcing)

> Self-contained handoff. The session that executes this starts cold — everything
> needed is here. Do NOT assume any prior conversation.

You are implementing the **title_tree workflow cutover** for LANDroid, using the
**command-sourcing** approach (Option B): the existing title engine keeps doing
the math; every title mutation is routed through a typed command that records the
result, writes a durable ActionRecord + audit event, and checks parity inline.
The action layer becomes the **entry point and ledger of record**; the engine
stays the **calculator behind it**. This is the reversible stepping stone toward
a future pure-reducer cutover (Option A), which is OUT of scope here.

When you finish, hand the branch back for review — do NOT merge. Commit in
reviewable chunks; do not leave work uncommitted.

## Where this sits
- Phase 4 ("Action Layer As Canonical Mutation Path") is built and in review as
  PR #97 (branch `feat/phase-4-action-layer`). It added a SHADOW action layer
  under `src/project-records/action-layer/`: a typed command catalog + reducer,
  an append-only AuditEvent hash chain, durable ActionRecords, a per-workflow
  parity harness, a reversible flag-gated cutover registry, an explicit
  undo/rollback boundary, and version-gated persistence. The current Zustand
  stores remain canonical.
- This brief executes the title_tree cutover that Phase 4 deliberately left to
  the reviewer. It is the highest-risk surface in the rebuild — the title tree
  feeds parties, desk maps, leases, fractions, and the math.

## Branch
Branch off `main` if PR #97 is merged; otherwise branch off
`feat/phase-4-action-layer`. New branch: `feat/phase-4-title-cutover`.
Do not commit to main. Do not open or merge a PR.

## READ FIRST
- `docs/phase-4-action-layer-notes.md` — Phase 4 design + the open questions.
- `src/project-records/action-layer/` — all of it, especially `commands.ts`,
  `reducer.ts`, `parity.ts`, `cutover.ts`, `action-records.ts`,
  `audit-chain.ts`, `persistence.ts`.
- `src/store/workspace-store.ts` — the title-tree store + the 7 mutations
  (createRootNode, convey, createNpri, precede, graftToParent, deleteNode,
  attachLease).
- `src/engine/` — the fraction/validation engine (the math authority; do NOT
  reimplement it).
- `src/project-records/workspace-record-adapter.ts` — node → instrument_record +
  interest_reference projection (the current store output parity compares to).
- `src/ai/undo-store.ts`, `src/ai/tools.ts` — the existing approval/undo/hosted
  gate the action layer routes through.
- `docs/project-record-migration-strategy.md` — v8 authoritative; MathInputView
  parity is a required gate before any cutover claim.

## Goal (verbatim)
Route every title-tree mutation through a typed command + durable ActionRecord +
audit event, with the engine still computing and the current store still
shadow-running, and prove parity (records AND math) per mutation — WITHOUT
flipping the live read path. Build the flip; stop before pulling it.

## Required work
1. **Full-effect persistence.** Make the command's `recordEffects` the
   self-sufficient source of title state: persist them (extend `ActionRecord` /
   add a command-log record) and add `replayTitleProjection(records)` that
   reduces persisted effects → the title records. Test: `replay == adapter` for
   a synthetic fixture.
2. **Title command-sourcing wrapper.** One entry point around the 7 title
   mutations: (a) call the existing store/engine mutation, (b) read back the
   affected node(s), (c) build the typed command with full `recordEffects`
   (instrument_record + interest_reference), (d) materialize the durable
   ActionRecord + audit event, (e) run `runSurfaceParity('title_tree', …)` inline
   and THROW on divergence (a mismatch blocks the mutation; it is never silently
   shadowed). Route through the existing approval/undo/hosted gate — nothing
   bypasses it.
3. **Continuous parity gate.** `CutoverRegistry` cannot advance title_tree to
   `candidate` until N (e.g. ≥10) real mutations have passed inline parity.
4. **Flag-gated read path.** A selector returns the store projection (shadow) or
   the action-derived projection (cutover); default shadow; store keeps
   shadow-running. The flip is one reversible flag.
5. **Math parity gate.** Compute `MathInputView` from the action-derived node set
   and compare to the live store AND the Phase 0 goldens (decimal/fraction,
   lease allocation order, warning-only states, jurisdiction isolation). No flip
   is even proposable until this is green.
6. **Tests + rollback.** Per-mutation parity, replay, flip-then-revert
   reversibility, and a deliberate-divergence test proving a bad mutation is
   BLOCKED, not silently shadowed.

## Exit gate
- Every title mutation produces a durable ActionRecord + audit event; the chain
  verifies.
- Inline record parity AND MathInputView parity are clean across all 7 mutations
  and the Phase 0 goldens.
- The read-path flip is implemented, flag-gated, reversible, and DEFAULT OFF.
- Undo/rollback boundary for title commands is defined + tested.

## Safety guardrails (carry from Phase 4)
1. CURRENT STORE STAYS CANONICAL until the reviewer flips the flag. The action
   layer runs alongside it; the engine remains the math authority.
2. NO LIVE FLIP IN THIS RUN. Build the read-path flip reversibly and prove
   parity, but leave `title_tree` in `shadow`/`candidate`. Report it as a cutover
   candidate with evidence; the reviewer pulls the switch.
3. PARITY DIVERGENCE = FAILURE. Any record or math mismatch is a bug. Resolve it
   or STOP and report — never ship a warning.
4. AUDIT HASH-CHAIN INTEGRITY. Reuse the Phase 4 chain; keep it append-only and
   tamper-evident.
5. EVERYTHING THROUGH THE GATE. Title commands (incl. any AI-proposed ones) route
   through the existing approval/undo/hosted-read-only policy. Nothing bypasses.
6. PERSISTENCE ADDITIVE + VERSION-GATED. v8 stays authoritative; record inclusion
   stays gated to a future explicit version per the migration doc.
7. NO PII. Never touch `scripts/springhill/` or any real `.landroid`; synthetic
   fixtures only.

## Deliver for review
Branch + commit range; the command-sourcing wrapper + how a mutation becomes a
durable record; the inline parity proof (records + math, with the Phase 0
goldens); the reversible read-path flip (default off) + revert test; the
undo/rollback boundary + test; confirmation NO live flip happened; every existing
file modified with one line on why it stays behavior-preserving until the flag is
flipped; `npm run lint` + `npm run test` results; a NOTES file
(`docs/phase-4-title-cutover-notes.md`) and one batched list of open questions.

Start by reading the files above, post a short plan, then implement behind the
flag autonomously per the guardrails. STOP at the flip (guardrail 2), an
unresolvable parity divergence (guardrail 3), or a true ambiguity.
