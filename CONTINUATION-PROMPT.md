# LANDroid — Continuation Prompt

Use this file to resume work in a new chat.

## Paste This Into A New Chat

I am working in `/Users/abstractmapping/projects/landroid`.

Before making architectural decisions, read:
- `/Users/abstractmapping/projects/landroid/AGENTS.md`
- `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`
- `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`

Current repo state:
- Active branch: `codex-v2-flowchart-stress-handoff`
- Latest pushed commit on this branch: `24be137` (`feat: export runsheets and harden desk map ownership math`)
- `main` is the trusted baseline and points to commit `afbdb93`
- Safety branches kept on purpose: `baseline-afbdb93`, `v2-desk-map-interactions-and-resize`
- Active app is the repository root
- The repository root is both the app surface and the repo-level coordination layer
- The branch is currently synced with `origin/codex-v2-flowchart-stress-handoff`

User preferences and working style:
- The user is fairly new and wants careful, reversible changes
- Do not blindly agree; give honest feedback and tradeoffs
- Be methodical, phased, and incremental
- Do not clean up unrelated files unless asked
- Do not remove `/Users/abstractmapping/projects/landroid/TORS_Documents/`
- Keep the UX readable and low-clutter for non-technical use
- The user is happy with the current flowchart paper-size and centered-import behavior for now
- The user thinks the current desk-map math is good for now and wants the next phase to focus on audit/review

Recent completed work:
- Verified the active app is now rooted directly in `/Users/abstractmapping/projects/landroid`
- Added launcher scripts at `/Users/abstractmapping/projects/landroid/LANDroid.command` and `/Users/abstractmapping/projects/landroid/LANDroid.bat`
- Improved flowchart proportional scaling so cards resize as real geometry instead of CSS `zoom`
- Added ELK as the main ownership-tree layout engine with fallback to the older layout
- Added custom ownership edge rendering so on-canvas connectors scale better with the chart
- Fixed print connector drift by making print use the same shared edge geometry as the live canvas
- The user confirmed: print is fixed
- Flowchart now excludes related documents and imports conveyances only
- Added independent horizontal and vertical flowchart spacing controls
- Fixed spacing reflow so it respects current card scale instead of blowing the chart back up
- Centered flowchart import/root placement so the top node lands centered and the tree branches more evenly
- Added saved ANSI and Arch paper sizes for the flowchart canvas and print path
- `Fit to Grid` now resizes within the current paper/grid instead of auto-adding pages
- Stress test now builds separate tract desk maps with larger samples (`100`, `150`, `200` visible cards)
- Title Ledger / Runsheet now supports tract filtering while still showing all tracts by default
- Stress tabs were restyled closer to the production look and the `Demo` button was removed
- Runsheet display order was changed to: Instrument, File Date, Instrument Date, Vol./Pg., Grantor, Grantee, Interest, Land Desc., Remarks
- Added runsheet export to `.xlsx` based on the user's existing external workbook structure, including the `TORS_Documents\\{docNo}.pdf` path formula
- Added the `xlsx` dependency and lazy-loaded the export chunk so it does not ship in the main startup bundle
- Desk-map delete now removes a conveyed branch and restores the deleted amount back to the original grantor/parent instead of silently losing it
- Fraction storage/display math was hardened so repeated small conveyances preserve more precision and exact finite decimals reduce to cleaner fractions like `1/1024`
- Added subtle visual emphasis for desk-map nodes that still retain interest
- Final validation was run with `npm test`, `npm run lint`, and `npm run build`
- The branch was committed and pushed to GitHub as `24be137`

Important files involved in the recent work:
- `/Users/abstractmapping/projects/landroid/src/views/FlowchartView.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/canvas/CanvasToolbar.tsx`
- `/Users/abstractmapping/projects/landroid/src/views/RunsheetView.tsx`
- `/Users/abstractmapping/projects/landroid/src/storage/runsheet-export.ts`
- `/Users/abstractmapping/projects/landroid/src/storage/__tests__/runsheet-export.test.ts`
- `/Users/abstractmapping/projects/landroid/src/engine/decimal.ts`
- `/Users/abstractmapping/projects/landroid/src/engine/fraction-display.ts`
- `/Users/abstractmapping/projects/landroid/src/engine/math-engine.ts`
- `/Users/abstractmapping/projects/landroid/src/engine/__tests__/fraction-display.test.ts`
- `/Users/abstractmapping/projects/landroid/src/engine/__tests__/math-engine.test.ts`
- `/Users/abstractmapping/projects/landroid/src/store/workspace-store.ts`
- `/Users/abstractmapping/projects/landroid/src/views/DeskMapView.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/deskmap/DeskMapCard.tsx`

Intentional local items to keep:
- `/Users/abstractmapping/projects/landroid/TORS_Documents/`
- `/Users/abstractmapping/projects/landroid/LANDroid.command`
- `/Users/abstractmapping/projects/landroid/LANDroid.bat`
- `/Users/abstractmapping/projects/landroid/.claude/`

Known local noise:
- `.DS_Store` is modified locally and was intentionally left out of the push
- `dist-node/` may contain generated build output from validation
- Do not delete anything destructively unless the user asks

Current status:
- The user is happy with the current flowchart paper-size/import-centering behavior for now
- Manual cleanup after import is acceptable; the layout does not need to “read their mind”
- The current runsheet export is in a good place for now; copy/paste into the external sheet is acceptable
- The user thinks the desk-map math is good for now after the delete-restore and precision work
- The next phase should be a full audit of the pushed snapshot before more feature work
- Do not disturb the current flowchart behavior unless the audit finds a concrete issue that requires it

Likely next steps to choose from:
1. Audit commit `24be137` in review-only mode first, without making fixes during the first pass
2. Re-run baseline validation on that snapshot with `npm test`, `npm run lint`, and `npm run build`
3. Review math/invariants, persistence/import-export, desk-map + flowchart + runsheet UX/safety, performance/bundle size, and repo hygiene
4. Deliver a findings-first report grouped into `must fix before merge`, `should fix soon`, and `later hardening`
5. Only after the audit, decide whether the next implementation task should be safety UX, audit visibility, or another desk-map/flowchart improvement

Good starting commands:

```bash
cd /Users/abstractmapping/projects/landroid
git status --short --branch
git log --oneline --decorate -3

npm test
npm run lint
npm run build
./LANDroid.command
```

Validation commands:

```bash
cd /Users/abstractmapping/projects/landroid
npm test
npm run lint
npm run build
```

Important constraints:
- Work only inside this repository
- Prefer small, reversible change sets
- Reuse existing helpers and patterns
- Validate after each meaningful change group
- Report exact validation commands and outcomes
- For the audit, make findings the primary output; keep summaries brief
- If no issues are found in an area, say that explicitly and note any residual risk or testing gap

Suggested first message in the new chat:

```text
I am working in `/Users/abstractmapping/projects/landroid` on branch `codex-v2-flowchart-stress-handoff`.

Before making architectural decisions, read:
- `/Users/abstractmapping/projects/landroid/AGENTS.md`
- `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`
- `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`

Current pushed snapshot to audit:
- commit `24be137` on `origin/codex-v2-flowchart-stress-handoff`
- the user is happy with the current flowchart paper-size / centered-import behavior
- the current runsheet export is fine for now
- the current desk-map math is good for now

Start by:
1. Inspecting the current branch/worktree state
2. Re-running baseline validation from the repository root
3. Proposing a full audit plan against commit `24be137`
4. Then conducting the audit in review-first mode, with findings prioritized by severity and grouped into `must fix before merge`, `should fix soon`, and `later hardening`

Do not start implementing fixes during the first audit pass unless the user explicitly asks.
```
