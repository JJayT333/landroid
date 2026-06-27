# LANDroid Audit Backlog

Last updated: 2026-06-15. The Step-2 wrap-up sprint (#161–#179) + the unified
title-math rewrite (#180) landed: among the rows below, NOW FIXED are **DA-H1**
(#180, attorney-approved excess-to-WI), **DA-M1/DA-M2** (#167 engine + #180
surfacing), **DA-M5** (#180 ratification), **Van Dyke double-fraction** and
**unleased rows** (#180), **DA-M7** (#168), **DA-M10/M11/M12** (#171/#175/#172),
**DA-L6/L7/L8** (#166/#176/#174+#178), **DA-U1/U2** (#161/#173), **DA2-R1**
(#165). STILL OPEN (the "do it all" program, by wave): DA-H4/H5 + DA-M3/ACT-M01 +
ACT-H01 (W2 title-ledger trust); DA-M6, LLA-L02, DA2-M2 (W1 small defects);
DA2-C*, DA2-M3/M4, DA2-R2/R3/R4 (W3/W4); the federal/RRC/hosted-AI lanes remain
gated. (Prior: DA-H7 #155, DA-H10 #156, DA-M16 #157, DA-H9 #158, Flowchart
rebuild #159 incl. DA-H8; DA-H6 #152; DA-H7 pts 1–2 #153.)

## 2026-06-10 Deep Audit (Claude) — new findings, not yet reconciled row-by-row

Full report with anchors, confidence, and patch sketches:
`docs/deep-audit-2026-06-10.md`. Finding IDs are `DA-*`. Until each is fixed or
explicitly accepted, treat that report as part of this backlog. Summary:

- DA-C1 (Critical): CLOSED — eight title-visible actions journaled (the
  audit's two plus six more found by the gate), the journal-coverage test is
  the permanent CI invariant, and after the operator's 2026-06-10 Springhill
  soak the flip governance is armed at boot (manual click + green gates still
  required to actually flip).
- DA-H1: FIXED (#180; attorney-approved 2026-06-15) — a fixed NPRI is now
  satisfied from the burdened lessor's royalty first, with only the excess
  charged to the WI; a per-tract `fixedNpriExceedsRoyalty` warning surfaces on
  the transfer-order sheet (the excess rule rests on treatise consensus, now
  counsel-approved). Springhill TR2 is a real excess case; TR1 0.225/0.775
  unchanged.
- DA-H2: FIXED (feat/scope-b-hardening) — AI undo hydrates-then-appends via
  `undoTitleActionRecord` (now live-called); `importAndOpenWorkspace` owns
  import ledger hydration.
- DA-H3: FIXED (feat/scope-b-hardening) — journal verdict, rollback-aware
  mutators, cascades skipped on veto, hook exceptions surfaced.
- DA-H4/H5: payload hashing (DA-H5) and invalid-chain quarantine (DA-H4) shipped
  in #185 (`verifyActionPayloadHashes`, `quarantineInvalidLedger`; hydrate now
  preserves a stale/invalid chain instead of rewriting it). The action result-hash
  deliberately covers the ActionRecord `result` (the tamper target) and excludes
  lifecycle envelope fields by design (`audit-chain.ts:178-182`). The one residual
  is the deferred `lastFlushedHeadHash` envelope head-hash pin closing the
  truncate-a-hashed-chain-back-to-fully-legacy vector (`audit-chain.ts:272`).
  (Open — narrow, author-deferred.)
- DA-H6: FIXED (#152) — `exportDocumentWorkspaceData` is workspace-scoped:
  every document + attachment of any entityKind exports (zero-node safe), so
  export scope matches the restore side's delete scope. Round-trip survival
  test for non-node/unattached docs folds into the DA-H7 lane.
- DA-H7: FIXED. Parts 1–2 via #153 (import re-hash + fixity warning, blank
  hashes healed, export re-hash); part 3 (one-time `''` backfill in Dexie +
  two test riders) via #155 — startup runs a non-blocking, self-extinguishing,
  value-idempotent backfill of legacy blank `contentHash` rows.
- DA-H8: FIXED (#159, Flowchart rebuild) — a reactive overlay recomputes
  interest from the live title nodes onto placed canvas nodes; deleted nodes
  get a "Stale" badge on screen and in print.
- DA-H9: FIXED (#158) — the Map-mode ORRI branch-card "Total" now uses the
  tract's own `unitOrriDecimal` (`unitParticipation × totalOrriBurdenRate`)
  instead of summing unit-wide ORRI decimals, which double-counted unit-scope
  ORRIs spanning multiple tracts. Display-layer fix; no math/golden change.
- DA-H10: FIXED (#156) — CSV import parses fractions via the strict Decimal
  interest parser + `serialize`, so non-terminating values (e.g. `1/3`) store
  at full precision instead of float64 + `toFixed(9)`; out-of-range/malformed
  values now reject.
- DA-M14/M15: FIXED (feat/scope-b-hardening) — writer heartbeat at TTL/3 with
  visibility pause; title-ledger writes and project rename/delete/duplicate
  fenced behind the write lease; reader-tab ledger hydration is memory-only.
- DA-M16: FIXED (#157) — rolling auto-export self-prunes to the 10 newest
  strict timestamped snapshots for the current project after a successful
  write; hand-named/foreign/backup files, directories, and failed writes are
  never deletion triggers.
- DA-U1 (broken Tailwind tokens): FIXED — the missing `leather-dark` /
  `parchment-light` tokens now exist, `text-gold-950` has zero references, and
  `src/theme/__tests__/theme-tokens.test.ts` is a CI guard that fails on any
  brand-color utility class with no backing `--color-*` token. The broader §5
  aesthetics consolidation (button standard, type kit) remains its own lane.
- DA-M1..M13, DA-L1..L10, DA-U2..U6: see report §1-2 (incl. silent
  over-conveyance cap, addNode validation bypass = LLA-H03, provenance
  flattening = ACT-M01).
- 2026-06-14 reconciliation (knock-out sprint):
  - DA-U5 = Fixed — `normalizeInterestString` now carries a doc-comment
    warning it uses the lenient parser and must never gate a save.
  - DA-L3 = partially stale: the `runChat.ts` "fallback snapshot" is no longer
    dead — the snapshot is assigned and committed on real mutations
    (`runChat.ts` ~:119-120) after the approval/undo refactor; the proxy
    `max_tokens` clamp (`request-policy.ts`) is intentional defense-in-depth.
    Remaining genuine dead code is engine-file only (`display()` in
    `decimal.ts`) — routed to the math-engine workstream.
  - LLA-L03 = verified no-op: root-level docs (incl. `CONTINUATION-PROMPT.md`)
    are all actively referenced; no stale handoff material to archive.
- Status updates to existing rows: ACT-H01 = Fixed (`ensureTitleBaseline`,
  Scope A); ACT-H05 = Partial (banner exists; no auto-revert, console-only in
  shadow); ACT-M01 = Open (confirmed live); LLA-H02 = Fixed
  (feat/scope-b-hardening closed the ledger + heartbeat remnants); LLA-H03 =
  Open (confirmed: DeskMapView Add Root uses raw `addNode`).
- 2026-06-26 reconciliation (HIGH-severity re-verification against current code):
  re-confirmed live in code — **DA-H2** (`AIPanel.tsx` undo → `restoreSnapshotWithLedger`),
  **DA-H3** (`removeNode` gates cascades on the rollback verdict, `workspace-store.ts:1464`),
  **DA-H4/H5** (#185 payload hashing + quarantine; result-hash scope by design),
  **LLA-H04** (`createNpri` tool calls `missingNpriCharacterizationMessage`,
  `tools.ts:529`), and **DA-M14** (idle-writer heartbeat, `workspace-write-lease.ts:184`)
  are all shipped. The federal-lease `stipulations` field and the DA-M1
  over-conveyance warning also already exist. Genuinely OPEN from the HIGH list:
  **DA-M2/LLA-H03** (raw `addNode`/`updateNode` skip `validateCalcGraph`), the
  **`lastFlushedHeadHash`** ledger pin (DA-H4/H5 residual above), **DEF-AI-01**
  (`CitationVerifier` exists but is wired nowhere in `runChat`/`AIPanel`),
  **federal-lease-term persistence** (terms live in an in-memory `Map`,
  `federal-lease-seed.ts:254`, no Dexie table), and the DA-M1 generic-`calculateShare`-clamp
  residual. A broader cross-source snapshot lives in
  `docs/deferred-and-planned-ledger.md`, but its per-item *status* over-states
  openness — THIS file is the status source of truth.

This is the active master list for open, deferred, superseded, and newly found
review items. It consolidates:

- `docs/archive/audits/LINE_BY_LINE_AUDIT_2026-05-31.md`
- `docs/archive/audits/AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`
- `docs/phase-4-title-cutover-notes.md`
- `docs/phase-4-action-layer-notes.md`
- `docs/rebuild-plan.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `CONTINUATION-PROMPT.md`
- current 2026-06-02 review of `feat/phase-4-title-cutover`

## Current Review Snapshot

Branch: `feat/phase-4-title-cutover`

Reviewed ranges:

- Local title-cutover range: `origin/feat/phase-4-title-cutover..HEAD`
- Full stacked range: `origin/main..HEAD`
- Stack base: `origin/main` at `3768ff5`
- Stacked action-layer base: `origin/feat/phase-4-action-layer` at `13c57fa`
- Current HEAD: `9521128`

Untracked local artifacts:

- `docs/archive/audits/LINE_BY_LINE_AUDIT_2026-05-31.md`
- `scripts/springhill/build_landroid.py`

Related GitHub PR status verified on 2026-06-02:

- #88 `refactor(storage): load owner docs metadata-first with on-demand blobs` - open.
- #89 `refactor(storage): load map assets metadata-first with on-demand blobs` - open.
- #90 `docs(ideas): capture workspace-wide AI query from any screen` - open.
- #96 `Native attorney-packet ZIP packaging (finishes deferred Phase 2)` - open.
- #97 `Phase 4: action layer as canonical mutation path (shadow, additive)` - open.

Operational verdict for the current title-cutover branch: do not merge until
the Action Layer findings below are fixed or the branch is explicitly narrowed
to a non-canonical, non-durable, mechanism-only proof. The live app still reads
from the existing store, so these findings do not change current user-facing
math while the read path stays shadow. They do block any claim that the live
ledger is a complete durable source of truth or safe future read source.

## Status Legend

| Status | Meaning |
| --- | --- |
| Open | Still needs implementation, validation, or design. |
| Partial | Some remediation landed, but the remaining risk is material. |
| Needs design | Needs a design decision before code. |
| Deferred | Intentional later work; keep visible so it is not lost. |
| Needs verification | Plausible current issue, but needs direct runtime or hosted proof. |
| Fixed / superseded | Older item is resolved or replaced by a narrower current item. |

## Tentative Cleanup Decisions For Claude Verification

Temporary note: this section captures Codex/user planning discussion from
2026-06-02. It is intentionally tentative and may be deleted after Claude
reviews it. It is not an implementation record. Claude should verify whether
each item is real, already fixed, overstated, missing evidence, or correctly
classified.

### Claude Verification Ask

- Do not implement fixes while reviewing this section.
- Verify the action-layer blockers ACT-H01 through ACT-H05 and whether the
  branch should remain mechanism-only or move toward durable persistence.
- Verify each old High/Medium audit item classification below.
- Pay special attention to LLA-H03: over-100 / multiple same-tract roots should
  be allowed as a working title-theory state, but must warn clearly and must not
  look reliance-ready.
- Verify Desk Map PDF chips and decimal/fraction display before treating them
  as missing features.
- Keep product-feature ideas separate from bug cleanup.

### Tentative Action-Layer Classification

These decisions preserve the earlier plan for ACT-H01 through ACT-H05.

| ID | Tentative bucket | Notes for Claude |
| --- | --- | --- |
| ACT-H01 | Fix Now | Replay needs an initial baseline/snapshot for loaded or imported workspaces before any read-cutover claim. |
| ACT-H02 | Fix Now | Malformed title action rows should fail closed, not silently drop from replay. |
| ACT-H03 | Partial | `.landroid` v9 now preserves the ledger across manual export/import; runtime Dexie persistence and hydration remain deliberately deferred. |
| ACT-H04 | Fix Now | Reset or namespace the action log on workspace replacement/import/demo load. |
| ACT-H05 | Fix Now | Add visible divergence state and block cutover candidacy until divergence is cleared. |
| ACT-M01 | Fix Now | Origin/source provenance should distinguish user, AI, import, and system mutations. |
| ACT-M02 | Design First | Define canonical replay ordering before durable export/import of action records. |
| ACT-M03 | Fix Now | Process-local command IDs should not be used as durable identifiers. |
| ACT-M04 | Defer | Measure snapshot growth at W2 scale before optimizing; do not block immediate safety cleanup. |
| ACT-L01 | Fix Now | Stale comment cleanup can be bundled with action-layer fixes. |

### Tentative Old High/Medium Audit Classification

| ID | Tentative bucket | User/Codex decision notes |
| --- | --- | --- |
| LLA-H01 | Fix Now | Keep recommendation. Storage/user isolation should be cleared before hosted/private-beta confidence. |
| LLA-H02 | Fix Now | Keep recommendation. Single-writer protection needs atomic/fenced semantics and side-store write routing. |
| LLA-H03 | Design/Verify First | User wants same-tract multiple roots and over-100 working states allowed. Verify existing red/warning behavior; if incomplete, add title-conflict warnings rather than blocking Add Root. |
| LLA-H04 | Fix Now | Keep recommendation. AI NPRI tools should not default legally material unknowns. |
| LLA-M01 | Fix Now | Keep recommendation. `.landroid` side-store rollback should be deterministic. |
| LLA-M02 | Fix Now | Keep recommendation. Imported stale attachment badges damage user trust. |
| LLA-M03 | Fix Now | Keep recommendation. Scope attachment ordering by workspace/entity. |
| LLA-M04 | Design First | User accepted design-first. Decide v8 export expansion versus version-gated/v9 document-link policy. |
| LLA-M05 | Fix Now | User strongly kept recommendation. Preserve Texas-only math boundary; prevent federal/private lease attachment into Texas math. |
| LLA-M06 | Fix Now | Keep recommendation. Surface null-unit records as excluded-with-reason; do not guess assignment. |
| LLA-M07 | Verify/Design First | User was unsure. Examine current hosted AI proxy reachability and intended modes before deciding exact schema tightening. |
| LLA-M08 | Fix Now | Keep recommendation. Generic client errors and non-sensitive structured logs. |
| LLA-M09 | Design First | Keep recommendation. Define hosted AI privacy/context modes before implementation. |
| LLA-M10 | Design First | Keep recommendation. Overlaps import-session/action-plan boundary; avoid one-off chat prompt patch. |
| LLA-M11 | Verify First | Keep recommendation. Prove hosted blob iframe CSP behavior before changing headers. |
| LLA-M12 | Design First | Keep recommendation. Decide e2e CI policy before adding required checks. |
| LLA-M13 | Fix Now | Keep recommendation. Align branch filters with conventions or document PR-only CI. |
| LLA-M14 | Fix Now | Keep recommendation. Add local aggregate backend/root validation script or docs. |

### Tentative Implementation Grouping

If Claude agrees with the classifications, suggested fix batches are:

1. Storage isolation: LLA-H01 and LLA-M03.
2. Write safety/import fidelity: LLA-H02, LLA-M01, and LLA-M02.
3. Title/math boundary: LLA-H03 warning verification, LLA-M05, and LLA-M06.
4. AI mutation correctness: LLA-H04.
5. Hosted AI/security design and fixes: LLA-M07, LLA-M09, LLA-M10, then LLA-M08.
6. CI/process cleanup: LLA-M12 design, LLA-M13, and LLA-M14.
7. Hosted document preview verification: LLA-M11.
8. Document export policy: LLA-M04.

### Tentative Product Direction Notes

These are product-feature/design notes, not bug-fix backlog. Keep them separate
from the cleanup sprint unless Claude believes one is required to close an
existing blocker.

- Desk Map should remain the main working surface. The evidence/record/action
  layers should support Desk Map title-building rather than replace it.
- LANDroid should support a "Title Theory" concept: a visual, iterative working
  title model where unresolved or conflicting facts can be represented without
  pretending they are final.
- Same-tract multiple roots and over-100 states should be allowed while running
  title. They should warn clearly, turn red or otherwise signal conflict, and
  be blocked from reliance-ready/final output until resolved or explained.
- Proposed confidence/source statuses for nodes, conveyances, tracts, or issues:
  `Working Theory`, `Clue`, `Source Found`, `Interpreted`, `Verified`,
  `Conflict`, and `Needs Follow-Up`.
- Proposed manual source labels: county clerk, appraisal district, district
  court/probate, RRC, family/heirship clue, user note, and other. Do not add
  clerk/district court integrations yet.
- Desk Map PDF chips appear mostly implemented: multi-document chips open a
  specific attachment by `docId`, with overflow handling and tests. Remaining
  backlog is attachment integrity, not basic chip visibility.
- Dual decimal plus fraction display is a preserved rebuild contract. Current
  node edit popup shows decimal input plus fraction preview for editable
  interest, but calculated remaining/card values appear fraction-only. Treat as
  a small polish candidate after Claude verifies.
- There is no direct FamilySearch integration in the current tool/session.
  Open-source/family lookup should remain a later AI/product idea, not current
  cleanup.

### Tentative Feature Classification

| Feature idea | Tentative bucket | Notes |
| --- | --- | --- |
| Native attorney-packet ZIP packaging / PR #96 | Add Soon | Review separately after title/action cleanup is not entangled with packet work. |
| Per-view edit-control disabling for read-only tabs | Add Soon | Add after LLA-H02 write-fence semantics are settled. |
| Storage health and Backup Now UX | Add Soon | Add after LLA-H01/LLA-H02/import rollback safety. |
| AI mutation approval UX polish | Add Soon | Add after LLA-H04 and provenance/action decisions. |
| Metadata-first owner/map/research side-store conversion | Add After Foundation | Review #88/#89 after shard/user isolation is fixed or confirmed compatible. |
| Project picker / multi-workspace saved-project index | Add After Foundation | Add after workspace namespace and write-fence cleanup. |
| Rolling auto-export | Add After Foundation | Add after Backup Now/storage health. |
| Expand entity document links beyond Desk Map nodes | Add After Foundation | Add after LLA-M04 export policy decision. |
| Import-manifest previews for large document sources | Add After Foundation | Add after evidence-vault/export rules are stable. |
| Local OCR/text engine | Add After Foundation | Add after evidence vault and source-record model are stable. |
| Hybrid retrieval and `CitationVerifier` | Add After Foundation | Add after OCR/source records/evidence vault are stable. |
| Persistent import ledger for staged spreadsheet rows | Add After Foundation | Add after action-layer persistence/draft decisions. |
| Title-opinion-as-root and source attestation | Add After Foundation | Add after document vault plus import-session foundations. |
| `OpinionDraft`, `ObligationCalendar`, `AbstractorPackage` projections | Add After Foundation | Add after project records/action/evidence layers stabilize. |
| Professional three-pane Documents workflow | Add After Foundation | Add after document link/export scope is stable. |
| Open Source Lookup Workbench | Later Product / AI Expansion | Start as checklist/source-note workflow; agentic searching comes later. |
| FamilySearch/genealogy-style agent | Later Product / AI Expansion | Return leads, relatives, probate/court hints, and confidence; never title conclusions. |
| Heirship clue finder / probate lookup assistant | Later Product / AI Expansion | Should produce follow-up tasks with source links/confidence warnings. |
| Universal command/search and inline AI | Later Product | Useful after records/retrieval/verifier are stable. |
| Template-driven communication generation | Later Product | Keep behind core evidence/action stability. |
| Promote unit metadata to first-class records | Later Product | Revisit when unit metadata needs outgrow current tags. |
| Deeper RRC decoder coverage | Later Product | Add only for workflow-proven file families. |
| Backend expansion beyond minimal spine | Explicit Gate | Open only for storage/sync/OCR/search/sharing/collaboration with security/deployment updates. |
| Federal/private math expansion | Explicit Gate | Open only when the user explicitly starts that math phase. |
| Broader Texas math expansion | Explicit Gate | Requires golden masters before implementation. |
| SQLite/OPFS/Tauri/native runtime decision | Explicit Gate | Evaluate only if corpus size, OCR/search, or native file handling proves browser-local storage insufficient. |

## Current Review Findings

| ID | Title | Severity | Area / workstream | Source document | Current status | Plain-English risk | Recommended next action | Owner / agent fit | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-H01 | Title replay has no initial baseline for existing workspaces | High | action-layer / title-cutover | current review; `src/store/title-action-log.ts`; `src/project-records/action-layer/title-replay.ts` | Open | The log replays from empty state, but the live hook only records mutations after app startup. A real imported or loaded project can lose every pre-existing title node if a cutover read replays only the live action log. | Add an explicit baseline action or snapshot action on workspace load/import, then test existing-workspace plus later mutation replay. | Pair | merge, future rebuild |
| ACT-H02 | Malformed title action records fail open during replay | High | action-layer / title-cutover | current review; `src/project-records/action-layer/title-replay.ts` | Fixed (audit-cleanup batch) - malformed active title rows now throw an invalid-record replay error before projection or node reconstruction. | `parseTitleActions` skipped malformed title action records instead of failing. A corrupt or incompatible ledger row could silently drop a title mutation from the cutover projection. | Make replay fail closed on malformed title action results, surface the invalid record IDs, and add tests for malformed or missing full-effect payloads. | Codex | merge, future rebuild |
| ACT-H03 | Live title ledger is not durable despite durable wording | High | action-layer / title-cutover | current review; `src/store/title-action-log.ts`; `src/main.tsx` | Partially fixed (v9 file format) - manual `.landroid` save/import now carries a validated `actionLedger`, but refresh-time Dexie persistence and hydration remain deferred. | Action records and audit events still live only in the in-memory store between manual exports, so a browser refresh can lose the shadow ledger. | Add runtime ledger persistence after the storage isolation/write-fence workstream; keep the snapshot authoritative until a separate read-cutover decision. | Pair | future rebuild |
| ACT-H04 | Action log is not reset on workspace replacement | High | action-layer / title-cutover | current review; `src/store/workspace-store.ts`; `src/components/shared/Navbar.tsx`; `src/store/title-action-log.ts` | Fixed (audit-cleanup batch) - `loadWorkspace` now resets the ledger and invalidates in-flight recordings before replacing workspace state. | Loading or importing a new project left the in-memory action records, audit events, and head hash from the previous project. That could mix ledgers across workspaces. | Reset or namespace the title action log on `loadWorkspace`, CSV import, `.landroid` import, demo load, and workspace key change. Add tests for two sequential workspaces. | Codex | merge, future rebuild |
| ACT-H05 | Divergence is console-only after the store has already committed | High | action-layer / title-cutover | current review; `src/store/title-action-log.ts`; `src/store/workspace-store.ts` | Open | A parity divergence leaves the user's title mutation in the canonical store and only writes `lastDivergence` plus `console.error`. A non-technical user may never see that the ledger fell behind. | Add a visible app-level divergence warning and block any cutover candidacy until divergence is cleared. Decide whether shadow recording may continue after divergence. | Pair | merge, private beta, future rebuild |
| ACT-M01 | AI-origin and import-origin title mutations are tagged as user-origin live records | Medium | action-layer / provenance | current review; `docs/phase-4-title-cutover-notes.md` | Open | The audit trail cannot distinguish direct user edits from approved AI/import-driven store mutations. That weakens provenance for title changes. | Pass origin and source IDs through the approval/import call path into the title journal hook, or keep live journaling disabled for those paths until provenance is explicit. | Pair | future rebuild, AI expansion |
| ACT-M02 | Replay ordering is not a persisted canonical order | Medium | action-layer / audit-log | `docs/phase-4-title-cutover-notes.md` | Needs design | Replay folds action records in input order. After persistence/export/import, array order may not be enough to prove application order, especially with equal timestamps. | Define canonical order: audit-chain order, appliedAt plus monotonic sequence, or persisted action sequence. Add tests with tied timestamps and shuffled input. | Pair | future rebuild |
| ACT-M03 | Default title command IDs are process-local | Medium | action-layer / audit-log | current review; `src/project-records/action-layer/title-command-sourcing.ts` | Fixed (audit-cleanup batch) - default command IDs now use a `crypto.randomUUID()` suffix while explicit IDs remain honored. | The fallback command ID counter reset on reload/tab. Once persisted, repeated equivalent mutations could collide or become hard to trace. | Require caller-supplied operation IDs for live journaling or add a durable random/monotonic ID source. | Codex | future rebuild |
| ACT-M04 | Full node snapshots may create large in-memory and future package growth | Medium | action-layer / performance | `docs/phase-4-title-cutover-notes.md`; current review | Needs design | Every title command can carry full node snapshots. Large projects or broad rebalance operations can make the journal heavy. | Measure W2-scale ledger growth; decide full node snapshot versus math-relevant field snapshot before any v9 package format. | Pair | future rebuild |
| ACT-L01 | `title-action-log.ts` header is stale about update coverage | Low | docs / code comments | current review; `src/store/title-action-log.ts`; `docs/phase-4-title-cutover-notes.md` | Fixed (audit-cleanup batch) - action-log comments now state that projected field edits record as `title.update`. | The code now records `title.update`, but the header still said field edits were intentionally not recorded. Future reviewers could misread the scope. | Update the comment when the implementation is fixed or narrowed. | Codex | none |
| ACT-M05 | v9 import validated an embedded `actionLedger` but never hydrated it; save-after-import dropped it | Medium | action-layer / v9 persistence | #102 ultra review 2026-06-03 | Fixed (PR #102) - import now hydrates `useTitleActionLog` via a new `hydrate()` called from Navbar after `loadWorkspace`, so export->import->export preserves the audit chain; regression test added. | `importLandroidFile` attached `data.actionLedger` but nothing read it; `loadWorkspace` reset the live ledger (ACT-H04) so the next save wrote a ledger-free v9. | (resolved) | Pair | none |
| ACT-L02 | `title-soak.ts` docstring/report overclaimed vs what the script verifies | Low | dev tooling / docs | #102 ultra review 2026-06-03; `scripts/title-soak.ts` | Fixed (PR #102) - docstring/report trimmed to match the harness (one synthesized createRootNode mutation -> replay==adapter + math parity); removed misleading hardcoded fields. | Docstring claimed `ensureTitleBaseline` + the live recording path + fail-on-`lastDivergence`/`lastError` that the script did not do. | (resolved) | Codex | none |

## Prior Audit Findings

| ID | Title | Severity | Area / workstream | Source document | Current status | Plain-English risk | Recommended next action | Owner / agent fit | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LLA-H01 | Hosted/user isolation incomplete for shard and side-store rows | High | shard-runtime / hosted storage | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Partial | Manifest rows now carry `dbKey`, but child shard rows and many side stores still key/query/delete by `workspaceId`. Same-workspace packages in one browser profile can still collide. | Add `dbKey` or equivalent namespace to child shard rows and side stores, then test Alice/Bob with the same imported `workspaceId`. | Codex | hosted, private beta, future rebuild |
| LLA-H02 | Single-writer protection is advisory, not atomic | High | shard-runtime / multi-tab | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Open | Lease acquisition is load-then-save and side-store mutations can bypass the write fence. Two tabs can still diverge or a reader can edit side stores. | Add atomic compare-and-set/fencing-token semantics and route side-store writes plus per-view editing through the same role. | Pair | hosted, private beta, future rebuild |
| LLA-H03 | Same-tract root creation can overstate ownership | High | title math / Desk Map UX | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Open | Desk Map Add Root still appends a 100 percent node through `addNode`, so a tract can show multiple 100 percent present owners. | Route Add Root through validated root creation and DeskMap-scoped total checks, or represent over-100 states as explicit unresolved title issues. | Pair | merge for math work, private beta, future rebuild |
| LLA-H04 | AI NPRI mutation tools default legally material unknowns | High | AI mutation / title math | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed (audit-cleanup batch) - AI NPRI tools and previews now require explicit royalty kind and fixed basis before approval. | Direct AI tools defaulted unclear NPRI kind to fixed and fixed basis to burdened branch. A user could approve a legal assumption that was never sourced. | Require explicit `royaltyKind` for NPRI and explicit fixed basis when fixed; block approval previews until answered. | Codex | private beta, AI expansion |
| LLA-M01 | `.landroid` side-store rollback can leave mixed state | Medium | import/export / storage | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed (LLA-M01 rollback determinism) - rollback wrapper now waits for target side-store writes to settle before rollback and tests delayed target writes. | Parallel side-store replacement can keep mutating after rollback starts. Failed imports can mix old and new side-store data. | Keep the settled replacement regression tests green; broader storage isolation/write-fence work remains LLA-H01/H02. | Codex | private beta, future rebuild |
| LLA-M02 | Imported workspaces can keep stale node attachment badges | Medium | doc-registry / import | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed (audit-cleanup batch) - `.landroid` import now uses strict attachment hydration that clears summaries without backing document rows. | Import hydration left node attachment summaries alone when Dexie had no rows. The UI could show document chips without backing documents. | Add strict import hydration mode that clears missing attachment summaries after workspace replacement. | Codex | private beta, future rebuild |
| LLA-M03 | Document attachment ordering crosses workspace boundaries | Medium | doc-registry / storage | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed (audit-cleanup batch) - attachment append, reorder, and compaction now scope by `workspaceId + entityKind + entityId`. | Reorder and position calculations queried by entity only. Matching node IDs in different workspaces could pollute ordering. | Scope attachment ordering and compaction by `workspaceId + entityKind + entityId`. | Codex | future rebuild |
| LLA-M04 | Polymorphic document links modeled but export remains node-only | Medium | doc-registry / export | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Open | Generic document links can point to owners, leases, curative, or research, but v8 package export serializes node links only. | Either export all workspace-scoped links or keep non-node links version-gated and blocked until round-trip support lands. | Pair | future rebuild |
| LLA-M05 | Owner Database lease-target path can create non-Texas Desk Map lease nodes | Medium | Texas math boundary | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed (audit-cleanup batch) - `AttachLeaseModal` now blocks non-Texas leases before any lease-node save path can run. | A modal path could bypass the safe `attachLease` gate and attach federal/private/tribal leases into active Texas math UI. | Route `AttachLeaseModal` through `workspaceStore.attachLease` or duplicate the Texas lease guard before node creation. | Codex | private beta, future rebuild |
| LLA-M06 | Null-unit unit-wide ORRI/WI records can disappear from coded units | Medium | leasehold math | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Open | Legacy unit-scoped records with no `unitCode` can be excluded from all coded units without an explicit repair warning. | Surface null-unit records as excluded-with-reason and require unit assignment before transfer-order reliance. | Pair | private beta |
| LLA-M07 | Hosted AI proxy remains broader than LANDroid client contract | Medium | hosted AI | `LINE_BY_LINE_AUDIT_2026-05-31.md`; `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md` | Partial | Client-supplied tools are rejected, but signed-in users can still submit broader generic OpenAI fields and arbitrary message arrays. | Enforce an exact hosted LANDroid request schema with server-owned model and bounded roles/content. | Codex | hosted |
| LLA-M08 | Hosted AI proxy exposes upstream/internal error details | Medium | hosted AI / security | `LINE_BY_LINE_AUDIT_2026-05-31.md`; `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md` | Fixed (PR #104) - upstream error bodies are drained without being returned or logged; clients get a generic message and logs keep only non-sensitive structured fields. | Upstream error bodies can be returned to clients and logged as body prefixes. | Return generic client errors and log non-sensitive structured fields only. | Codex | hosted |
| LLA-M09 | Hosted AI prompts send sensitive workspace context by default | Medium | hosted AI / privacy | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Open | Generic hosted chat can send title parties, fractions, doc references, remarks, and lease economics to OpenAI by default. | Add context-minimization modes and visible disclosure before hosted full-context chat. | Pair | hosted, AI expansion |
| LLA-M10 | Guided CSV import injects untrusted rows into tool-capable chat | Medium | AI import | `LINE_BY_LINE_AUDIT_2026-05-31.md`; `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md` | Open | Hostile spreadsheet cells can still steer a tool-capable local chat into confusing proposal spam. | Route guided import through source-row staging, selected rows, capped proposals, and typed action plans. | Pair | AI expansion |
| LLA-M11 | Hosted CSP likely blocks blob-backed PDF iframe previews | Medium | hosted docs / CSP | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed in config (PR #108) - `frame-src 'self' blob:` added to the hosted CSP in `customHttp.yml`; hosted iframe smoke-verify pending post-deploy. | Hosted headers may block `blob:` iframes even though local previews work. | Add `frame-src 'self' blob:` or smoke-test hosted headers and document the verified behavior. | Codex | hosted |
| LLA-M12 | CI does not run Playwright e2e despite docs treating e2e as default | Medium | CI / test release | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Open | PR CI can miss browser workflow regressions. | Add e2e CI or explicitly document it as local release/checkpoint validation only. | Pair | private beta |
| LLA-M13 | CI push branch filters conflict with branch conventions | Medium | CI / repo process | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed (audit-cleanup batch) - push CI now tracks locked branch prefixes and no longer includes deprecated agent prefixes. | Approved `feat/*`, `fix/*`, and `docs/*` branches did not get push CI, while deprecated agent prefixes did. | Align push filters with current branch conventions or rely only on PR/main triggers and document that. | Codex | process reliability |
| LLA-M14 | Local root validation misses backend packages | Medium | CI / validation | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed (audit-cleanup batch) - root `validate` and `validate:backend` scripts now cover root plus backend validation and are documented. | CI validates backend packages now, but root local scripts did not expose a single aggregate validation command. | Add `validate` or `validate:backend` scripts and update README/TESTING. | Codex | hosted |
| LLA-L01 | Local Ollama guidance recommends wildcard origins | Low | local AI / docs | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed (audit-cleanup batch) - AI settings now recommend explicit local dev origins instead of wildcard Ollama CORS. | `OLLAMA_ORIGINS=*` broadened local Ollama browser exposure. | Recommend origin-specific local dev URLs instead. | Codex | none |
| LLA-L02 | Desk Map warning dots infer validation from description text | Low | UX / validation | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Open | Warning dots can be false positives or miss real validation state. | Derive warning dots from shared validation/coverage helpers. | Codex | user trust |
| LLA-L03 | Stale root handoff material remains | Low | docs lifecycle | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Needs verification | Old handoff material may still sit at root or under active docs. | Archive or reconcile stale handoffs after the active branch stack stabilizes. | Codex | process clarity |
| LLA-L04 | `PATCH_PLAN.md` e2e status contradicts `TESTING.md` | Low | docs lifecycle | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed (audit-cleanup batch) - stale `PATCH_PLAN.md` archived under `docs/archive/2026/`; `docs/audit-backlog.md` and current validation docs now carry active status. | The plan says skipped e2e remains, while testing docs say no Phase 5 skips remain. | Reconcile `PATCH_PLAN.md` or archive it if superseded by this backlog. | Codex | planning clarity |
| LLA-L05 | AI settings component comment is misleading | Low | docs / comments | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed (audit-cleanup batch) - component comment now matches the session-only cloud key policy, with persisted settings shape covered by `settings-store` tests. | Stale comment can make reviewers believe cloud keys persist. | Verify current comment and update if stale. | Codex | none |
| LLA-L06 | Stale fixture generator writes outside repo | Low | scripts / fixture control | `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed (PR #107) - `scripts/generate-test-csv.ts` now requires an explicit in-repo `--out` and rejects out-of-repo paths; tests cover success + rejection + missing `--out`. | Running the documented generator can write artifacts outside the repo boundary. | Archive, delete, or require an explicit in-repo output path. | Codex | repo hygiene |
| AI20-P2-HOSTED-3 | Usage controls are daily-ceiling only | Medium | hosted AI / cost control | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md` | Open | A valid token can burst requests until the daily ceiling is reached. | Add per-minute limits, concurrency control, and later provider-actual usage reconciliation. | Pair | hosted |
| AI20-P2-AI-2 | Two-row and multi-row headers are under-modeled | Medium | import staging | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md` | Deferred | Real runsheets often split semantic headers across rows; one-row detection can miss columns. | Add a multi-row header combiner and tests using recurring real formats. | Pair | AI expansion |
| AI20-P2-FRONTEND-2 | Large derived summaries recompute broadly | Medium | performance | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md` | Deferred | Large graphs can become slow if views subscribe to broad arrays and recompute full summaries too often. | Add scoped selectors or memoized derived indexes where runtime profiling proves value. | Codex | private beta |
| AI20-P3-PERF-1 | AI delete previews are O(n squared) | Low | performance | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md` | Deferred | Large deletes can become slow. | Build a parent-to-children index before descendant walks. | Codex | hardening |
| AI20-P3-PERF-2 | Document export scans attachments inefficiently | Low | performance / export | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md` | Deferred | Export can slow down as document counts grow. | Use workspace-scoped indexes and `Set` membership for node IDs. | Codex | hardening |
| AI20-P3-PERF-3 | Map and research text previews read large blobs on main thread | Low | performance / blobs | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md` | Deferred | Large text/blob previews can stall the UI. | Move large previews behind workers, streaming, or explicit preview-size limits. | Codex | hardening |
| AI20-P3-PERF-4 | ELK layout cost is partly discarded | Low | performance / canvas | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md` | Deferred | LANDroid may pay layout cost without using all layout output. | Decide whether to trust ELK fully or simplify the hot path. | Pair | hardening |
| AI20-P3-PERF-5 | Desk Map Fit ignores content-size changes | Low | canvas UX | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md` | Deferred | Fit may miss bounds changes from attachments, warnings, or expanded details. | Add content-size-aware fit triggers if Fit remains core workflow. | Codex | UX hardening |

## Deferred Workstream And Product Gates

| ID | Title | Severity | Area / workstream | Source document | Current status | Plain-English risk | Recommended next action | Owner / agent fit | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEF-ACT-01 | Decide first workflow cutover order | Medium | action-layer | `docs/phase-4-action-layer-notes.md` | Needs design | Cutting over the wrong workflow first can put high-risk title math ahead of easier owner/curative surfaces. | Decide candidate order after current title findings are fixed. | User + pair | future rebuild |
| DEF-ACT-02 | Full-effect persistence for non-title surfaces | Medium | action-layer | `docs/phase-4-action-layer-notes.md`; `docs/phase-4-title-cutover-notes.md` | Deferred | Title now attempts full effects, but other surfaces still need self-sufficient logs before cutover. | Apply the full-effect pattern surface by surface with parity and persistence tests. | Pair | future rebuild |
| DEF-ACT-03 | Audit chain scope | Medium | action-layer / audit | `docs/phase-4-action-layer-notes.md` | Needs design | One project-wide chain may be right, but per-workspace or per-surface chains may be easier to verify and repair. | Choose project, workspace, or surface chain scope before durable v9 inclusion. | User + pair | future rebuild |
| DEF-ACT-04 | Define record-bearing `.landroid` v9 package format | High | package migration | `docs/phase-4-action-layer-notes.md`; `docs/project-record-migration-strategy.md` | Fixed (v9 durable format) - v9 adds only optional `actionLedger` rows, validates the bundle and audit chain, keeps the snapshot authoritative, and drops bad ledgers with a warning. | Action/audit records could not be safely exported/imported until the package format and validation rules were explicit. | Review the v9 implementation and keep full projected-bundle/read-cutover work deferred. | Pair | future rebuild |
| DEF-ACT-05 | Maintain no-PII synthetic fixture rule for action tests | Medium | privacy / fixtures | `docs/phase-4-action-layer-notes.md`; `docs/phase-4-title-cutover-notes.md` | Open policy | Real Springhill or `.landroid` data in tests could expose sensitive title data. | Keep fixtures synthetic; document any real-data smoke as local-only, checksum-only evidence. | All agents | privacy |
| DEF-IMP-01 | ActionRecord drafts versus durable action records for apply path | Medium | import-session / action-layer | `CONTINUATION-PROMPT.md`; `docs/phase-3-import-session-notes.md` | Needs design | Drafts stored too early can look applied; drafts stored too late can lose review history. | Decide draft-capable schema versus outside-durable drafts before apply implementation. | Pair | future rebuild |
| DEF-IMP-02 | Source rows/excerpts as first-class backend-spine records | Medium | import-session / evidence | `CONTINUATION-PROMPT.md`; `docs/rebuild-plan.md` | Needs design | Keeping source evidence as sidecars may complicate hosted storage and audit replay. | Decide sidecar versus first-class record before hosted import storage. | Pair | future rebuild |
| DEF-IMP-03 | Canonical recurring runsheet identifiers | Low | import-session | `CONTINUATION-PROMPT.md` | Needs design | Package series labels, occurrence keys, file hashes, and user labels can conflict if not made canonical. | Pick canonical identifiers before production recurring-runsheet import. | User + pair | future rebuild |
| DEF-IMP-04 | Representation of answered import questions | Medium | import-session / audit | `CONTINUATION-PROMPT.md` | Needs design | If answers are not represented durably, the reason an ambiguous row became an action can be lost. | Choose candidate revision, supplemental citation, or audit event representation. | Pair | future rebuild |
| DEF-SHARD-01 | Metadata-first owner/map/research side-store conversion | High | shard-runtime / blob fidelity | `ROADMAP.md`; `CHANGELOG.md`; open PRs #88/#89 | Deferred | Blob-bearing side stores can still load/write too much data and remain outside the converged storage model. | Review/merge metadata-first owner and map asset PRs, then plan research-import conversion. | Pair | future rebuild |
| DEF-SHARD-02 | Per-view edit-control disabling for read-only tabs | Medium | shard-runtime / UX | `ROADMAP.md`; `docs/rebuild-plan.md` | Deferred | The banner/write gate helps, but readers can still reach edit controls unless each view is wired. | Disable or guard edit affordances in reader tabs after storage fence semantics are settled. | Codex | private beta |
| DEF-STOR-01 | Visible storage health and Backup Now UX | Medium | storage durability | `ROADMAP.md`; `SECURITY.md` | Deferred | Browser storage remains evictable and users may not know whether a durable export exists. | Add last saved, last exported, persistent-storage status, and manual backup once core shard risks are lower. | Pair | private beta |
| DEF-STOR-02 | Rolling auto-export where browser platform supports it | Medium | storage durability | `ROADMAP.md`; `SECURITY.md` | Deferred | Local-first durability still depends on manual exports. | Design file-system-access or platform-specific backup behavior behind explicit user selection. | Pair | private beta |
| DEF-STOR-03 | Project picker and multi-workspace saved-project index | Medium | storage / UX | `ROADMAP.md`; `docs/rebuild-plan.md` | Deferred | Current app still behaves like a single autosave slot, which increases accidental replacement risk. | Build a real saved-project index before a project-picker landing page. | Pair | future rebuild |
| DEF-DOC-01 | Native attorney-packet ZIP packaging | Medium | evidence-vault / packets | `ROADMAP.md`; PR #96 | In review | Packet archive generation is important evidence workflow but is not merged to main. | Review PR #96 separately; do not mix packet packaging into title-cutover fixes. | Claude + Codex review | future rebuild |
| DEF-DOC-02 | Expand entity document links beyond Desk Map nodes | Medium | doc-registry | `ROADMAP.md`; LLA-M04 | Deferred | Owner/lease/curative/research links need round-trip support before they are safe as first-class attachments. | Decide export scope and then add links surface by surface. | Pair | future rebuild |
| DEF-DOC-03 | Import-manifest previews for large document sources | Low | evidence-vault / import | `ROADMAP.md`; `docs/rebuild-plan.md` | Deferred | Large folders, ArcGIS attachments, and packets need review before import to avoid blind bulk data changes. | Add source manifest preview after vault model is explicit. | Pair | future rebuild |
| DEF-OCR-01 | Local OCR/text engine integration | Medium | evidence-vault / OCR | `ROADMAP.md`; `docs/rebuild-plan.md` | Deferred | Citation foundations exist, but no OCR tool execution or searchable artifact generation is wired. | Build local OCR/text adapters after record foundation and vault storage gates. | Pair | future rebuild |
| DEF-AI-01 | Hybrid retrieval and `CitationVerifier` UI contract | High | AI / evidence | `ROADMAP.md`; `SECURITY.md`; `docs/rebuild-plan.md` | Deferred | AI document answers remain unsafe unless material claims trace to records, source citations, math, or curative issues. | Design exact/keyword/vector/graph retrieval plus a verifier that rejects unsupported claims before display. | Pair | AI expansion |
| DEF-AI-02 | AI mutation approval UX polish without losing speed | Medium | AI UX | `ROADMAP.md`; `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md` | Deferred | Beginner users need exact diffs and validation previews for math-changing approvals. | Continue typed previews, row provenance, and blocked proposal coverage. | Pair | private beta |
| DEF-AI-03 | Persistent import ledger for staged spreadsheet rows | Medium | AI import | `ROADMAP.md`; `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md` | Deferred | Without a durable row ledger, import status and questions can be lost between sessions. | Persist import-session row status after action-layer persistence decisions. | Pair | future rebuild |
| DEF-AI-04 | In-app AI whole-project context (beyond the active desk map) | Medium | AI / context | user request 2026-06-03; `src/ai/app-context.ts`; rebuild-plan "AI Answer Contract"; relates to DEF-AI-01 | Deferred | `buildAIAppContext` scopes auto-context to the active desk map/unit (`MAX_CONTEXT_NODES = 40`); the AI can't see the whole project except via per-call tools. | Near-term: a compact whole-project structured summary projection, local-AI-first. Full: DEF-AI-01 hybrid retrieval + CitationVerifier. Hosted AI gated by LLA-M09 (context minimization). | Pair | AI expansion |
| DEF-REC-01 | Title-opinion-as-root and source-attestation workflows | Medium | import-session / records | `ROADMAP.md`; `docs/rebuild-plan.md` | Deferred | LANDroid needs a durable way to anchor title-chain assumptions to a starting opinion or prior chain. | Build after document vault and import-session foundations are reviewed. | Pair | future rebuild |
| DEF-REC-02 | `OpinionDraft`, `ObligationCalendar`, and `AbstractorPackage` projections | Medium | project records | `ROADMAP.md`; `docs/rebuild-plan.md` | Deferred | These are useful rebuild projections but should not precede record/schema/vault stability. | Design after record schema, evidence vault, and action layer are explicit. | Pair | future rebuild |
| DEF-UNIT-01 | Promote unit metadata to first-class records when needed | Low | leasehold / records | `ROADMAP.md`; `docs/rebuild-plan.md` | Deferred | Current Desk Map unit tags may be insufficient for richer operator/effective-date unit workflows. | Revisit only when unit metadata needs outgrow current tags. | Pair | future rebuild |
| DEF-COMM-01 | Template-driven communication generation | Low | product | `ROADMAP.md`; `docs/rebuild-plan.md` | Deferred | Templates could be useful, but they are not core correctness work. | Keep in later product lane until core evidence/action layers are stable. | User + pair | none |
| DEF-LEASE-01 | Lease document generator (fill blank Producers 88 from project data) | Medium | product / documents | `docs/lease-generator/` (Producers 88 template + README); user request 2026-06-02 | Deferred (prior regression) | Worked previously, then broke: entering field data reflowed the document. Root cause: the Producers 88 `.docx` has no content controls/form fields, so naive text insertion into runs reflows the layout. | Build on a structured template (content controls / merge fields) or run-preserving replacement; do not insert into raw paragraph runs. Template saved at `docs/lease-generator/`. | Pair | future rebuild |
| DEF-CMD-01 | Universal command/search and inline AI | Low | product / AI | `ROADMAP.md` | Deferred | Cross-app Cmd+K and contextual AI can add complexity before core records/search exist. | Plan after project records, retrieval, and verifier are explicit. | Pair | future product |
| DEF-DOCUX-01 | Professional three-pane Documents workflow | Low | doc-registry UX | `ROADMAP.md` | Deferred | Dense legal/eDiscovery workflow is useful but should follow vault model clarity. | Design after evidence-vault model and document round-trip scope are stable. | Pair | future product |
| DEF-BE-01 | Backend expansion beyond minimal spine | High | backend-spine / hosted | `ROADMAP.md`; `SECURITY.md`; `docs/rebuild-plan.md` | Deferred gate | Backend storage, sync, OCR/search jobs, sharing, and collaboration create custody and permission duties. | Expand only when hard triggers appear and update security, deployment, threat model, and validation in the same workstream. | Pair | hosted, future rebuild |
| DEF-FED-01 | Federal/private math expansion | High | domain math | `PROJECT_CONTEXT.md`; `ROADMAP.md`; `docs/rebuild-plan.md` | Deferred gate | Federal/private records must remain reference-only until source packets and math rules are ready. | Open only when the user explicitly starts the federal/private math gate. | User + pair | future math |
| DEF-TXMATH-01 | Texas math expansion plan | High | domain math | `ROADMAP.md`; `docs/rebuild-plan.md` | Deferred gate | NMA/DI, pooled allocation, time/depth, probate, WI, JOA, and conflict rules are high-risk title math expansions. | Plan with golden masters before implementation. | User + pair | future math |
| DEF-RRC-01 | Deeper RRC decoder coverage | Low | import / external data | `ROADMAP.md` | Deferred | Broad decoder work can sprawl before high-value file families are proven. | Add only for workflow-proven file families. | Pair | future product |
| DEF-NATIVE-01 | SQLite/OPFS/Tauri/native filesystem decision gates | Medium | runtime storage | `ROADMAP.md`; `docs/rebuild-plan.md` | Deferred gate | Premature runtime pivots can add complexity without solving current correctness risks. | Evaluate only when query/search, local OCR, native SQLite, or corpus size proves the need. | User + pair | future rebuild |

## Fixed Or Superseded Reference Items

| ID | Title | Source document | Current status | Why it is not an open backlog item |
| --- | --- | --- | --- | --- |
| P1-AI-1 | AI undo failed open when document export failed | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`; `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed / superseded | Later audit records the undo snapshot path as fail-closed with tests. |
| P1-AI-2 | Approved tool outputs were not preserved as model context | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`; `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed / superseded | Later audit records `action-journal` and `chat-context` as addressing the issue. |
| P1-AI-3 | Approval UI too thin | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`; `LINE_BY_LINE_AUDIT_2026-05-31.md` | Partial / narrowed | Typed previews and blocked previews exist; remaining material issue is LLA-H04. |
| P1-AI-5 | Runsheet staging defaulted ambiguous NPRI choices | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`; `LINE_BY_LINE_AUDIT_2026-05-31.md` | Partial / narrowed | Deterministic row staging now asks questions; direct AI mutation tools remain LLA-H04. |
| P1-MATH-1 | Focused leasehold rows included wrong unit ORRI/WI | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`; `LINE_BY_LINE_AUDIT_2026-05-31.md` | Partial / narrowed | Coded wrong-unit inclusion is fixed; null-unit repair visibility remains LLA-M06. |
| P2-DOCS-2 | Map uploads bypassed PDF hardening | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`; `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed / superseded | Later audit records extension allowlist and PDF magic-byte validation as fixed. |
| P2-HOSTED-1-tools | Hosted proxy accepted client `tools` / `tool_choice` | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`; `LINE_BY_LINE_AUDIT_2026-05-31.md` | Fixed / narrowed | Current proxy rejects `tools` and `tool_choice`; broader generic body remains LLA-M07. |
| P2-CI-2-ci-backend | CI did not validate backend packages | `AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`; current review | Fixed / narrowed | Current CI includes backend spine and AI proxy jobs; local aggregate validation remains LLA-M14. |
| AUD-M2 | Invalid explicit `deskMapId` fallback | `PATCH_PLAN.md`; current review | Fixed / superseded | Current `createRootNode` rejects missing explicit `deskMapId` and has tests. |
