# Phase 4 — Record-Bearing `.landroid` v9 Durable Format — Scope

Status: **DESIGN-FIRST, scoped 2026-06-02 (pair); updated 2026-06-04.** The v9
file format plus T2a/T2b runtime persistence are implemented: the live title
ledger now has Dexie storage, autosave flush, load hydrate, continue-chain, and
file-vs-Dexie precedence. T3 adds governed/default-off read-flip readiness, but
production enablement remains a separate reviewed decision. Tracks audit
backlog **ACT-H03** (live ledger not durable) and **DEF-ACT-04** (define the v9
package format); incorporates **DEF-ACT-03** (audit-chain scope) and flags
**ACT-M04** (snapshot growth).

Supersession note, 2026-06-04: this file records the v9 design decision made
under the earlier additive/snapshot-first posture. LANDroid now uses the
rebuild-first posture in `AGENTS.md` and `docs/rebuild-plan.md`: temporary branch
breakage is acceptable when changes are reversible and validated, and the title
read-flip is a near-term governed gate. The v9 file-format behavior below still
describes current import/export semantics, but "snapshot stays authoritative" and
"v9 does not read-flip" are no longer permanent architecture constraints.

Authority: `docs/project-record-migration-strategy.md` (write/import strategy +
required tests) and `docs/phase-4-action-layer-notes.md` (export gate already
built). Read those first; this doc only records the v9-specific decisions.

## Core stance

**v9 makes the title ledger _durable_, not _authoritative_.** It persists the
action/audit records alongside the existing v8 snapshot; the snapshot stays the
current source of truth on import. This decouples v9 from the read-flip: durable
persistence can ship, T3 can prove governed/default-off readiness, and production
enablement can still remain a separate reviewed decision. **v9 does not itself
flip reads.** The Zustand store / v8 snapshot remains canonical until that later
enablement PR explicitly changes it.

Evidence the ledger round-trips on real data: `scripts/title-soak.ts` ran
`ensureTitleBaseline` → `replay == adapter` (714/714) + math parity clean on the
real 250MB Springhill Dr. Elmore workspace (357 nodes), 2026-06-02. That proved
the title ActionRecords are self-sufficient; v9 makes them survive a round-trip.

## Already built (groundwork)

- `ACTION_LAYER_EXPORT_GATE` / `assertActionLayerExportAllowed` — v8 authoritative,
  records only in `v8+1`; throws for v8. (`action-layer/persistence.ts`)
- `appendActionLayerToRecordBundle` — additive bundle, verifies the audit chain,
  refuses a broken chain.
- `ProjectRecordBundleSchema` + `buildProjectRecordBundle` — the validator the
  migration strategy names. (`record-validation.ts`)
- Full-effect title records (recordEffects + node snapshots) — self-sufficient
  replay. Resolves action-layer-notes open question #2 for the title surface.
- Version rejection on import (`version > current` → throw) already exists.

## Decisions (2026-06-02)

| # | Decision | Choice |
|---|---|---|
| D1 | Records authoritative on import? | **No** — snapshot authoritative; records ride along as validated shadow. |
| D2 | Scope depth | **File format + runtime durability** (both halves of ACT-H03). |
| D3 | Audit-chain scope (DEF-ACT-03) | **Project-wide** (one chain per project, as built today). |
| D4 | Sequencing vs storage blockers | **LLA-H01/LLA-H02 landed; runtime is split into storage (T2a) and lifecycle (T2b).** |
| D5 | Snapshot growth (ACT-M04) | **Ship full-snapshot v9; measure; add compaction/checkpointing later.** Not pre-optimized. |

## A. v9 file format (build now — does NOT touch the Dexie storage layer)

**Envelope (additive).** Today's v8 payload is
`{ version, exportedAt, ...WorkspaceData, documentData, ownerData, mapData, researchData }`.
v9 adds exactly one key:

```
{ version: 9, exportedAt, ...all v8 keys byte-unchanged...,
  actionLedger: ProjectRecordBundle   // action_record[] + audit_event[], chain-verified
}
```

Key name is `actionLedger` — NOT `projectRecords` (already taken by the research
side-store) and unrelated to the Dexie schema version (also coincidentally "v9";
different namespace).

**Write path** (`exportLandroidFile`): when writing v9, build the bundle
(`buildProjectRecordsFromWorkspace` + `appendActionLayerToRecordBundle`),
validate with `ProjectRecordBundleSchema`, embed under `actionLedger`. v8 writer
unchanged; gate already blocks records-into-v8.

**Import dispatch (by version):**
1. Parse envelope; **reject `version > 9`** before any store touch.
2. Validate snapshot/side-stores through current **v8 normalizers** (unchanged).
3. If `actionLedger` present: validate with `ProjectRecordBundleSchema` **and**
   `verifyAuditChain`.
4. **Snapshot stays authoritative.** Optionally rebuild MathInputView from the
   ledger and compare (the soak's check at import time); divergence is surfaced,
   never read-from.
5. Replace side stores via the existing rollback-safe path.

**Rollback:** if `actionLedger` validation/chain-verify fails → drop the ledger,
load from the v8 snapshot, surface a warning. A bad ledger never blocks opening
the file.

**Forward compat:** v≤8 → load as today (no `actionLedger`); v9 → full path;
v>9 → reject.

## B. Runtime durability (T2a/T2b built; read flip still separate)

Models on the curative/owner side-store pattern. LLA-H01 and LLA-H02 have
landed, so runtime durability is no longer blocked. The implementation is split
into storage and lifecycle slices so the hydrate/precedence boundary stays
reviewable.

- **Storage (T2a):** Dexie v12 adds `titleActionRecords` and
  `titleAuditEvents`, storing backend-spine `action_record` and `audit_event`
  rows. Rows are scoped by `[dbKey+workspaceId]` using the LLA-H01 db-key helper
  contract. The stored `id`, `dbKey`, and `position` fields are Dexie metadata
  only; canonical `recordId`, `previousHash`, and `eventHash` values stay
  unchanged so T2b can hydrate and verify the same audit chain.
- **Reset (T2a):** workspace replacement clears the active db-key's title ledger
  rows through `workspace-side-store-reset.ts`. This matches shard reset
  behavior and prevents an imported or demo-loaded workspace from inheriting a
  stale ledger under the same browser profile. The in-memory
  `setTitleActionLogResetHook` remains the live-store reset boundary.
- **Write (T2b):** flush the live `useTitleActionLog` to Dexie after the existing
  `AUTOSAVE_DEBOUNCE_MS` (2s) workspace shard save succeeds. A save-generation
  guard skips the ledger flush if a newer workspace edit arrived while the
  async save was in flight. (Preferred over write-per-append.)
- **Hydrate on load (T2b):** Dexie has a ledger for the workspace → hydrate it and
  **continue the same audit chain from the persisted head hash** (tamper-evidence
  spans sessions). No ledger → fall back to lazy `ensureTitleBaseline`. Baseline
  = cold-start path; hydration = warm path, and the baseline mirror is flushed
  back to Dexie.
- **File ↔ Dexie coherence (T2b):** opening a `.landroid` is a workspace load → reset,
  then hydrate from the file's `actionLedger` (v9) or lazy-baseline (v8). The
  file path does not consult stale Dexie rows; it mirrors the file/baseline
  ledger back to Dexie. CSV/demo loads also baseline from the loaded workspace
  and mirror back. No merge/conflict logic — coherent by construction.

**Runtime persistence rollback / revert recipe:**

1. Before any destructive migration, export a `.landroid` backup and note the
   branch/commit being tested.
2. To revert the T2b lifecycle behavior while keeping the v12 schema, revert
   the lifecycle commit/PR. The app returns to T2a storage-only behavior; current
   workspace reads still come from the snapshot/Zustand store.
3. If a browser profile has opened Dexie v12 and a reverted v11 build cannot
   open `landroid-v2` because the IndexedDB version is newer, recover from the
   `.landroid` backup: delete the `landroid-v2` IndexedDB database for that
   browser profile, open the reverted build, and import the backup.
4. If staying on the v12 build and only ledger rows need to be purged, clear the
   `titleActionRecords` and `titleAuditEvents` object stores. The canonical
   title/math snapshot remains the recovery source until the separately
   reviewed read-flip is enabled.

## Build sequence (tickets)

1. **v9 file format** (A). Codex-able: synthetic fixtures, pure round-trip +
   rollback + version-dispatch tests. **Buildable now.**
2. **Dexie ledger tables + reset wiring** (B storage half / T2a). Codex-able
   with a clear spec.
3. **Autosave flush + hydrate/continue-chain** (B lifecycle half / T2b). Pair —
   touches live store lifecycle and file-vs-Dexie precedence.
4. **Governed read-flip readiness** (T3). Convert the existing hard-disabled
   read-path/cutover machinery to governed/default-off, prove test-only cutover
   and flip-to-shadow revert, and keep production enablement out of scope.

## Test plan

From the migration strategy + v9-specific cases:
- v8 import still works; v>9 rejected before any store touch.
- v9 export→import round-trip with `actionLedger`; chain re-verifies.
- Bundle-validation failure → snapshot loads, ledger dropped, warning surfaced.
- Serialization round trip for `action_record` + `audit_event`.
- MathInputView parity vs Phase 0 goldens after a v9 round trip.
- **`scripts/title-soak.ts` becomes a regression check**: after a v9 round-trip,
  `replay == adapter` + math parity must still hold.
- *(runtime storage / T2a)* Dexie schema/index tests; Alice/Bob db-key isolation;
  active-workspace reset clears only active-key ledger rows.
- *(runtime lifecycle / T2b)* persist→refresh→hydrate equals pre-refresh ledger;
  next mutation continues the chain; workspace swap clears rows; v9 file import
  hydrates from file ledger instead of stale Dexie rows.
- *(read-flip governance / T3)* MathInputView parity goldens; `.landroid`
  export-import-replay round trip; flag-ON synthetic equivalence between
  action-derived reads and store reads; divergence/parity/round-trip failures
  block eligibility; explicit flip-to-shadow revert proof.

## Open follow-ons (not blocking v9 file format)

- **ACT-M04** — snapshot growth/compaction; measure at W2 scale, decide
  full-snapshot vs math-relevant-field snapshot + checkpointing.
- **Production read-flip enablement** — T3 proves the governed/default-off path,
  but the actual production flip is still a separate reviewed decision. That PR
  must explicitly enable governance, keep `MathInputView` parity and `.landroid`
  round-trip green, show no live divergence/error, preserve audit-chain
  continuity, and document the exact flip-to-shadow revert.
