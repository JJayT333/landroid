# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Active Handoff - 2026-06-30 (backlog cleared; Missing Link + staleness sweep)

`main` is current through **#235** (LPR Phase 3). Everything in the sections below
this one is dated history; this section is the authoritative current state.

**Merged this session:** the **Missing Link** placeholder node — a `type:'conveyance'`
node flagged `provenance:'placeholder'` standing in for an unproven chain gap (an
unestablished heirship or a missing deed). It is a full pass-through the engine treats
as a computation barrier — it never fabricates a fraction below it (per-node
`indeterminate` default vs `assume` pass-through toggle), raises a High `Missing link`
curative issue that gates transfer-order payout via the existing curative machinery,
and is additive + gated on `isPlaceholderNode` so recorded-node math stays
byte-identical (baseline byte=0 on all three oracles). Key files:
`src/title-math/model/placeholder.ts`, `src/store/workspace-store.ts`
(`insertMissingLink` / `resolveMissingLink` / `setPlaceholderPassthrough`),
`src/components/modals/InsertMissingLinkModal.tsx`, and the dashed-amber card in
`OwnershipNode.tsx` / `DeskMapCard.tsx`. Reviewed by a 4-lens adversarial pass; the
undo/redo + delete curative-consistency findings were fixed.

**Also this session — a staleness sweep** corrected stale title-cutover wording.
**TRUE cutover state (verify from code, not comments):** governance is ARMED at boot
(`src/main.tsx` calls `setTitleCutoverArmed(true)`, #144, after the Springhill soak
completed 2026-06-10). The flip itself still requires the readiness gates green THIS
session (`sessionParityCount` resets to 0 each load) PLUS a manual banner click;
`readPathMode` starts `shadow` every session; revert is always available. A fresh load
showing "shadow / not enough parities" is EXPECTED, not a disarmed flip.

**Open lanes (both gated, neither urgent):** Map multi-designation UI (needs sign-off
on the #214 plat look first); hosted-AI hardening (gated on a hosted beta — no hosted
users yet). **Genuinely-open backlog, all correctly deferred:** DA-M5 unratified
tract-basis payout math (pending counsel), ACT-H05 (make divergence a visible warning
that blocks cutover candidacy), DA2-F3 (re-import wipes annotations once drawing tools
are wired). No open blockers.

**Verify:** `npm run lint` (tsc), `npm test`, `npm run baseline:check` (byte=0),
`npm run build`. The three elkjs-`?url` test suites (`tree-layout`, `flowchart-scale`,
`view-helpers`) only fail under a local sandbox asset guard; CI on GitHub is
authoritative for them.

## Active Handoff - 2026-06-15 (unified title-math merged; "do it all" program)

The unified title-math engine is MERGED and LIVE on `main` (PR #180, `16cdd1e`).
It re-architected all title math into one engine under `src/title-math/` — the
four old modules (`engine/math-engine.ts`, `components/leasehold/leasehold-summary.ts`,
`components/deskmap/deskmap-coverage.ts`, `engine/tree-layout.ts`) are now thin
re-export SHIMS, so consumers are unchanged — and shipped the cleared +
attorney-nuanced math: DA-H1 (fixed NPRI satisfied from the lessor royalty first,
excess to WI, `fixedNpriExceedsRoyalty` counsel warning), DA-M1 (over-conveyance
booked-with-warning + `Over-conveyance` title issue, never rejected), DA-M5 (NPRI
ratification tri-state + transfer-order hold; legacy=ratified, new=unknown), Van
Dyke double-fraction verbatim capture (engine never auto-multiplies), unleased-
mineral payout rows, and Stage-B 9dp quantization of leasehold/coverage finals.
An independent adversarial review confirmed the numbers (hand-recompute + a
reconstructed pre-rewrite oracle); all findings are fixed (the one real bug: an
over-conveyance warning could be lost on a failed DB write — now surfaces via
`lastError`). Validation: 1235 tests green, `tsc` clean, `npm run build` clean,
the differential clean.

HARNESS CAVEAT (do not over-trust green): post-cutover the differential baseline
is a self-consistency / reproducibility LOCK, not an old-vs-new differential (the
two engine bundles resolve to the same code; baselines were re-frozen from this
engine). A green `--check new` does NOT prove correctness — the port verification
(done before cutover, against the real old engine), the unit suites, the hand-
verified anchors in `springhill-sample.test.ts`, and the review do. See the
labels in `scripts/title-math-baseline.ts`.

The attorney has APPROVED the DA-H1 excess rule + the pending round-3/Van Dyke
questions — the legal gate is cleared. NEXT: the "do it all" backlog program
(5 waves, one PR per concern; plan in `~/.claude/plans/make-a-plan-to-glistening-lantern.md`):
W1 hygiene + DA-H1 wording + Stage-G shim teardown + small defects (IN PROGRESS);
W2 title-ledger trust lane (DA-H4/H5/M3/ACT-H01); W3 Documents pro-grade +
Maps/3D-chooser (real WGS84 GeoJSON in hand) + Curative requirement model +
Audit-sheet export; W4 research/intake; W5 Texas-math long-tail. Deferred per
existing gates: federal/private math, hosted-AI hardening, RRC ingestion,
OCR/AI-doc-QA.

## Active Handoff - 2026-06-13 (Step 2 + display-correctness merge session)

All Step 2 hardening lanes and the display-correctness fixes are now MERGED to
`main`: DA-H7 part-3 backfill (#155), DA-H10 CSV Decimal precision (#156),
DA-M16 auto-export retention (#157), DA-H9 Map-mode ORRI branch-card (#158), and
the Flowchart Miro-class rebuild incl. DA-H8 (#159). DA-U1 broken-token bugs are
already fixed (tokens added, `text-gold-950` gone, `theme-tokens.test.ts` CI
guard). Integration verified on the combined tree: `tsc --noEmit` clean, full
vitest suite green (154 files / 1158 tests). NEXT candidates: the DA-U1 §5
aesthetics consolidation (Button/focus standard, mono+tabular numeric
typography, pill/tab + table kit), the `display-format` precision-policy sweep
(DA-M6/M7 tooltips), and the Research-workspace hardening lane (DA2-R1/R2)
before the title-math catalog import. See ROADMAP "Now" items 3–5.

## Active Handoff - 2026-06-10 (post-soak features session)

Scope B is DONE end-to-end: #141 hardening + review fixes, #142/#143 soak
fixes, #144 cutover ARMED at boot (flip = manual banner click once gates are
green), #145/#146 soak UX — all merged and deployed. Title UNDO is
implemented on `feat/title-undo` (journaled inverse restores + cascade
bundles + navbar button/Cmd+Z; see docs/title-tree-read-cutover.md "Manual
undo") — PR pending operator review. NEXT: the aesthetics pass (DA-U1 lane:
broken tokens, Button standard, mono+tabular numeric typography for the
overflowing coverage fractions, pill/tab + table kit), plan-first. Then
Step 2 per the list below (DA-H6/H7 evidence integrity, DA-H10 precision).

## Prior handoff - 2026-06-10 (Scope B hardening session)

STEP 0 is DONE: the audit/research branch landed as PR #140 (squash-merged to
main as `a0bb913` — Part 1 + Part 2 deep audits, doc housecleaning, rewritten
ROADMAP, research prompts, TXM catalog rounds 1-3). STEP 1 is IMPLEMENTED on
`feat/scope-b-hardening` (eight commits + docs; suite 1049 tests / 144 files
green; Springhill 0.225/0.775 and Phase 0 goldens untouched — no math files
changed). The PR awaits operator review (ultra review offered) — after merge:
operator Springhill soak, THEN the cutover re-arm (one line,
`setTitleCutoverArmed(true)`) as its own reviewed change.

## Operator decisions now in force

- Rebuild-first, hard mode: single user, breakage acceptable. Golden masters,
  MathInputView parity, and `.landroid` round-trip REMAIN as correctness
  evidence (not user protection) — keep green or update deliberately.
- Legacy `.landroid` compatibility is NOT a constraint. The only file that
  matters is the bundled Springhill sample (+ the Phase 0 fixture). v7/v8
  legacy paths may be deleted opportunistically, each behind a deliberate
  golden/fixture update (the v7 migration golden would be retired, not
  silently broken).
- CONFIDENTIALITY SCRUB WAIVED (operator decision, 2026-06-10): the planned
  pre-push scrub of the federal project's acreage figure and footprint
  references was waived; the operator chose to land the branch as-is with the
  repo's public visibility surfaced and accepted. Any future sharing happens
  from a separate repo.

## Plan for the next session — START HERE

STEP 0 — DONE (PR #140 merged; scrub waived per operator decisions above).

STEP 1 — IMPLEMENTED on `feat/scope-b-hardening`, awaiting review/merge.
Closed: DA-C1 (eight title-visible actions journaled — the audit's two plus
six more the coverage gate found: createDeskMap-with-members, the two
addNodeToDeskMap variants, and attach/detach/reorder attachments, since
deskMapIds and attachments[0].docId project into title records; the
journal-coverage test is the permanent CI invariant; cutover flip DISARMED by
default), DA-H3 (journal verdict + rollback-aware mutators + no swallowed
hook errors), DA-H2 (AI undo hydrates-then-appends via undoTitleActionRecord;
importAndOpenWorkspace owns import ledger hydration), DA-M15 (ledger writes +
project rename/delete/duplicate fenced; reader hydration memory-only),
DA-M14 (writer heartbeat at TTL/3 with visibility pause).
Exit gate remaining: operator review + merge → Springhill soak → re-arm the
flip (one line: `setTitleCutoverArmed(true)`) as its own reviewed change.

STEP 2 — Evidence integrity + precision (parallel-safe with Step 1 review):
- DA-H6: export ALL workspace documents (not node-joined); DA-H7 import/export
  SHA-256 verification is merged. DA-H7 blank-hash backfill is implemented on
  `fix/da-h7-content-hash-backfill`: startup runs a non-blocking,
  self-extinguishing repair for legacy Dexie document rows with
  `contentHash: ''`, owner-attached and unattached document round-trip coverage
  is added, and the tracked public Springhill sample hashes were refreshed so
  it imports with no fixity warning. Validation status: `npm run lint`,
  targeted storage/Springhill tests, `npm test`, and `npm run build` passed.
- DA-H10: implemented on `fix/da-h10-csv-exact-fractions`: csv-io parses
  fractions via the strict Decimal interest parser + `serialize`, so `1/3`
  stores at 24 significant digits while `1/2` remains byte-identical. CSV
  fractions greater than 1 and `Number()` artifacts such as `0x10` now reject.
  Validation status: `npm run lint`, targeted CSV tests, `npm test`, and
  `npm run build` passed.
- DA-M16: implemented on `fix/da-m16-auto-export-retention`: rolling
  auto-export keeps the 10 newest strict timestamped snapshots for the current
  project name after a successful write; hand-named/foreign/backup files and
  failed writes are never deletion triggers. Validation status: `npm run lint`,
  targeted rolling-auto-export tests, `npm test`, and `npm run build` passed.
- Precision policy: `src/engine/display-format.ts` (four functions, audit §3),
  mechanical sweep of ad-hoc formatters, ESLint guard.

STEP 3 — Research lane (prepares the math work; no engine changes):
- DA2-R1 (rollback-on-failed-save) + DA2-R2 (documentId links on research
  records) — the receiving surface must be safe first.
- Build the CANONICAL TXM master index in-repo (three rounds use three id
  schemes — see round-2/round-3 intake notes; canonical = round-3 index,
  mapped to R1/R2 by name). Then the CSV importer for round 3's appendix
  (sources/formulas/questions, dedup-by-title, all Needs Review).
- Texas descent & distribution QUICK REFERENCE card in Research (by death-date
  era: pre/post 9/1/1993 fork, community vs separate, family shapes, worked
  trees; NM analog with 1959/1973 transitions) — source material: rounds 1-3
  probate packs. Operator explicitly wants this human-readable, not only
  automated.
- Schedule the attorney session: DA-H1 (fixed NPRI out of lessor royalty;
  excess case), the 10 questions in round 3 CSV 3, and the two Mar-2026
  Van Dyke events (Clifton vs Eastland remand).

PRODUCT PRINCIPLE (operator directive, 2026-06-10, governs all Step 4+ work):
the user must be able to enter incorrect/conflicting information when the
records require it — warn, never hard-block. Stop-and-ask gates block silent
COMPUTATION, never SAVING. Where the tree model cannot structurally hold an
over-claim (e.g., conveying more than a parent's remainder), capture the
instrument's stated value verbatim alongside the booked value and surface the
divergence as a warning + title issue — do not silently cap (this refines
DA-M1's fix) and do not reject the record. Structural invariants (negative
fractions, cycles, non-finite) remain hard blocks.

STEP 4 — Math expansion. THE DA-H1 GATE IS CLEARED (operator decision,
2026-06-10) — DA-H1 may be implemented as soon as Step 1 lands; the rest of
the attorney queue (round-3 CSV 3 questions, Mar-2026 Van Dyke events) is
still pending but blocks nothing in this step.

DA-H1 DECISION OF RECORD: a fixed NPRI is satisfied out of the LESSOR'S
royalty, not the working interest; when the fixed NPRI exceeds the lease
royalty, the NPRI owner still collects in full, the lessor's royalty is
exhausted to zero, and the EXCESS is charged to the WI (lessee took with
record notice subject to the prior burden; proportionate-reduction clauses
do not cover royalty burdens; Duhig does not transplant to leases; the
lessee's warranty claim is economics, not allocation). Division-order form:
  lessor RI = max(royalty − fixedNPRI, 0)   [floating already nets first]
  WI NRI    = 1 − max(royalty, fixedNPRI)   [per burdened share]
Caveat preserved as product behavior: the basic reduction rule is settled;
the EXCESS allocation rests on treatise consensus (Smith & Weaver), not
squarely on-point SCOTX authority — so the existing `overBurdened`-style
flag becomes a `fixedNpriExceedsRoyalty` warning per slice/tract whose
wording recommends counsel sign-off before payout reliance (warning-only,
per the entry principle above; never block).
Implementation sketch: in `leasehold-summary.ts`, net each slice's fixed
burden against remaining slice royalty after floating
(coveredByRoyalty = min(fixedBurden, max(royalty − floatingBurden, 0));
excess = fixedBurden − coveredByRoyalty); extend the owner net rows
(`:1007-1023`) to subtract coveredByRoyalty; feed ONLY the excess into the
NRI-side deduction (`:554`, `:1083-1102` input). Multiple stacked fixed
NPRIs on one branch: apply senior-first by instrument date (confirm
stacking order with counsel if a real tract ever hits it — flag, don't
guess). New golden fixtures: (a) 1/4 lease + 1/16 fixed → 3/16 / 1/16 / 3/4;
(b) 1/8 lease + 1/4 fixed → 0 / 1/4 / 3/4 + warning flag; regenerate
`demo.leasehold-decimals.json` deliberately; Springhill's asserted
leasedOwnership/weightedRoyaltyRate/nriBeforeOrriRate values are
NPRI-independent and must NOT change.
- Then one slice at a time per ROADMAP: over-conveyance stop-and-ask (DA-M1,
  removes the silent cap) → double-fraction input (verbatim clause + BOTH
  readings, never auto-multiplied — Van Dyke) → intake flags (round-2 list:
  pre-1980 "/8" double fraction, subject-to, state-lands, AOH-derived,
  allocation well) → NPRI ratification tri-state → unleased-owner rows.
- Federal register fields (reference-only, no math gate needed): persist
  FederalLeaseDocument fields + stipulations (DA2-FED1/2), AND add lease
  ISSUE DATE as a first-class field — round 3 TXM-070: three federal royalty
  regimes key off it (pre-8/16/2022 12.5% / IRA 16.67% / OBBB ≥7/4/2025 12.5%).

PARALLEL LANE (anytime, touches no math files; good solo-Codex ticket):
- Flowchart F-Phase 1 (part-2 §3): wire the built-but-dead shape tools,
  fix the lasso (`panOnDrag=[1,2]`), merge-import preserving annotations,
  restore viewport, PNG export.

DEFERRED but decided: aesthetics token fixes (DA-U1 is real bugs — broken
Tailwind tokens); curative transfer-order holds (DA2-C2, golden-safe);
GIS/RRC lanes per ROADMAP Next; everything else in `docs/audit-backlog.md`.

### Validation
Per-step: targeted tests + the goldens. The journal-coverage test (Step 1) is
the new permanent invariant. Springhill 0.225/0.775 must survive every step
except the deliberate DA-H1 update, which changes fixtures by intent with the
attorney's sign-off recorded in the PR body.

### Process note (keep)
Work only in a dedicated worktree via explicit `git -C <worktree>`; never run
a bare `git push`; push only the feature branch; open a PR and stop for
review. Ultra-review is reserved for ledger/storage/math-engine/export-format
changes.
