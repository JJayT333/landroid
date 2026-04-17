# LANDroid — Continuation Prompt

Use this file to resume work in a new chat. Read with `AGENTS.md` and `PROJECT_CONTEXT.md` before touching code.

## Active context — 2026-04-17

- Active branch: `claude/musing-satoshi` (9 commits ahead of `origin/landroid-4-16-checkpoint`).
- UX overhaul against the Raven Forest prospect (Sam Houston NF, Walker/Montgomery Counties, TX) is **complete on this branch**. Push and open a PR before starting the next workstream.
- Jurisdictional invariants unchanged: Texas-only for leasehold math; Federal/BLM stays reference-only.

## What landed (in commit order)

1. `Phase 0` — handoff doc trim, deleted `FULL-AUDIT-PROMPT.md`.
2. `Phase 3` — Navbar cleanup: removed stress/leasehold demo seeders, Save/Load into a File dropdown, Combinatorial into a Demo Data dropdown, inline-editable project name; Playwright specs retargeted to the 10-tract seed.
3. `Phase 1` — DeskMap card tinting: Present Owner / Leased pills retired in favor of sky-50/100 background tinting plus inline `✓ Leased` text; NPRI-red override preserved.
4. `Phase 2` — `AttachLeaseModal` mineral-only gate plus defensive `interestClass !== 'mineral'` guard in `leaseSummaryByNodeId`.
5. `Phase 4a` — Optional `DeskMap.unitName` / `unitCode` fields with backward-compatible persistence normalizer.
6. `Phase 4b` — Combinatorial 10-tract Raven Forest seed: Unit A C1–C5 / Texas Energy Acquisitions LP, Unit B C6–C10 / Lone Star Minerals LLC. T3/T7/T9 error tracts, T10 kitchen-sink (~250 nodes). DeskMapTabs grouped by unit with error-dot indicators.
7. `Phase 6` — `formula-starters.ts` additive merge (16 existing + 16 new foundation- starters across 5 new categories); Landman Resources panel in ResearchView (Texas Regulatory, Federal/BLM, National Forest TX, Title/Math Reference, County Records).
8. `Phase 5` — Five Raven Forest TXNM federal lease records seeded into `useResearchStore` alongside Combinatorial data; `LeaseDocumentModal` renders a structured BLM Form 3100-11 summary keyed off an in-memory `FederalLeaseDocument` registry.
9. `Phase 7` — Collapsible Desk Map toolbar with `ℹ` hint; modal audit / empty-state / button-hierarchy spot-checks already met spec.

## Verification

- `npm run build` and `npx vitest run` (338 tests) green on every commit.
- Playwright was retargeted in Commit 2 — re-run `npx playwright test` if the next session touches the Combinatorial seed flow or DeskMap tabs.

## Next session

1. Push: `git push -u origin claude/musing-satoshi` and open a PR titled `LANDroid UX overhaul — Raven Forest`.
2. Then spawn the **Phase 8 deck task** (separate session): install `pptxgenjs`, write `scripts/build-deck.ts`, generate `docs/LANDroid_Walkthrough.pptx` with 12 slides per the original prompt.

## Reference

- Plan file: `/Users/abstractmapping/.claude/plans/playful-waddling-jellyfish.md`
- Domain reference: `LANDMAN-MATH-REFERENCE.md`, `PROJECT_CONTEXT.md`, `AGENTS.md`

## Paste-ready resume prompt

> Resume the LANDroid `claude/musing-satoshi` branch. Read `AGENTS.md`, `PROJECT_CONTEXT.md`, and `CONTINUATION-PROMPT.md` first. Run `npm install && npm run build && npm test` to confirm baseline. Texas-only math scope; Federal/BLM stays reference-only. Work in small, reversible commits.
