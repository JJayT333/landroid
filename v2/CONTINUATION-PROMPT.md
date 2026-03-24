# LANDroid v2 — Continuation Prompt

Use this file to resume work in a new chat.

## Paste This Into A New Chat

I am working in `/Users/abstractmapping/projects/landroid`.

Before making architectural decisions, read:
- `/Users/abstractmapping/projects/landroid/AGENTS.md`
- `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`

Current repo state:
- Active branch: `codex-v2-flowchart-stress-handoff`
- `main` is the trusted baseline and points to commit `afbdb93`
- Safety branches kept on purpose: `baseline-afbdb93`, `v2-desk-map-interactions-and-resize`
- Active app is `v2/`
- The root repo still contains important repo-level files, but the app we are developing is `v2`

User preferences and working style:
- The user is fairly new and wants careful, reversible changes
- Do not blindly agree; give honest feedback and tradeoffs
- Be methodical, phased, and incremental
- Do not clean up unrelated files unless asked
- Do not remove `v2/TORS_Documents/`

Recent completed work:
- Verified `v2` is a standalone app and not dependent on the parent app code
- Added a launcher script at `/Users/abstractmapping/projects/landroid/v2/LANDroid-v2.command`
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

Important files involved in the recent flowchart/print work:
- `/Users/abstractmapping/projects/landroid/v2/src/views/FlowchartView.tsx`
- `/Users/abstractmapping/projects/landroid/v2/src/engine/tree-layout.ts`
- `/Users/abstractmapping/projects/landroid/v2/src/engine/flowchart-metrics.ts`
- `/Users/abstractmapping/projects/landroid/v2/src/engine/flowchart-pages.ts`
- `/Users/abstractmapping/projects/landroid/v2/src/components/canvas/OwnershipNode.tsx`
- `/Users/abstractmapping/projects/landroid/v2/src/components/canvas/OwnershipEdge.tsx`
- `/Users/abstractmapping/projects/landroid/v2/src/components/canvas/ownership-edge-geometry.ts`
- `/Users/abstractmapping/projects/landroid/v2/src/components/canvas/PrintOverlay.tsx`
- `/Users/abstractmapping/projects/landroid/v2/src/components/canvas/PageGrid.tsx`
- `/Users/abstractmapping/projects/landroid/v2/src/components/canvas/CanvasToolbar.tsx`
- `/Users/abstractmapping/projects/landroid/v2/src/types/flowchart.ts`
- `/Users/abstractmapping/projects/landroid/v2/src/components/canvas/__tests__/ownership-edge-geometry.test.ts`
- `/Users/abstractmapping/projects/landroid/v2/src/engine/__tests__/tree-layout.test.ts`
- `/Users/abstractmapping/projects/landroid/v2/src/engine/__tests__/flowchart-pages.test.ts`
- `/Users/abstractmapping/projects/landroid/v2/src/storage/seed-test-data.ts`
- `/Users/abstractmapping/projects/landroid/v2/src/storage/__tests__/seed-test-data.test.ts`
- `/Users/abstractmapping/projects/landroid/v2/src/views/RunsheetView.tsx`
- `/Users/abstractmapping/projects/landroid/v2/src/components/deskmap/DeskMapTabs.tsx`
- `/Users/abstractmapping/projects/landroid/v2/src/components/shared/Navbar.tsx`

Intentional local items to keep:
- `/Users/abstractmapping/projects/landroid/v2/TORS_Documents/`
- `/Users/abstractmapping/projects/landroid/v2/LANDroid-v2.command`
- `/Users/abstractmapping/projects/landroid/.claude/`

Known local noise:
- `v2/dist/` and `v2/dist-node/` may contain generated build output from validation
- Do not delete anything destructively unless the user asks

Current status:
- The user is happy with the current flowchart paper-size/import-centering behavior for now
- Manual cleanup after import is acceptable; the layout does not need to “read their mind”
- Do not disturb the current flowchart behavior unless the next task clearly requires it

Likely next steps to choose from:
1. De-emphasize or reduce the `COL` / `ROW` controls now that paper size is the primary canvas sizing tool
2. Make `Resize All` scale from the chart center so manual whole-chart resizing matches the new centered import / fit behavior
3. Revisit the Runsheet tract filter UX if the current button row feels too busy for larger tract counts
4. Move the stress-entry control out of the main navbar once the production UI is settled

Good starting commands:

```bash
cd /Users/abstractmapping/projects/landroid/v2
./LANDroid-v2.command
```

Validation commands:

```bash
cd /Users/abstractmapping/projects/landroid/v2
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

Suggested first message in the new chat:

```text
Read AGENTS.md and PROJECT_CONTEXT.md first. Then read v2/CONTINUATION-PROMPT.md and inspect the current branch state. The flowchart paper-size and centered-import work is in a good place for now. Start by proposing the safest next step from the continuation file without disturbing the current flowchart behavior unless necessary.
```
