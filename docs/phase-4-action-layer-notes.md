# Phase 4 — Action Layer As Canonical Mutation Path (SHADOW) — Notes

Status: shadow build complete. The current Zustand stores remain canonical and
the reference for the entire run. NO live workflow was cut over. Hand back to
the reviewer for the cutover decision.

**Supersession note (2026-06-04).** This historical Phase 4 note describes the
original shadow run. T3 now converts the cutover mechanism from permanently
hard-disabled to governed/default-off: default production posture is still
shadow, but tests and a future reviewed PR can pass explicit governance to prove
or enable `candidate → cutover`. Runtime title-ledger persistence also landed in
T2a/T2b, so references to non-durable/in-memory title logs are historical unless
restated in newer docs.

Branch: `feat/phase-4-action-layer` (off `main`). Additive only; one existing
file touched (`src/project-records/index.ts`, a re-export).

## What shipped

A new shadow subsystem under `src/project-records/action-layer/`:

| Module | Role |
|---|---|
| `canonical-json.ts` | Deterministic, key-sorted JSON — the hashing substrate. |
| `commands.ts` | Typed command catalog across the 7 surfaces + `RecordEffect` (upsert/delete) + invariant-checked `parseActionCommand`. |
| `reducer.ts` | `reduceCommandLog` — the canonical-mutation primitive (pure fold of record effects). |
| `audit-chain.ts` | Append-only AuditEvent hash chain: build / append / verify / tamper-detection. |
| `action-records.ts` | `materializeImportApproval` (Phase 3 drafts → durable records) and `materializeCommandBatch`. |
| `encoders.ts` | Shadow translators: current store output → typed command log, per surface. |
| `parity.ts` | Per-workflow parity harness; `assertParityClean` throws on any divergence. |
| `cutover.ts` | Reversible, governed/default-off cutover mechanism; never flips production in this run. |
| `undo-boundary.ts` | Explicit undo/rollback boundary + AI-proposal gate guard. |
| `persistence.ts` | Additive, version-gated bundle inclusion; v8 stays authoritative. |

## Typed-command catalog

`commandKind` (surface): `title.create_root_node` / `title.convey` /
`title.create_npri` / `title.precede` / `title.graft_to_parent` /
`title.delete_node` / `title.attach_lease` (**title_tree**); `document.link` /
`document.unlink` (**document**); `owner.create` / `owner.update` (**owner**);
`lease.create` / `lease.update` (**lease**); `curative.create` /
`curative.update` / `curative.resolve` (**curative**); `import.apply_candidate`
(**import**); `ai.proposal` (**ai_proposal**).

Each command carries `recordEffects` (the record-level mutation), an explicit
`mutationBoundary: 'shadow_action_layer_no_live_store'`, and provenance
(`actionPlanId`, `sourceCitationIds`, `aiToolName`). `parseActionCommand`
enforces surface/kind coherence, AI-proposal tool naming, and record-type
ownership.

### Approved Phase 3 drafts → durable ActionRecords

`materializeImportApproval(ImportApprovalDraft)` consumes the exact Phase 3
output (`approveImportSessionCandidates`) and emits, per approved candidate, a
durable `action_record` (status `applied`, carrying targetRecordType/Id, input,
and the Phase 3 `sourceCitationIds`/`sourceRowIds`/`sourceExcerptIds`), plus a
hash-chained audit trail (`import_session.approved`, then one
`action_record.applied` per candidate). `recordsToAppend` bundles the approved
plan + action records + audit events + Phase 3 citation/anchor records — all
additive, `wouldMutateLiveStores: false`.

## AuditEvent hash chain

`eventHash_i = sha256(canonicalJson(event_i without eventHash))`;
`previousHash_i = eventHash_{i-1}`, anchored at
`AUDIT_GENESIS_HASH = sha256('landroid/action-layer/audit-genesis/v1')`. Because
`eventHash` covers the whole body (including `previousHash`), the chain is
tamper-evident. `verifyAuditChain` returns `{ valid, brokenAtIndex, reason }`.
Tests (`action-audit-chain.test.ts`) prove detection of: edited body, reorder,
dropped middle event, dropped first event, forged eventHash, and a re-signed
event (which still breaks the chain downstream). Append-only continuation from a
prior head hash is supported and tested.

## Parity harness

Per surface: encode the current store output (the `buildProjectRecordsFromWorkspace`
adapter records for that surface) as a typed command log, `reduceCommandLog`, and
diff the action-derived projection against the same store output.
`assertParityClean` throws a `ParityDivergenceError` on any missing/extra/changed
record — divergence is a bug, never a warning (guardrail 3).

- Covered workflows: `title_tree`, `document`, `owner`, `lease`, `curative`
  (each carries records in the fixture); `import` is covered separately via the
  Phase-3→durable path. `ai_proposal` owns no projected record type (runtime
  surface) and is covered by the gate guard, not record parity.
- `action-parity.test.ts` proves parity is CLEAN across all five record-bearing
  surfaces, that the partition loses no record (surface buckets + structural ==
  total), and that the harness has teeth (injected/dropped/corrupted records all
  diverge).

**Scope assumption (recorded):** Phase 4 parity proves the action layer can
represent and replay the current store's *projected record set* without loss,
duplication, or reordering — the precondition for cutover. Field-level mapping
(domain → record) remains owned by the already-tested adapter; in shadow the
action layer consumes that canonical projection rather than re-deriving it. This
keeps the shadow layer a ledger, not a second copy of the title engine (which
would add divergence risk against guardrail 3). Structural/derived records
(`project`, `workspace_manifest`, `tract`, `desk_map`, `unit`, `extraction_run`,
`packet*`) are not Phase 4 mutation surfaces and are explicitly out of scope.

## Undo / rollback boundary

- Action-layer undo unit = ONE `ActionRecord`. `undoActionRecord` is append-only:
  it returns a NEW `undone` ActionRecord (original untouched) plus an
  `action_record.undone` audit event that extends the chain. History is never
  rewritten; double-undo is refused.
- The LIVE-STORE rollback boundary is unchanged: the existing single-level AI
  `UndoSnapshot` (`AI_UNDO_SNAPSHOT_SECTIONS` = workspace/owner/curative/map/
  documents). The action layer delegates to it and never rolls live stores back.
- Every `ai.proposal` command must name a tool inside `HOSTED_BLOCKED_TOOL_NAMES`
  (`assertAIProposalCommandsRouteThroughGate`). Nothing bypasses the existing
  approval/undo/hosted gate.

## Cutover candidates (mechanism built, NOT flipped)

`CutoverRegistry` defaults every workflow to `shadow`; `shadow → candidate`
requires clean parity; `candidate → shadow` is reversible; `candidate → cutover`
requires a reviewer token plus explicit governance with live cutover enabled.
`LIVE_CUTOVER_DISABLED` remains `true` as the default runtime posture, so default
registries still throw `CutoverDisabledError`. No application call site flips a
workflow in production.

**Candidates reported (clean parity; reviewer decides the flip):** `title_tree`,
`document`, `owner`, `lease`, `curative`. Each has clean per-surface parity in
`action-parity.test.ts`. The deferred Phase 2 live-store cutover and any of the
above remain reviewer-gated.

## Persistence / export

`action_record` and `audit_event` are core record types, so they persist
additively in a `ProjectRecordBundle` and survive a serialize/reload round trip
(verified, including the hash chain). `appendActionLayerToRecordBundle` returns a
NEW validated bundle and refuses a broken chain. `ACTION_LAYER_EXPORT_GATE` keeps
the snapshot authoritative and gates record inclusion to explicit `v9+`
packages (`assertActionLayerExportAllowed` throws for v8). v9 writes only the
optional `actionLedger` bundle; no lossy/one-way format change.

## Existing files modified (behavior-preserving, shadow-only)

- `src/project-records/index.ts` — added `export * from './action-layer'`. Pure
  additive re-export; no existing export changed; nothing executes at import
  beyond module evaluation of additive pure code.

(The action layer imports read-only policy constants from `src/ai/tools.ts` and
`src/ai/undo-store.ts` — the same import pattern `ai-mutation-guard.ts` already
uses — but does not modify them.)

## Commands & results

- `npm run lint` (tsc --noEmit): clean.
- `npm run test` (full vitest suite): green, including Phase 0 goldens.
- New Phase 4 suites: `action-commands`, `action-audit-chain`, `action-records`,
  `action-parity`, `action-undo-boundary`, `action-cutover`, `action-persistence`.

## Open questions for the reviewer (non-blocking)

1. **Cutover order.** Which workflow (if any) should be cut over first? `owner`
   and `curative` are the lowest-risk (flat records, no cross-resolution);
   `title_tree` is highest value but has the most cross-references.
2. **Full-effect persistence at cutover.** In shadow, `ActionRecord.result`
   stores an effect *summary* (affected ids), not full record bodies. Cutover
   will need the log to be self-sufficient (persist full `recordEffects`) so a
   reload can replay without the store. Want that added now or at cutover time?
3. **Audit chain scope.** One chain per project is assumed. Do you want a
   per-workspace or per-surface chain instead before any cutover?
4. **Runtime ledger persistence.** `.landroid` v9 can carry a validated
   `actionLedger`, and T2a/T2b add refresh-time Dexie persistence, hydration,
   continue-chain, and file-vs-Dexie precedence. The ledger is durable shadow
   evidence, not the production read source.
5. **PII.** No `scripts/springhill/` or real `.landroid` data was touched;
   all fixtures are synthetic. Confirm that remains the rule through cutover.
