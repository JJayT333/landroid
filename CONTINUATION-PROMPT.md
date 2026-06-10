# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Active Handoff - 2026-06-10 (end of audit/research session)

This branch (`claude/strange-payne-679e1f`, worktree, NEVER PUSHED) holds:
the Part 1 + Part 2 deep audits (`docs/deep-audit-2026-06-10.md`, `-part2.md`),
doc housecleaning, the rewritten `ROADMAP.md`, the research prompts, and the
complete external TXM research corpus (`docs/research/txm-catalog-round-{1,2,3}.md`,
including the three-CSV import appendix in round 3). Suite was verified green
before the audit (979 tests / 140 files; Springhill 0.225/0.775; Phase 0
goldens intact). Docs-only + comment-only changes since.

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

STEP 0 — Land this branch (first hour):
1. Scrub waived (see operator decisions above); the branch lands as-is with
   no history rewrite.
2. Rename the branch per conventions (e.g. `docs/deep-audit-and-research`),
   push, open the PR (squash), merge. Everything this session produced lands.

STEP 1 — Scope B hardening (the Critical lane; Codex tickets + Claude review;
ultra-gate the ledger changes). From `docs/deep-audit-2026-06-10.md` §1:
- DA-C1: journal `clearDeskMapNodes` + `deleteDeskMap`; add the
  journal-coverage test (every store action touching nodes/deskMaps must fire
  the hook); set `cutoverEnabled` back to false until that test is green.
- DA-H2: `restoreSnapshot`/`loadWorkspace` hydrate-then-append instead of
  erasing the title ledger (`undoTitleActionRecord` exists, unused).
- DA-H3: journal hook returns a verdict; rolled-back mutations return failure
  and skip cascades; hook exceptions stop being swallowed.
- DA-M15: fence title-ledger Dexie writes + project rename/delete behind the
  write lease. DA-M14: lease heartbeat interval.
Exit: coverage test green, soak on Springhill, THEN the flip may re-arm.

STEP 2 — Evidence integrity + precision (parallel-safe with Step 1 review):
- DA-H6: export ALL workspace documents (not node-joined); DA-H7: recompute
  SHA-256 on import + verify on export + blank-hash backfill. Simpler now —
  no legacy-file cases.
- DA-H10: csv-io parses fractions via Decimal + serialize (kills the float64
  round-before-store).
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
