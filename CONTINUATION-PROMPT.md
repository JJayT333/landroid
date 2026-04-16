# LANDroid — Continuation Prompt

Use this file to resume work in a new chat. Read together with `AGENTS.md` and `PROJECT_CONTEXT.md` before touching code.

## Active context — 2026-04-16

- Active branch: `claude/musing-satoshi`
- Current workstream: **UX overhaul** against the Raven Forest prospect (Sam Houston NF, Walker/Montgomery Counties, TX)
- Plan file (this session): `/Users/abstractmapping/.claude/plans/playful-waddling-jellyfish.md`
- Jurisdictional scope unchanged: Texas-only for math; Federal/BLM stays reference-only per `PROJECT_CONTEXT.md`

## Recently completed

- Federal Leasing view as a first-class workspace (Inventory / Targets / Expirations / Maps / Sources) sharing the Research project-record backbone
- Research source workspace refresh: home tiles, review queue, cross-library search, formula starters
- Playwright coverage extended to lease export/deletion and the Federal Leasing workflow

## UX overhaul — phased rollout (9 commits)

1. Phase 0 — docs trim, delete `FULL-AUDIT-PROMPT.md`, shrink this file
2. Phase 3 — navbar: remove stress/leasehold demo buttons, move Save/Load into a File dropdown, move Combinatorial into a Demo Data dropdown, inline-editable project name; retarget Playwright specs to the new 10-tract seed
3. Phase 1 — DeskMap card tinting: remove Present Owner / Leased pills, sky-tint present-owner cards, deeper sky when leased, NPRI-red override unchanged
4. Phase 2 — AttachLeaseModal mineral-only gate + defensive guard in `leaseSummaryByNodeId`
5. Phase 4a — `DeskMap.unitName` / `unitCode` optional fields + persistence normalizer
6. Phase 4b — Combinatorial 10-tract Raven Forest Unit A (Texas Energy Acquisitions LP) + Unit B (Lone Star Minerals LLC); DeskMapTabs grouped by unit; T3/T7/T9 error tracts; T10 ~500-node kitchen sink
7. Phase 6 — Additive merge into `formula-starters.ts` (16 existing + 16 new foundational cards) + Landman Resources link panel in ResearchView
8. Phase 5 — Seed 5 federal lease records (TXNM100132133/129751/115442/120954/121986) + `LeaseDocumentModal` structured BLM Form 3100-11 summary
9. Phase 7 — global polish: collapsible Desk Map toolbar, hover chips, modal audit, empty states, button hierarchy
10. (Deferred) Phase 8 — `pptxgenjs` + `scripts/build-deck.ts` for the 12-slide walkthrough; spawned as a separate follow-up task

## Validation status

- Baseline before the overhaul: `npm run build` clean, `npm test` = 321/321 pass, Playwright not yet re-run this session
- Each commit must keep `npm run build` clean and unit tests passing; Playwright runs after commits 2, 6, and 8

## Open risks

- Replacing the 8-tract combinatorial seed with 10 tracts + unit fields ripples into `landroid-workflows.spec.ts` and `USER_MANUAL.md`; both are updated inside the same commit as the seed rewrite
- New DeskMap `unitName` / `unitCode` fields are optional with a backward-compat fixture test; pre-overhaul `.landroid` files load unchanged
- Formula merge uses `foundation-*` keys to avoid collision with the existing 16 starter keys
- Stress and Leasehold demo seeders are deleted outright (not hidden behind a dev flag); tests are retargeted to the Combinatorial seed

## Likely next steps after this branch merges

- Phase 8 PPTX deck as a standalone task (install `pptxgenjs`, write `scripts/build-deck.ts`, commit `docs/LANDroid_Walkthrough.pptx`)
- Revisit Federal Leasing document attachment (currently the modal renders a structured summary; PDF upload hook remains for future)
- Review whether Unit A/B grouping should graduate to a real `LeaseholdUnit` link once federal math scope opens

## Paste-ready resume prompt

> Resume the LANDroid UX overhaul on `claude/musing-satoshi`. Read `AGENTS.md`, `PROJECT_CONTEXT.md`, and `CONTINUATION-PROMPT.md` first. Run `npm install && npm run build && npm test` to confirm baseline. Honor Texas-only math scope and the Federal-Leasing-as-reference posture. Work in small, reversible commits.

## Intentional local noise (not part of the source checkpoint)

- `.claude/`
- `TORS_Documents/`
- generated `dist/`, `dist-node/`, `playwright-report/`, `test-results/` artifacts
- `.DS_Store`
