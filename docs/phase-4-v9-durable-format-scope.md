# Phase 4 — Record-Bearing `.landroid` v9 Durable Format — Scope

Status: **DESIGN-FIRST, scoped 2026-06-02 (pair).** No code written yet. This
captures the decisions so the build can be split into tickets. Tracks audit
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
source of truth on import. This decouples v9 from the read-flip — durable
persistence can ship now while the read-flip stays gated behind ACT-H05 and an
explicit later decision. **v9 ≠ read-flip.** Honors the no-read-flip guardrail
(the Zustand store / v8 snapshot remains canonical).

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
| D4 | Sequencing vs storage blockers | **File format now; runtime deferred behind LLA-H01 (isolation) + LLA-H02 (write fence).** |
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

## B. Runtime durability (DEFERRED behind LLA-H01 + LLA-H02 — see D4)

Models on the curative/owner side-store pattern (Dexie, `workspaceId`-keyed, 2s
autosave debounce). Recorded here so it isn't re-derived later:

- **Storage:** new Dexie tables `action_records` + `audit_events` (one
  `db.version()` bump), keyed by `workspaceId` — same scoping as existing
  side-stores, so it inherits (does not worsen) the LLA-H01 isolation posture.
- **Write:** flush the live `useTitleActionLog` to Dexie on the existing
  `AUTOSAVE_DEBOUNCE_MS` (2s). Snapshot authoritative ⇒ ≤2s of shadow-ledger
  loss on a hard crash is harmless. (Preferred over write-per-append.)
- **Hydrate on load:** Dexie has a ledger for the workspace → hydrate it and
  **continue the same audit chain from the persisted head hash** (tamper-evidence
  spans sessions). No ledger → fall back to lazy `ensureTitleBaseline`. Baseline
  = cold-start path; hydration = warm path.
- **Reset:** extend `setTitleActionLogResetHook` to also delete the workspace's
  ledger rows + bump the generation guard, so a workspace swap can't leak a
  stale chain.
- **File ↔ Dexie coherence:** opening a `.landroid` is a workspace load → reset,
  then hydrate from the file's `actionLedger` (v9) or lazy-baseline (v8). The
  Dexie table always mirrors the live ledger. No merge/conflict logic — coherent
  by construction.

## Build sequence (tickets)

1. **v9 file format** (A). Codex-able: synthetic fixtures, pure round-trip +
   rollback + version-dispatch tests. **Buildable now.**
2. *(after LLA-H01/H02)* **Dexie ledger tables + reset wiring** (B storage half).
   Codex-able with a clear spec.
3. *(after 2)* **Autosave flush + hydrate/continue-chain** (B lifecycle half).
   Pair — touches live store lifecycle.

## Test plan

From the migration strategy + v9-specific cases:
- v8 import still works; v>9 rejected before any store touch.
- v9 export→import round-trip with `actionLedger`; chain re-verifies.
- Bundle-validation failure → snapshot loads, ledger dropped, warning surfaced.
- Serialization round trip for `action_record` + `audit_event`.
- MathInputView parity vs Phase 0 goldens after a v9 round trip.
- **`scripts/title-soak.ts` becomes a regression check**: after a v9 round-trip,
  `replay == adapter` + math parity must still hold.
- *(runtime, deferred)* persist→refresh→hydrate equals pre-refresh ledger; next
  mutation continues the chain; workspace swap clears rows.

## Open follow-ons (not blocking v9 file format)

- **ACT-M04** — snapshot growth/compaction; measure at W2 scale, decide
  full-snapshot vs math-relevant-field snapshot + checkpointing.
- **LLA-H01 / LLA-H02** — prerequisites for runtime durability (D4).
- **ACT-H05** — visible divergence UX; independent gate, still required before a
  read-flip is proposable.
- **Rebuild-first read-flip governance** — after runtime ledger persistence,
  `MathInputView` parity, `.landroid` round-trip, divergence, and revert gates
  are green, the existing read-flip machinery may become governed/default-off
  rather than permanently deferred.
