# Step 2 hardening — parked execution plan (DA-H7 part 3, DA-H10, DA-M16)

Parked 2026-06-12. Source: `docs/deep-audit-2026-06-10.md` findings, design
session of 2026-06-11. This document is a self-contained execution prompt —
hand it to any executor (Claude or Codex) one lane at a time.

> **Amended 2026-06-12:** PR #153 (open at amend time) shipped most of DA-H7 —
> import re-hash with a startup fixity warning (`documentFixityWarning` →
> `setStartupWarning`), silent heal of blank hashes, and export re-hash. Lane A
> below is reduced to what #153's own PR body defers: the one-time `''`
> backfill, plus two small test riders #153 didn't add. Branch Lane A only
> after #153 lands on main.

## How to execute

- **One branch + one PR per lane**, branched from fresh `main`. The operator
  merges every PR; never self-merge.
- Gate before every PR: `npm run lint && npm test && npm run build`
  (tsc, vitest ~1,100+ tests, vite build) — all green.
- Project rules: **no math/engine/golden changes without naming them** (none
  of these lanes modifies `src/engine/math-engine.ts`, `src/engine/decimal.ts`
  constants, `src/engine/fraction-display.ts`, tree-layout, flowchart-pages,
  or Phase 0 goldens — state that explicitly in each PR). **Warnings never
  block**: incorrect input is allowed with warnings; gates block computation,
  not saving; never silently cap.
- Every behavior change listed under "Name in PR" must appear in the PR
  description.
- Anchors below were verified at `351ebfb`; PR #152 shifted
  `workspace-persistence.ts` line numbers below ~:1400 slightly — locate by
  symbol name, not line, when they disagree.
- Executor-suitability note: all three lanes are now bounded and mechanical —
  Codex-safe. The one review point on Lane A: the backfill writes outside the
  per-workspace write fence (justification pinned below); and the bundled
  Springhill sample must import with zero fixity warnings.

## Status

- **DA-H6 — CLOSED** by PR #152 (2026-06-11): `exportDocumentWorkspaceData`
  is now workspace-scoped (`[dbKey+workspaceId]`), exports every document +
  every attachment of any entityKind, zero-node safe; export scope provably
  matches `replaceDocumentWorkspaceData`'s delete scope. Deliberate leftovers,
  folded into Lane A rather than their own lane: (1) callers still pass a now
  ignored `_legacyNodes` param (kept for call-site stability — cleanup
  optional, not correctness); (2) no export→import **round-trip** survival
  test exists yet for non-node/unattached docs — Lane A adds it since it
  extends that exact fixture.
- **DA-H7 parts 1–2 — IN FLIGHT** as PR #153 (import re-hash + fixity
  mismatch warning via the existing dismissible startup banner; blank hashes
  healed silently; export re-hash for self-consistent files; 4 unit tests,
  negative-verified; 1,113 green at PR head). Lane A = the deferred part 3.
- DA-H7 part 3, DA-H10, DA-M16 — open; lanes below.

---

## Lane A — DA-H7 part 3: backfill legacy blank hashes (+ two test riders)

**Branch `fix/da-h7-content-hash-backfill`. Prereq: PR #153 merged.**
Problem remaining after #153: documents imported *before* #153 can sit in
Dexie with `contentHash: ''`. `requireContentHash` throws on blank
(`src/storage/evidence-vault.ts:312`, `src/storage/record-helpers.ts:78-82`),
so one legacy row bricks the vault projection the day it gets a live caller.
#153 heals re-imported docs and `saveDoc` hashes new uploads — only
already-stored rows need repair.

Design (pinned):

1. New `src/storage/content-hash-backfill.ts`. `contentHash` is indexed on
   `documents` since v8 (`src/storage/db.ts`):
   `db.documents.where('contentHash').equals('').primaryKeys()`, then per
   key: `get` → `sha256HexOfBlob` (`src/storage/blob-hash.ts:15-19`) →
   conditional `.modify()` guarded on the row still having `''` (one blob in
   memory at a time; idempotent; self-extinguishing — the indexed query
   returns nothing after the first pass).
2. Call fire-and-forget with `.catch(console.warn)` from `bootstrapApp` in
   `src/main.tsx` right after `initializeRollingAutoExport` (~:171-173).
3. It writes outside the per-workspace write fence — name this in the PR as
   value-idempotent repair (same blob → same hash; concurrent tabs write
   identical values; the conditional modify avoids clobbering a replaced
   row). Named fallback if review objects: active-workspace-only backfill at
   project open, under the lease.

Tests:
- New `src/storage/__tests__/content-hash-backfill.test.ts`
  (fake-indexeddb pattern like the other Dexie storage tests): only `''`
  rows updated, correct hex, valid rows untouched, second run is a no-op.
- **Rider 1 (folded H6 round-trip):** extend the round-trip fixture in
  `src/storage/__tests__/workspace-persistence.test.ts` (~:289-329) with an
  owner-attached doc and an unattached doc → after export→import both
  survive, the owner attachment keeps its entityKind, the unattached doc has
  zero attachments. (#152 tested export scope, #153 tested hashes — the
  full-loop survival assertion is still missing.)
- **Rider 2 (demo pin):** in `src/phase0/__tests__/springhill-sample.test.ts`,
  assert the bundled `public/samples/springhill-dr-elmore.landroid` imports
  with **no fixity warning** (its hashes are real 64-hex; guards the demo
  from popping the startup banner on every load).

Name in PR: one-time startup backfill for legacy `''` hashes (outside the
write fence, value-idempotent, self-extinguishing); no engine/golden changes;
no behavior change for documents that already carry valid hashes.

---

## Lane B — DA-H10: Decimal-exact CSV fractions

**Branch `fix/da-h10-csv-exact-fractions`.**
Problem: `parseStrictDecimalString` (`src/storage/csv-io.ts:98-123`) parses
`a/b` via float64 (`Number()`, `n / d`) then `num.toFixed(9)` before storing
into `OwnershipNode.fraction` / `initialFraction` (call sites :143-144) — an
imported `1/3` becomes `0.333333333` forever, below the engine's own 24-sig
storage precision.

Change — **`src/storage/csv-io.ts` only.** Rewrite the function as a wrapper:

```ts
import { parseStrictInterestString } from '../utils/interest-string';
import { serialize } from '../engine/decimal';

function parseStrictDecimalString(value: unknown, nodeId: string, column: string): string {
  const raw = typeof value === 'number' ? String(value) : String(value ?? '').trim();
  if (raw === '') {
    throw new Error(`CSV row for node "${nodeId}" has empty ${column}.`);
  }
  const parsed = parseStrictInterestString(raw);
  if (parsed === null) {
    throw new Error(`CSV row for node "${nodeId}" has invalid ${column}: "${raw}".`);
  }
  return serialize(parsed);
}
```

The empty-string throw is deliberate — `parseStrictInterestString`
(`src/utils/interest-string.ts:46-96`) maps empty → `Decimal(0)`, which must
not leak into CSV import. `serialize` (`src/engine/decimal.ts:47-52`) emits
`toFixed(9)` for ≤9dp values and 24 significant digits otherwise, so `'1/2'`
still stores `'0.500000000'` byte-identically. Both helpers are consumed
as-is — zero engine/golden modifications (say so in the PR).

Tests (`src/storage/__tests__/csv-io.test.ts`):
- `:138` `'1/2' → '0.500000000'` — unchanged.
- New exactness test: `'1/3' → '0.333333333333333333333333'` (24 sig digits —
  the audit's prescribed assertion).
- New: `'1.5'` and `'5/4'` → throw `/invalid/` (named change).
- New: empty fraction cell → throws `/empty/` (pins the wrapper's divergence
  from `parseStrictInterestString`).
- Existing negative/garbage tests (:95-123) pass unchanged.
- **No fixture updates**: `fixtures/phase-0/import-stress.csv` is a
  spreadsheet-wizard input (checksum-asserted only), not a csv-io input;
  `demo.runsheet.csv` is an export golden. The `'0.333333333'` assertions in
  `src/engine/__tests__/` are engine display goldens unrelated to CSV.

Name in PR: CSV fractions are now Decimal-exact (non-terminating values store
24 significant digits; halves/quarters/eighths byte-identical); **fractions
> 1 are now rejected with an import error** (previously `'1.5'` imported —
consistent with CSV import's existing throw-on-malformed; the warning-only
rule governs UI entry, not file import — explicitly flag for operator nod);
`Number()` artifacts like `'0x10'` (previously imported as 16) now reject;
empty cells still throw (unchanged).

---

## Lane C — DA-M16: rolling auto-export retention (keep-last-10)

**Branch `fix/da-m16-auto-export-retention`.**
Problem: auto-export writes a new timestamped `.landroid` (now full-doc-store
sized, post-#152) every 5 active minutes with no pruning, until disk fills.
Files go through a File System Access API directory handle persisted in a
dedicated IDB (`landroid-rolling-auto-export`).

Changes:

`src/storage/rolling-auto-export.ts`
- `export const ROLLING_AUTO_EXPORT_KEEP_LAST = 10;`
- Extend the structural `RollingAutoExportDirectoryHandle` (:37-45) with
  optional `values?: () => AsyncIterable<{ kind: string; name: string }>` and
  `removeEntry?: (name: string) => Promise<void>` — feature-detected; real
  `FileSystemDirectoryHandle`s satisfy it without lib.dom gymnastics.
- `export function rollingAutoExportFileNamePattern(projectName: string):
  RegExp` — `^<regex-escaped sanitizeRollingAutoExportBaseName(projectName)>-
  \d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.landroid$`, exactly matching
  `buildRollingAutoExportFileName` output (:162-168). Fixed-width timestamp →
  lexicographic sort == chronological.
- `export async function pruneRollingAutoExportSnapshots({ directoryHandle,
  projectName, keepLast = ROLLING_AUTO_EXPORT_KEEP_LAST })` → `{
  deletedFileNames: string[]; skipped: boolean }` — skipped when
  `values`/`removeEntry` missing; only `kind === 'file'` entries matching the
  strict pattern; sort descending; delete indices ≥ `max(1, keepLast)`.
- `writeRollingAutoExportSnapshot` (:170-203): run prune in try/catch only
  **after** a successful write+close (a failed write throws before prune —
  the last-good-snapshot guarantee holds by construction). Extend
  `RollingAutoExportWriteResult` (:70-74) with `prunedFileNames: string[]`
  and `pruneWarning?: string` (additive).

`src/storage/rolling-auto-export-runtime.ts`
- In `runRollingAutoExportNow` after `recordRollingAutoExported` (:165-168):
  if `result.pruneWarning`, surface via the existing
  `recordRollingAutoExportWarning` action
  (`src/store/storage-health-store.ts:68`). Two lines.

Tests (extend `src/storage/__tests__/rolling-auto-export.test.ts`; seed the
`fakeDirectoryHandle` (:29-51) with an entry list, `values()`, `removeEntry`
capture):
- Prunes beyond keep-last after a successful write (seed 10 matching + 1 new
  → exactly the oldest removed; the just-written file retained).
- Never deletes non-matching names (hand-named `.landroid`, another project's
  timestamped file, `.landroid.bak`).
- Skips gracefully when the handle lacks `values`/`removeEntry`.
- Failed write deletes nothing (`removeEntry` never called).
- A prune error resolves the write successfully with `pruneWarning` set.
- Pattern escapes regex metacharacters in project names (`'A+B (Unit)'`).

Name in PR: auto-export folders self-prune to the 10 most recent
`<project>-<timestamp>.landroid` snapshots for the current project name;
hand-named/foreign files never touched; failed writes never delete. Named
deferrals: configurable N (needs a settings surface that doesn't exist),
pruning files left under a previous project name, total-bytes cap.

---

## Shared risks

- Post-#152 export files are larger (full doc store) — the 500MB `.landroid`
  cap (`src/utils/file-validation.ts:9`) is the ceiling; DA-L7 (base64
  concat perf) is the follow-up lever if it bites. Lane C offsets the disk
  impact of 5-minute snapshots.
- Lane A backfill vs write fence: pinned approach is conditional-modify
  (value-idempotent); conservative fallback named above.
- Lane B's >1-rejection is the one user-visible strictness increase — flagged
  for operator sign-off in the PR.
