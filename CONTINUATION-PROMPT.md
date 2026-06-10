# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Active Handoff - 2026-06-10

Current workstream: deep-audit delivery + documentation housecleaning.
Scope A/B of the title read cutover are MERGED (#138, #139); the prior handoff
below this one is history.

Branch: `claude/strange-payne-679e1f` (worktree; rename to a
`docs/`-prefixed branch per AGENTS.md conventions before pushing/PR).

### What this delivers

1. `docs/deep-audit-2026-06-10.md` — full audit: severity-ranked findings
   (`DA-*` IDs, every one with path:line anchors and a proposed fix), precision
   policy spec, Texas-math gap matrix, aesthetics plan, document/AI
   assessments, roadmap recommendations, Top 5. Headline: DA-C1 (Critical —
   `clearDeskMapNodes`/`deleteDeskMap` are unjournaled, so the Scope B
   store==ledger invariant is false and auto-flip should stay off), DA-H1
   (fixed NPRI charged to lessee NRI instead of burdened lessor royalty —
   attorney decision before change), DA-H2 (AI Undo erases the durable ledger).
2. Housecleaning: ROADMAP rewritten around the audit sequencing (Scope B
   hardening first); `docs/audit-backlog.md` carries a reconciliation section
   for the new findings; SECURITY.md stale claims corrected (Dexie v14, live
   write-fence with named gaps, hosted sends no tools, version-gate caveat);
   `docs/title-tree-read-cutover.md` status updated; AGENTS.md target root doc
   set reconciled to reality; `DEPLOYMENT_PLAN.md` archived to
   `docs/archive/2026/DEPLOYMENT_PLAN_2026-04-21.md`; `NEXT-audit-sheet.md`
   archived to `docs/archive/prompts/audit-sheet-export-brief.md` (feature
   still wanted — pointer in ROADMAP Next); rebuild-plan Phase 7 carries the
   audit's staged math order; the misleading SSN comment in
   `src/types/lease-purchase-report.ts` now states SSN is unimplemented.

### Validation

Docs-only plus one comment-only `.ts` edit. Full vitest suite was verified
green on this tree before the audit (979 tests / 140 files, Springhill
0.225/0.775, Phase 0 goldens). `tsc --noEmit` after the comment edit: see the
latest commit message for the result.

### Next steps (in order)

1. Open the housecleaning PR; review the audit report alongside it.
2. Start ROADMAP "Now" item 1 (Scope B hardening): DA-C1 journal coverage +
   test, flip default-off, DA-H2 undo hydration. Good Codex tickets with
   Claude review; ultra-gate the ledger changes.
3. Schedule the DA-H1 fixed-NPRI question with the title attorney; no Phase 7
   math expansion before that decision.

### Process note (keep)

A prior session pushed to `main` by accident (commands ran in the root checkout
on `main`). Work only in a dedicated worktree via explicit `git -C <worktree>`;
never run a bare `git push`; push only the feature branch; open a PR and stop
for review.
