# LANDroid — Continuation Prompt

Use this file to resume work in a new chat.

## Paste This Into A New Chat

I am working in `/Users/abstractmapping/projects/landroid`.

Before making architectural decisions, read:
- `/Users/abstractmapping/projects/landroid/AGENTS.md`
- `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`
- `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`

Current repo state:
- Active branch: `codex/maps-research-rrc-handoff`
- Latest pushed baseline behind this branch: `a148dcc` (`chore: promote active app to repository root`)
- `main` is the trusted baseline and points to commit `afbdb93`
- Safety branches kept on purpose: `baseline-afbdb93`, `v2-desk-map-interactions-and-resize`
- Active app is the repository root
- The repository root is both the app surface and the repo-level coordination layer
- The active branch for current work is `codex/maps-research-rrc-handoff`
- This branch is intended to carry the current source/docs handoff snapshot for the `Maps` / `Research` split, pending-permit decoder, and chat-transition checklist

User preferences and working style:
- The user is fairly new and wants careful, reversible changes
- Do not blindly agree; give honest feedback and tradeoffs
- Be methodical, phased, and incremental
- Do not clean up unrelated files unless asked
- Do not remove `/Users/abstractmapping/projects/landroid/TORS_Documents/`
- Keep the UX readable and low-clutter for non-technical use
- The user is happy with the current flowchart paper-size and centered-import behavior for now
- The user thinks the current desk-map math is good for now and wants the next phase to focus on audit/review
- The user wants desk-map owner actions kept inside the node detail flow rather than crowding the card buttons

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
- Added a new `Owners` workspace surface for owner, lease, contact, and owner-document tracking
- Owner data is now workspace-scoped and included in `.landroid` exports/imports
- Added a structured `Maps` workspace for PDF/image/GeoJSON reference assets with metadata and links to desk maps, nodes, owners, and leases
- Refactored the map workspace into a featured-map `Maps` surface with `Present` and `Edit` modes
- Added workspace-scoped map regions and external reference links so image-based prospect maps can carry clickable story areas and saved outside links
- Added a separate `Research` workspace for RRC dataset cataloging and imported research files
- Added node-to-owner linking through the `Owner Record` section in the Desk Map node edit modal

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
- `/Users/abstractmapping/projects/landroid/src/store/owner-store.ts`
- `/Users/abstractmapping/projects/landroid/src/store/map-store.ts`
- `/Users/abstractmapping/projects/landroid/src/store/research-store.ts`
- `/Users/abstractmapping/projects/landroid/src/views/DeskMapView.tsx`
- `/Users/abstractmapping/projects/landroid/src/views/OwnerDatabaseView.tsx`
- `/Users/abstractmapping/projects/landroid/src/views/MapsView.tsx`
- `/Users/abstractmapping/projects/landroid/src/views/ResearchView.tsx`
- `/Users/abstractmapping/projects/landroid/docs/architecture/rrc-import-readability.md`
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
- Do not disturb the current flowchart behavior unless the audit finds a concrete issue that requires it
- Owner, map, and research data now ride along with `.landroid` saves; CSV imports intentionally reset those sidecar records for the new workspace
- `Maps` is now the map-first presentation surface: PDFs can be featured and previewed, while clickable region overlays currently start with PNG/JPG exports
- `Research` is now the RRC-oriented staging surface for official dataset families and imported files
- `Research` now includes a first structured decoder path for `Drilling Permits Pending Approval`, joining the core permit, wellbore, and lat/long TXT files into a readable preview
- Neither `Maps` nor `Research` is direct ArcGIS Pro functionality or a live GIS renderer
- The user wants the selected map to dominate the page, with supporting controls staying secondary
- The user wants to keep pushing deeper on RRC imports and decoding, especially for difficult legacy formats like EBCDIC
- There is now a repo note at `/Users/abstractmapping/projects/landroid/docs/architecture/rrc-import-readability.md` summarizing which RRC families are readable now, which need fixed-width parsers, which need EBCDIC conversion first, and which are GIS/archive-heavy
- The user has now installed the recommended Mac-side toolchain for PDF/GIS/OCR/data work, including Poppler, GDAL/OGR, ExifTool, ImageMagick, Tesseract, Ghostscript, `uv`, `duckdb`, QGIS, DB Browser for SQLite, LibreOffice, and Inkscape
- Latest validation on this handoff branch passed with:
  - `npm test`
  - `npm run lint`
  - `npm run build`

Chat-switch checklist:
1. Make sure the current work is on a non-`main` branch.
2. If the user wants a checkpoint, commit the relevant source/docs changes and push that branch.
3. Update this file with:
   - current branch
   - meaningful completed work
   - validation status
   - open risks / local noise
   - likely next steps
4. Leave generated build artifacts and unrelated local noise out of the checkpoint unless the user explicitly wants them.
5. Start the next chat by pointing the assistant to:
   - `/Users/abstractmapping/projects/landroid/AGENTS.md`
   - `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`
   - `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`
6. Paste a short task-focused prompt instead of trying to reconstruct everything from memory.

Strategic product direction:
- The user wants the map/research surface to grow from a small, polished demo into a much more capable long-term product without needing a rewrite later.
- Build a strong engine with a simple UI: “Ferrari engine, easy dashboard.”
- The first versions should stay presentation-friendly for non-landmen while leaving room for deeper analyst workflows later.
- Prefer a general map/presentation foundation over a one-off PDF hack:
  - asset layer
  - overlay / annotation layer
  - link layer to tracts, owners, leases, docs, and runsheet records
  - interaction layer for click / hover / filters / drawers
  - view layer for presentation mode vs edit mode vs analyst mode
- The likely long-term direction is a map-first workspace where the main prospect map opens first, users can click a region/section, and a simple side panel explains that area in plain language.
- Short-term map support can start with PDF/image display plus manually drawn regions.
- Geometry and links should be stored in a way that can later support richer overlays, GeoJSON, georeferencing, and more advanced spatial workflows.
- The product should favor role-oriented views:
  - presentation / executive
  - land / analyst
  - edit / builder
- Inspiration patterns worth reusing:
  - Enverus map + title context
  - LandmanAssistant tract / ownership / document workflow
  - Airtable-style role-specific interfaces
  - Mappedin-style map-first discovery
  - Bluebeam-style PDF markup discipline
  - ArcGIS Experience Builder-style click-to-panel interactions

RRC integration direction:
- This is a small internal product for a team of roughly 2-3 people, not a marketed enterprise platform right now.
- Favor realistic, low-ops, low-risk RRC integration.
- Do not depend on scraping the live RRC query UI as a core product behavior.
- Prefer a staged RRC approach:
  1. safe deep links and manual lookup helpers
  2. import/caching of official downloadable RRC datasets
  3. later overlays and linked RRC context inside LANDroid
- The user wants to explore RRC integration because it could make the product much more compelling for demos, but the first releases should stay lightweight and dependable.

Likely next steps to choose from:
1. Manually click through the new `Maps` and `Research` workflows in the browser
2. Improve the region editing UX beyond rectangular starter boxes and numeric coordinate cleanup
3. Extend the RRC decoder pattern to the next highest-value ASCII family after pending permits
4. Evaluate a phased RRC integration plan using official datasets / links instead of fragile live-query scraping

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
I am working in `/Users/abstractmapping/projects/landroid` on branch `codex/maps-research-rrc-handoff`.

Before making architectural decisions, read:
- `/Users/abstractmapping/projects/landroid/AGENTS.md`
- `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`
- `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`

Current focus:
- ownership + maps + research foundations have been implemented on top of the root-app layout
- `Research` now has a first structured decoder path for `Drilling Permits Pending Approval`
- the next phase is likely either better map-first UX or the next RRC decoder family
- the user wants room for a much more capable long-term engine, but with a simple UX for a small 2-3 person team
- RRC integration should be explored through realistic, low-risk paths

Start by:
1. Inspecting the current branch/worktree state
2. Re-reading the strategic product direction in `CONTINUATION-PROMPT.md`
3. Checking the current handoff branch and validation status
4. Proposing the next phased plan before implementing

Do not start broad implementation until the next phase plan is approved.
```
