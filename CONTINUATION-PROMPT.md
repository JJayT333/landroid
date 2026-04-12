# LANDroid — Continuation Prompt

Use this file to resume work in a new chat.

## Latest product update — 2026-04-12

This section supersedes older branch/status bullets below when they conflict.

- Active branch / GitHub branch for this checkpoint: `codex/curative-cha-cha-slide`
- Branch base before this Curative change set: `5b813c8` (`feat: add leasehold map and npri discrepancy review`)
- Curative change set has been committed on `codex/curative-cha-cha-slide`; use that branch as the GitHub checkpoint for the next chat.
- New top-level app surface added: `Curative`
  - persistent title issue / curative tracker for Texas landman review
  - issue types include NPRI discrepancy, over-conveyance, missing lease, missing ratification, probate / heirship, bad legal description, name mismatch, unreleased lien, unrecorded assignment, title opinion requirement, and other
  - each issue tracks priority, status, affected tract / Desk Map, affected branch/card, affected owner, affected lease, source doc number, required curative action, responsible party, due date, working notes, and resolution notes
  - search and filters can find issues by owner, tract, branch, lease, issue language, document number, responsible party, status, or priority
  - `Open Desk Map` jumps from a linked issue back to the affected tract and branch
  - curative issues remain warning-only workflow records; they do not block title-building edits
  - deleting a linked owner, lease, tract, or branch keeps the issue but clears the stale link so the issue is not silently lost
- Persistence/export work added:
  - new `TitleIssue` model and normalization in `/Users/abstractmapping/projects/landroid/src/types/title-issue.ts`
  - new Dexie table `titleIssues` in `/Users/abstractmapping/projects/landroid/src/storage/db.ts`
  - new curative persistence/store in `/Users/abstractmapping/projects/landroid/src/storage/curative-persistence.ts` and `/Users/abstractmapping/projects/landroid/src/store/curative-store.ts`
  - `.landroid` export/import now includes `curativeData`
  - CSV imports start with an empty curative workspace, matching owner/map/research side-record behavior
- User-facing docs updated:
  - `/Users/abstractmapping/projects/landroid/README.md`
  - `/Users/abstractmapping/projects/landroid/USER_MANUAL.md`
  - this file
- Broader Texas/company-readiness backlog added to the running list after Curative:
  - lease admin calendar and clause flags
  - division order, pay status, and suspense workflow
  - pooling / unit document package
  - RRC well and GIS integration
  - document OCR and clause extraction
  - advanced interests: executive rights, life estates, term minerals, NPI, BIAPO
  - enterprise audit trail and reviewer signoff
- Validation for this change set:
  - `npx vitest run src/types/__tests__/title-issue.test.ts src/store/__tests__/curative-store.test.ts src/storage/__tests__/workspace-persistence.test.ts src/views/__tests__/view-helpers.test.ts` passed (`20/20`)
  - `npm run lint` passed
  - `npm test` passed (`290/290`)
  - `npm run build` passed
- Intentional local noise still present and not part of the active source/docs change set:
  - `.DS_Store`
  - `.claude/`
  - `TORS_Documents/`
  - generated `dist/` and `dist-node/` artifacts from validation
- Open risks / likely follow-ups:
  - browser-QA the new `Curative` tab with a real NPRI discrepancy, missing probate/heirship item, and title-opinion requirement
  - decide whether red NPRI discrepancy warnings should get a one-click "Create Curative Issue" action from Desk Map
  - decide whether Curative should eventually feed payout readiness / hold status directly into Leasehold transfer-order rows
  - decide whether title issues need document attachments of their own or should keep pointing to owner docs / node PDFs for now
  - user still needs to review the approved markdown archive cleanup later when time allows

## Paste This Into A New Chat — Curative QA / Next Slice

```text
I am working in `/Users/abstractmapping/projects/landroid` on branch `codex/curative-cha-cha-slide`.

Before making architectural decisions, read:
- `/Users/abstractmapping/projects/landroid/AGENTS.md`
- `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`
- `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`

Current focus:
- browser-QA the new `Curative` title issue / curative tracker
- verify `.landroid` save/load keeps curative issues and links
- test real-world issue examples: NPRI discrepancy, missing probate/heirship, missing ratification, bad legal description, and title-opinion requirement
- keep the workflow warning-only for title-building edits
- do not start federal/BLM Phase 2 work
- do not commit generated `dist/`, `dist-node/`, `.DS_Store`, `.claude/`, or `TORS_Documents/`

Good first checks:
1. Run `git status --short --branch`
2. Review the latest 2026-04-12 section in `CONTINUATION-PROMPT.md`
3. Start LANDroid with `npm run dev`
4. Open `Curative`, create a few title issues, link them to a tract/branch/owner/lease, save, export `.landroid`, reload, and confirm links survive
5. If QA looks good, consider adding a Desk Map action that creates a Curative issue from an NPRI title-discrepancy warning
```

## Latest audit update — 2026-04-11

This section supersedes older branch/status bullets below when they conflict.

- Active branch for the current checkpointed work: `codex/texas-baseline-checkpoint-2026-04-10`
- Latest GitHub branch to continue from after this push: `codex/texas-baseline-checkpoint-2026-04-10`
- Previous pushed checkpoint on that branch before the April 11 push: `b811e59` (`feat: checkpoint texas baseline audit and leasehold review`)
- Deliverable 1 verification completed on this branch:
  - `npm run lint` passed
  - `npm test` passed (`261/261`)
  - `npm run build` passed
  - direct combinatorial runtime validation passed with `1119` nodes and no ownership-graph issues
  - repo-wide federal grep in `src/` stayed limited to the allowed jurisdiction discriminator, comments, and tests
- Actual baseline miss found and fixed:
  - the ORRI working-interest formula was already correct
  - but the tract-summary field was still exposed as `workingInterestBaseRate`
  - this audit pass renamed the app-facing field to `nriBeforeOrriRate` in:
    - `/Users/abstractmapping/projects/landroid/src/components/leasehold/leasehold-summary.ts`
    - `/Users/abstractmapping/projects/landroid/src/components/leasehold/__tests__/leasehold-summary.test.ts`
    - `/Users/abstractmapping/projects/landroid/src/views/LeaseholdView.tsx`
- New deliverable artifact written:
  - `/Users/abstractmapping/projects/landroid/LANDMAN-MATH-REFERENCE.md`
- Approved markdown cleanup completed:
  - archived `AUDIT_PROMPT.md`, `AUDIT_REPORT.md`, `REWRITE_PLAN.md`, `docs/architecture/audit-remediation-plan.md`, and `docs/architecture/ownership-math-reference.md` under `/Users/abstractmapping/projects/landroid/docs/archive/`
  - deleted `docs/phase-gate-checklist.md`
  - refreshed `FULL-AUDIT-PROMPT.md`, `README.md`, and surviving code comments to point at the live doc set
- User follow-up note:
  - the user approved the cleanup but has not had time to review it yet; keep a reminder in the next chat to confirm the archive layout and live-doc set before calling the documentation pass fully signed off
- Next Texas-baseline hardening landed after the audit:
  - `Lease.status` is no longer a free-text math input
  - new lease edits now use the canonical Texas-baseline status list: `Active`, `Expired`, `Released`, `Terminated`, `Inactive`, `Dead`
  - coverage math now keys off the shared status classifier in `/Users/abstractmapping/projects/landroid/src/types/owner.ts`
  - legacy non-canonical status text is preserved instead of being silently discarded
  - validation after this status-normalization pass was green: `npm run lint`, `npm test` (`271/271`), and `npm run build`
- Additional leasehold math correction landed after that:
  - multiple NRI-basis ORRIs now stack one by one in effective-date order instead of being flattened into one combined carve
  - Leasehold ORRI cards now tell the user that effective date controls NRI stacking when multiple NRI burdens hit the same tract
  - Leasehold now consumes fixed and floating NPRIs end-to-end: floating NPRIs burden lease royalty, fixed NPRIs burden gross leased production, NPRI rows now show up in the deck and transfer-order ledger, and fixed NPRIs reduce the NRI base before NRI-basis ORRIs are calculated
  - Leasehold overview/deck UI now shows NPRI decimals directly, including a read-only NPRI lane, tract-level NPRI burden metrics, and warning surfaces for floating-NPRI over-carves
  - validation after the full fixed/floating NPRI pass was green: `npx vitest run src/components/leasehold/__tests__/leasehold-summary.test.ts`, `npm run lint`, `npm test` (`275/275`), and `npm run build`
- Latest follow-up work after the NPRI payout pass:
  - floating-NPRI over-carves now keep unit-focus payout readiness on `Hold` in the transfer-order review surface while editing and title-building remain warning-only
  - ready transfer-order rows now display as held while that payout-hold condition exists, and new unit-focus payout rows default into `Hold` instead of `Ready`
  - the `Owners` left rail now has local `Search` and `Sort By` controls so long owner lists can be filtered by owner/lease text and sorted by name, county, prospect, active lease count, or recent activity without changing store persistence order
  - `Leasehold` now has a full-size `Map` mode that keeps the payout picture separate from Desk Map title: unit overview at the root, tracts as the first branches, and a focused tract detail map that expands into owner branches, lease slices, branch-bound NPRIs, plus separate tract-level ORRI and WI branches
  - the graph helper now links NPRIs to the burdened mineral branch by node ID, so unleased branches can still show tracked NPRIs even when they are not yet included in payout math
  - added targeted helper coverage in `/Users/abstractmapping/projects/landroid/src/views/__tests__/view-helpers.test.ts`
  - validation after the first embedded graph pass was green: `npx vitest run src/views/__tests__/view-helpers.test.ts`, `npm run lint`, `npm test` (`278/278`), and `npm run build`
  - latest follow-up pivots that smaller graph into a full-page map canvas inside `Leasehold`, matching the scale of `Desk Map` while keeping the title and leasehold stories separate
  - validation after the full-size map pivot is green: `npm run lint`, `npx vitest run src/views/__tests__/view-helpers.test.ts`, `npm test` (`278/278`), and `npm run build`
- Latest Desk Map/demo-fixture follow-up after that:
  - the combinatorial `8 x 100` sample now uses conventional person names with unique owner-card grantee names across the full fixture, making the demo much easier to scan during land/title review
  - `Desk Map` now has a `Find Mineral Owner` search box in the floating toolbar; typing a name jumps to the matching mineral-owner card, automatically switches tract tabs when the match lives on another desk map, and shows a clickable results list beneath the search box for quick selection
  - added helper coverage for the new Desk Map search matcher and for combinatorial-name uniqueness
  - validation after this Desk Map/search pass is green: `npx vitest run src/storage/__tests__/seed-test-data.test.ts src/views/__tests__/view-helpers.test.ts`, `npm run lint`, `npm test` (`280/280`), and `npm run build`
- Latest NPRI deed-basis follow-up after that:
  - fixed NPRIs now carry a second discriminator, `fixedRoyaltyBasis`, so LANDroid can distinguish a fixed fraction of the burdened branch from a fixed fraction already stated against whole tract production
  - Desk Map NPRI create/edit cards now ask for that deed basis, fixed-NPRI leasehold math now applies the matching formula, and fixed whole-tract NPRIs can be entered even when they exceed the grantor's branch share
  - NPRI branch over-claims are now warning-only: the affected Desk Map mineral branch and NPRI cards turn red, and the toolbar shows an NPRI title-discrepancy warning so the issue is visible until title is reconciled
  - fixed whole-tract NPRIs now stay whole-tract based through the seeded combinatorial demo as well, so the C3-style “1/16 and 1/32 of the whole” examples still read correctly
  - the convey modal now labels inherited fixed NPRI branches as branch-based or whole-tract fixed burdens so the user can see what is being split
  - validation after the red-branch discrepancy pass is green: `npx vitest run src/engine/__tests__/math-engine.test.ts src/components/leasehold/__tests__/leasehold-summary.test.ts src/storage/__tests__/seed-test-data.test.ts src/views/__tests__/view-helpers.test.ts`, `npm run lint`, `npm test` (`283/283`), and `npm run build`
- Important handoff corrections versus older notes:
  - `FULL-AUDIT-PROMPT.md` had gone stale about finding `#1` (lease-overlap warnings), finding `#4` (strict leasehold parsing), and finding `#9` (over-burden warning); the cleanup pass refreshed it to match the current code
  - `FULL-AUDIT-PROMPT.md` also claimed the `workingInterestBaseRate -> nriBeforeOrriRate` rename had already landed; it had not, and this pass finished it
  - the old internal math note and remediation-plan docs are now archived under `/Users/abstractmapping/projects/landroid/docs/archive/`
- Open risks / likely next steps:
  - the April 11 checkpoint push should include the intentional source/docs/test work only; do not confuse it with local generated build output or machine-local folders
  - the user still needs to review the approved markdown cleanup later when time permits
  - verify the new fixed-NPRI deed-basis handling against the company's preferred reviewer format, especially whether “of whole tract” versus “of burdened branch” matches how the company wants deeds abstracted in payout review
  - browser-QA the red Desk Map NPRI discrepancy highlight by entering an over-branch NPRI and confirming the branch/card warning is obvious enough
  - if the owners list still feels crowded after search/sort, the next likely follow-up is grouping or saved filters rather than more store-level sorting logic
  - the next likely leasehold-map follow-up is richer expansion controls or saved map focus once the first hierarchy gets browser QA
- Intentional local noise still present and not part of the audit deliverable:
  - `.DS_Store`
  - `.claude/`
  - `TORS_Documents/`
  - generated `dist/` and `dist-node/` artifacts from validation

## Paste This Into A New Chat

I am working in `/Users/abstractmapping/projects/landroid`.

Before making architectural decisions, read:
- `/Users/abstractmapping/projects/landroid/AGENTS.md`
- `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`
- `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`
- `/Users/abstractmapping/projects/landroid/FULL-AUDIT-PROMPT.md` for the next comprehensive math / architecture audit

For the next audit pass, use the full user audit brief in `FULL-AUDIT-PROMPT.md` together with this handoff file. Do not substitute a shortened version.

Audit quickstart:
- Verify the repo's actual stack from `/Users/abstractmapping/projects/landroid/package.json`, `/Users/abstractmapping/projects/landroid/vite.config.ts`, `/Users/abstractmapping/projects/landroid/src/main.tsx`, and `/Users/abstractmapping/projects/landroid/src/App.tsx` before accepting any prompt assumptions about React tooling, Tailwind setup, or JS vs TypeScript.
- For the latest math, lease-sync, and owner-to-desk-map changes, start with:
  - `/Users/abstractmapping/projects/landroid/src/engine/math-engine.ts`
  - `/Users/abstractmapping/projects/landroid/src/engine/__tests__/math-engine.test.ts`
  - `/Users/abstractmapping/projects/landroid/src/components/leasehold/leasehold-summary.ts`
  - `/Users/abstractmapping/projects/landroid/src/components/deskmap/deskmap-coverage.ts`
  - `/Users/abstractmapping/projects/landroid/src/components/deskmap/deskmap-lease-node.ts`
  - `/Users/abstractmapping/projects/landroid/src/store/workspace-store.ts`
  - `/Users/abstractmapping/projects/landroid/src/store/owner-store.ts`
  - `/Users/abstractmapping/projects/landroid/src/views/DeskMapView.tsx`
  - `/Users/abstractmapping/projects/landroid/src/views/RunsheetView.tsx`
  - `/Users/abstractmapping/projects/landroid/src/views/OwnerDatabaseView.tsx`
  - `/Users/abstractmapping/projects/landroid/LANDMAN-MATH-REFERENCE.md`
  - `/Users/abstractmapping/projects/landroid/FULL-AUDIT-PROMPT.md`

Current repo state:
- Active branch: `codex/texas-baseline-checkpoint-2026-04-10`
- Active app is the repository root: `/Users/abstractmapping/projects/landroid`
- The repository root is both the app surface and the repo-level coordination layer
- The April 11 push should already contain the Texas-baseline audit cleanup, leasehold hardening, full-size Leasehold Map, Desk Map owner search/results list, fixed/floating NPRI payout layer, fixed-NPRI deed-basis discriminator, and warning-only red NPRI discrepancy highlights
- Do not commit local generated/noise paths unless explicitly requested: `.DS_Store`, `.claude/`, `TORS_Documents/`, `dist/`, and `dist-node/`

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
- The user is actively testing prospect branding, including a top-left logo and a small full-color prospect mark in the top nav next to `Desk Map`

Recent completed work:
- Added direct `Desk Map Lease Node` actions to saved lease cards in `Owners`, so a lease can now create or reopen its linked Desk Map lessee node from the owner record without manually finding the parent owner card first
- Extended the shared node-editor routing so owner-side lease actions can target a specific lease record when opening the Desk Map lease modal, instead of always falling back to the primary lease for that owner
- Hardened the math engine to reject zero/blank/non-numeric mutation inputs for convey, rebalance, predecessor insert, and attach operations instead of silently normalizing them to zero-value branches
- Added an extra validation invariant that related nodes must carry zero ownership fractions, and expanded math regression coverage for root predecessor inserts plus the stricter invalid-input cases
- Added a shared ownership-node editor layer so `Desk Map` and `Runsheet` now open the same node edit modal, lease modal, NPRI modal, and PDF viewer path instead of maintaining separate edit flows
- Added explicit `Edit` actions to `Runsheet`, so title rows can now reopen the same info cards used in `Desk Map` directly from the chronology table
- Added shared node-editor routing so lease rows reopen the lease / lessee modal through the parent mineral-owner node while ordinary title rows still open the node edit modal
- Hardened lease-record sync so editing a lease in `Owners` now refreshes any linked Desk Map lease node and Runsheet lease row text from the canonical lease record
- Raised the Desk Map toolbar overlay above the pan/zoom canvas so `+ Add Root` is clickable again instead of being swallowed by the drag surface cursor layer
- Eliminated the recurring large `FlowchartView` chunk warning by splitting React Flow into its own lazy vendor chunk and switching ELK layout loading to the small API entry plus worker asset instead of bundling the giant ELK runtime into the view chunk
- `FlowchartView` now builds as a small lazy chunk, with ELK loaded separately through `src/engine/tree-layout.ts` and `vite.config.ts`
- Excluded Markdown docs from Tailwind v4 source scanning through `src/theme/index.css`, which removed the recurring CSS warning caused by bracketed audit-doc text like `[file:line]`
- Repaired Desk Map `Add Root` so it now recovers from stale or missing active-tract state instead of silently adding an invisible root node
- Reworked leasehold math so multiple active leases per owner now aggregate correctly in Desk Map coverage, Leasehold tract rows, and transfer-order royalty rows instead of collapsing to one primary lease
- Expanded leasehold ORRI support to include gross `8/8`, working-interest, and net-revenue-interest burden bases in the actual tract/unit math
- Split owner acreage output into gross-acre `Net Mineral Acres` and pooled-acre `Net Pooled Acres`, and renamed the tract royalty labels to better distinguish lease royalty, owner tract royalty, and unit royalty decimal
- Added a root application error boundary so render or lazy-load failures now land on a recovery screen instead of a blank app shell
- Expanded the dedicated `Leasehold (8 Tracts)` demo to eight clean-fraction tracts with fully leased present owners, replacing the older mixed-percentage demo fixture
- Fixed `executeAttachConveyance` so moving a branch now refunds the old parent before debiting the new parent, preserving same-class branch totals during reattachment
- Hardened `validateOwnershipGraph` so it now flags under-allocation as well as over-allocation, closing the validator blind spot that let leaked branch value pass as valid
- Hardened persistence and startup recovery:
  - `.landroid` import now rejects invalid ownership graphs instead of just malformed top-level payloads
  - saved workspace loads now validate ownership graphs before hydration
  - saved workspace/canvas load now return `missing` vs `loaded` vs `corrupt`
  - startup shows a visible warning banner when corrupt autosave data is ignored in favor of a safe fresh state
- Strengthened ownership-node normalization for persisted/imported payloads so numeric/text/enum fields are normalized more predictably before validation
- Added regression coverage for attach refund behavior, under-allocation detection, invalid ownership-graph import rejection, and corrupt persisted-canvas parsing
- Added a canonical ownership math reference, now superseded by `/Users/abstractmapping/projects/landroid/LANDMAN-MATH-REFERENCE.md`, that separates source-grounded rules, repo math, and known gaps for future tooling/AI use
- Added a merged audit remediation plan, now archived at `/Users/abstractmapping/projects/landroid/docs/archive/audit-remediation-plan.md`, that ranks accepted fixes by severity and calls out which findings from `AUDIT_REPORT.md` should not be adopted as-is
- Reviewed trusted external sources for the math reference, including Texas statutes, Texas Supreme Court oil-and-gas cases, the Texas Railroad Commission, EIA glossary definitions, Montana State Extension royalty-decimal examples, and the Oklahoma State / Texas AgriLife / National Agricultural Law Center handbook
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
- Stress test now builds separate tract desk maps with larger samples (`100`, `150`, `500` visible cards)
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
- Fixed the broken split layouts in `Owners`, `Maps`, and `Research` so those workspaces render as intended again
- Made Desk Map PDF viewing self-heal when a node attachment is missing by storing a bundled fallback PDF before opening it
- Switched Desk Map seed PDFs to bundled in-repo assets sourced from `TORS_Documents/` instead of brittle direct browser fetch paths
- Filled out stress Desk Map nodes with more consistent metadata, doc numbers, conveyance fields, and obituary fields
- Tightened Desk Map render scope by memoizing tree branches/cards, localizing active-card subscriptions, and replacing repeated node/owner scans with lookup maps
- Pushed the stress fixture names, operators, assignment grantees, and obituary flavor further into intentionally absurd territory for easier visual QA
- Added prospect branding assets under `src/assets/branding/`, restored the LANDroid logo in the top-left header, and added a very faded raven backdrop to Desk Map for the Raven Forest demo test
- Added a readable table preview path for `}`-delimited RRC TXT imports so pending-permit text files no longer have to be read as raw delimiter jumble
- Hardened the pending-permit parser so matching header rows are skipped instead of being treated like data rows
- Hardened `Research` metadata editing so import title/family/notes changes stay local until `Save Details`
- Narrowed pending-permit decode reruns so ordinary note/title edits no longer reread and re-decode the same file set
- Swapped `Research` dataset reassignment from free-text live edits to a safer saved dataset-family picker
- Replaced the main workspace/canvas autosave hot path with cheap reference/primitive change detection instead of full `JSON.stringify` snapshots on every store update
- Hardened `Maps` reference links so plain domains normalize to `https://...`, unsupported schemes are blocked, and rendered external links use safer new-tab attributes
- Hardened `.landroid` import parsing so malformed top-level payloads fail clearly and imported desk-map/map-reference/canvas data is normalized instead of trusted wholesale
- Reduced the eager startup bundle by moving tiny React Flow array helpers out of the always-loaded canvas store, pushing that weight back into the already-lazy Flowchart chunk where it belongs
- Converted the Raven Forest Desk Map art from a full background wash into a subtle bottom-right watermark and lazy-loaded `Runsheet` / `Owners` so they no longer ride in the startup bundle
- Moved the Raven Forest prospect mark out of the Desk Map canvas and into the shared top navigation next to `Desk Map` so it stays visible across pages
- Added a reusable fixed-width RRC parser seam under `src/research/`
- Added a structured `Research` decoder for `Drilling Permit Master` / `Drilling Permit Master and Trailer`, including core fixed-width status/permit rows plus surface and bottom-hole coordinate attachment when present
- Promoted the `Drilling Permit Master` families to preview-ready in the dataset catalog and updated docs to match
- Added a structured `Research` decoder for `Horizontal Drilling Permits`, using the published 360-character fixed-width row layout
- Added top-left Desk Map coverage totals for `Found in Chain`, `Linked Owners`, and `Leased`
- Added clearer Desk Map owner-versus-lessee presentation so the current mineral owner stays distinct from the lessee
- Added a first Desk Map lease action that creates or reopens a distinct lease node without changing mineral ownership math
- Corrected the seed and stress fixtures so `Oil & Gas Lease` records are separate lease overlays instead of final ownership conveyances, while keeping a leased subset for UI testing
- Added a Texas-first leasing/title-model note to `PROJECT_CONTEXT.md`, clarifying that assignments and ORRIs belong primarily on the lessee/leasehold side while NPRIs belong primarily on the mineral-fee/lessor side
- Added explicit `royalty` and `leased interest` lease fields so the Desk Map lessee node and the `Owners` lease tab all read from the same lease record
- Fixed a blank-screen regression caused by legacy saved lease records that predated the new `royalty` / `leased interest` fields, by normalizing lease data on load/import and hardening the Desk Map lease render path
- Moved Desk Map lease access out of the owner-card hover actions and into the mineral-owner edit modal, removed inline lessor terms from the mineral-owner card, and promoted the lessee lease record from an inline related chip into its own terminal Desk Map node card
- Added a first Desk Map NPRI workflow: present-interest mineral owners can now create fixed or floating NPRI branches from the node edit modal
- Added dedicated NPRI node metadata so royalty branches stay visible and conveyable on Desk Map without reducing the mineral ownership totals
- Kept the top-left Desk Map coverage cards mineral-only, so NPRIs do not change `Found in Chain`, `Linked Owners`, or `Leased`
- Made the multi-root Desk Map workflow explicit: separate starting families can now be added in the same tract, temporary over-100 mineral coverage remains allowed, and the coverage panel now keeps overage visible as provisional instead of styling it as balanced
- Cleaned up the stress/sample fixtures by removing assignment-heavy Desk Map cards, replacing them with broader deed variation plus supplemental lease variation
- Tightened math/store normalization so new NPRI nodes, rebalances, deletes, and subsequent conveyances stay compatible with the existing branch invariants
- Added a first `Leasehold` workspace surface that derives pooled participation, owner net acres, and total royalty from the current Desk Maps plus active lease records
- Added tract-level `gross acres`, `pooled acres`, and `description` fields to Desk Maps, plus persisted unit metadata, with normalization across autosave, `.landroid`, and CSV import paths
- Added a dedicated `Leasehold (8 Tracts)` demo seed with eight tracts at `80`, `160`, `240`, `320`, `400`, `480`, `560`, and `640` acres, assorted conveyances, shared unit metadata, and 100% lease coverage for every present owner at `1/8`
- Added pure leasehold summary math coverage so the new Leasehold tab can stay derived from Desk Map title plus `Owners` lease data instead of introducing duplicate persisted calculations
- Added leasehold-side ORRI records with explicit burden-basis capture, gross `8/8` ORRI burden math, and pre-WI NRI summary totals
- Added an internal `Overview | Deck` split inside `Leasehold`, so the same tab can now host a card-based leasehold board without pushing WI / assignments back into Desk Map or adding another top-level tab
- Built the first `Leasehold` `Deck` UI locally on top of that split: tract/unit focus pills, a lessee anchor card, ORRI cards using the Desk-Map-style visual language, and placeholder lanes for later WI / decimal work
- Added the first real leasehold-side WI assignment layer: persisted assignment records, retained-vs-assigned WI summary math, over-assignment protection, editable assignment cards in the `Deck`, and starter demo assignments in the leasehold demo workspace
- Replaced the `Decimals / Transfer Orders` placeholder with a derived decimal ledger in `Leasehold` `Deck`, showing lease royalty, ORRI, retained WI, and assigned WI rows for the current unit or tract focus
- Turned that read-only decimal ledger into a first transfer-order review surface, including focus coverage checks, variance rollups, source-readiness badges, and royalty-row lease effective date / doc number detail when available
- Decided WI over-assignment stays warning-only for the current v1 deck flow, and made the transfer-order review surface call that out explicitly while retaining the clamped-zero retained-WI math
- Added the first persisted transfer-order row model: unit-focus payout-entry rows can now save owner number, status, and notes on top of the derived decimal rows, while tract focus stays review-only

Important files involved in the recent work:
- `/Users/abstractmapping/projects/landroid/src/views/FlowchartView.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/canvas/CanvasToolbar.tsx`
- `/Users/abstractmapping/projects/landroid/src/views/RunsheetView.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/shared/OwnershipNodeEditorModals.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/owners/OwnerLeasesTab.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/owners/owner-lease-deskmap.ts`
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
- `/Users/abstractmapping/projects/landroid/src/views/LeaseholdView.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/leasehold/leasehold-summary.ts`
- `/Users/abstractmapping/projects/landroid/src/components/leasehold/__tests__/leasehold-summary.test.ts`
- `/Users/abstractmapping/projects/landroid/src/components/deskmap/DeskMapNpriCard.tsx`
- `/Users/abstractmapping/projects/landroid/src/views/OwnerDatabaseView.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/owners/OwnerDetailPanel.tsx`
- `/Users/abstractmapping/projects/landroid/src/views/MapsView.tsx`
- `/Users/abstractmapping/projects/landroid/src/views/ResearchView.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/deskmap/DeskMapCard.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/deskmap/deskmap-coverage.ts`
- `/Users/abstractmapping/projects/landroid/src/components/modals/CreateNpriModal.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/modals/NodeEditModal.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/modals/ConveyModal.tsx`
- `/Users/abstractmapping/projects/landroid/src/storage/seed-test-data.ts`
- `/Users/abstractmapping/projects/landroid/src/types/node.ts`
- `/Users/abstractmapping/projects/landroid/src/components/deskmap/deskmap-lease-node.ts`
- `/Users/abstractmapping/projects/landroid/src/components/deskmap/__tests__/deskmap-coverage.test.ts`
- `/Users/abstractmapping/projects/landroid/src/components/modals/AttachLeaseModal.tsx`
- `/Users/abstractmapping/projects/landroid/src/utils/node-editor-route.ts`
- `/Users/abstractmapping/projects/landroid/src/utils/land.ts`
- `/Users/abstractmapping/projects/landroid/src/store/ui-store.ts`
- `/Users/abstractmapping/projects/landroid/src/components/shared/Navbar.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/modals/MapReferenceModal.tsx`
- `/Users/abstractmapping/projects/landroid/src/theme/index.css`
- `/Users/abstractmapping/projects/landroid/src/types/map.ts`
- `/Users/abstractmapping/projects/landroid/src/App.tsx`
- `/Users/abstractmapping/projects/landroid/src/storage/seed-test-data.ts`
- `/Users/abstractmapping/projects/landroid/src/storage/bundled-deskmap-pdfs.ts`
- `/Users/abstractmapping/projects/landroid/src/storage/workspace-persistence.ts`
- `/Users/abstractmapping/projects/landroid/src/store/owner-store.ts`
- `/Users/abstractmapping/projects/landroid/src/types/node.ts`
- `/Users/abstractmapping/projects/landroid/src/store/canvas-change-utils.ts`
- `/Users/abstractmapping/projects/landroid/src/store/__tests__/map-store.test.ts`
- `/Users/abstractmapping/projects/landroid/src/store/__tests__/canvas-change-utils.test.ts`
- `/Users/abstractmapping/projects/landroid/src/storage/__tests__/workspace-persistence.test.ts`
- `/Users/abstractmapping/projects/landroid/src/storage/__tests__/seed-test-data.test.ts`
- `/Users/abstractmapping/projects/landroid/src/assets/branding/landroid-logo.png`
- `/Users/abstractmapping/projects/landroid/src/assets/branding/raven-forest-backdrop.png`
- `/Users/abstractmapping/projects/landroid/src/research/rrc-fixed-width.ts`
- `/Users/abstractmapping/projects/landroid/src/research/rrc-drilling-permit-master.ts`
- `/Users/abstractmapping/projects/landroid/src/research/rrc-horizontal-drilling.ts`
- `/Users/abstractmapping/projects/landroid/src/research/rrc-delimited-text.ts`
- `/Users/abstractmapping/projects/landroid/src/research/__tests__/rrc-fixed-width.test.ts`
- `/Users/abstractmapping/projects/landroid/src/research/__tests__/rrc-drilling-permit-master.test.ts`
- `/Users/abstractmapping/projects/landroid/src/research/__tests__/rrc-horizontal-drilling.test.ts`
- `/Users/abstractmapping/projects/landroid/src/research/__tests__/rrc-delimited-text.test.ts`
- `/Users/abstractmapping/projects/landroid/src/components/research/DrillingPermitMasterDecoderPanel.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/research/HorizontalDrillingDecoderPanel.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/research/RrcDelimitedPreviewTable.tsx`
- `/Users/abstractmapping/projects/landroid/src/components/modals/AssetPreviewModal.tsx`
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
- The active `main` branch still holds the last validated pushed checkpoint for the audit fixes, leasehold hardening, and Desk Map multi-root clarification on top of inherited checkpoint `60cf008`
- The active working branch is now `codex/full-audit-handoff`
- The current checkpoint commit on that branch is `7f8ecbb`
- The current local worktree now also includes the first shared Desk Map / Runsheet editor path plus lease-node refresh from canonical owner-side lease edits
- The current local worktree now also includes owner-side buttons to create or reopen Desk Map lease nodes for saved leases, plus stricter mutation-input rejection in the core math engine
- `/Users/abstractmapping/projects/landroid/FULL-AUDIT-PROMPT.md` now exists as the paste-ready comprehensive audit brief for the next tool
- Full validation on the current local worktree passed: `npm test`, `npm run lint`, and `npm run build`
- The current local worktree now also passes targeted leasehold/persistence coverage after the WI assignment slice: `npm test -- --run src/components/leasehold/__tests__/leasehold-summary.test.ts src/storage/__tests__/workspace-persistence.test.ts src/storage/__tests__/seed-test-data.test.ts src/storage/__tests__/autosave-change-detection.test.ts src/storage/__tests__/csv-io.test.ts`
- The transfer-order review extension also passes targeted leasehold coverage: `npm test -- --run src/components/leasehold/__tests__/leasehold-summary.test.ts`
- The first editable payout-entry row layer also passes targeted leasehold/persistence coverage: `npm test -- --run src/storage/__tests__/workspace-persistence.test.ts src/storage/__tests__/autosave-change-detection.test.ts src/storage/__tests__/csv-io.test.ts src/storage/__tests__/seed-test-data.test.ts src/components/leasehold/__tests__/leasehold-summary.test.ts`
- The user is happy with the current flowchart paper-size/import-centering behavior for now
- Manual cleanup after import is acceptable; the layout does not need to “read their mind”
- The current runsheet export is in a good place for now; copy/paste into the external sheet is acceptable
- The user thinks the desk-map math is good for now after the delete-restore and precision work
- Do not disturb the current flowchart behavior unless the audit finds a concrete issue that requires it
- Owner, map, and research data now ride along with `.landroid` saves; CSV imports intentionally reset those sidecar records for the new workspace
- `Maps` is now the map-first presentation surface: PDFs can be featured and previewed, while clickable region overlays currently start with PNG/JPG exports
- `Research` is now the RRC-oriented staging surface for official dataset families and imported files
- `Research` now includes a first structured decoder path for `Drilling Permits Pending Approval`, joining the core permit, wellbore, and lat/long TXT files into a readable preview
- `Research` now also includes a first fixed-width decoder path for `Drilling Permit Master` / `Drilling Permit Master and Trailer`, joining core status/permit records and attaching lat/long records when present
- `Research` now also includes a fixed-width decoder for `Horizontal Drilling Permits`, turning that ASCII row layout into a readable permit preview
- `Research` now also renders `}`-delimited RRC TXT files as readable tables when possible, including staged supplemental pending-permit text files
- `Research` import metadata now uses an explicit save flow, and pending-permit decoding no longer reruns on ordinary note/title edits
- Workspace and canvas autosave still debounce and save the same payloads, but they now detect changes without serializing the full state tree on every update
- Desk Map now has a true 500-card stress tract for the current performance target, with render work scoped more narrowly during ordinary interaction
- Desk Map now surfaces separate running totals for ownership found in the chain, ownership linked to owner records, and ownership currently leased
- Desk Map now explicitly supports multiple starting root families in the same tract; temporary over-100 `Found in Chain` coverage is allowed while title is still being worked backward, and the coverage panel shows that state as provisional rather than balanced
- Desk Map current-owner cards now keep the present mineral owner visually distinct from the lessee, and the node edit modal now owns the lease-node access path
- `Leasehold` now exists as the first acreage-aware unit template, with editable pooled acres, unit metadata, leasehold-side ORRI tracking, pre-WI NRI math, and an internal `Deck` mode for card-based leasehold review; WI / division-order / payout layers still come later
- The current `Leasehold` `Deck` mode now has real retained-WI cards, assignment cards, and a first read-only transfer-order review surface; editable transfer-order / payout rows still come later
- Desk Map tract records now carry `gross acres`, `pooled acres`, and `description`, and those fields are edited from the Leasehold tab rather than from the Desk Map title-chain surface
- The dedicated eight-tract leasehold demo is now the cleanest starting point for the next phase of lessee-side calculations
- Seed and stress data now keep lease overlays separate from present ownership, while still seeding linked owners and some active leased interest for testing
- Desk Map now also supports separate NPRI branches from mineral-owner edit modals, with explicit fixed-vs-floating capture and separate amber NPRI cards
- NPRI branches do not reduce the mineral coverage totals; Desk Map is now explicitly treating those coverage cards as mineral-only
- `PROJECT_CONTEXT.md` now includes Texas-first guidance for lessor vs. lessee, assignments, NPRIs, ORRIs, pooling, and recording so future architecture work starts from the same title model
- Desk Map leased owners now stay visually close to ordinary mineral-owner cards, with a leased badge on the owner card and a separate terminal lessee node carrying the lease terms
- Legacy saved workspaces with older lease records should now open cleanly again; missing newer lease text fields are normalized instead of crashing the Desk Map render
- The user clarified the Desk Map leasing model: the present mineral owner stays in the main title tree, the owner card should only show leased status, the lease button belongs in the node edit modal, and the separate Desk Map lease node should represent the terminal lessee
- The user does not want assignments on Desk Map at all; assignments belong only to the later lessee-side workflow
- The user wants future lessee-side calculation work to handle assignments, ORRIs, working interest, division orders, and royalty-payment math rather than pushing those into Desk Map
- The user prefers not to add more Desk Map clutter or another top-level app tab; the intended path is to keep `Leasehold` as the single leasehold surface and grow the internal `Deck` there instead
- `Maps` reference links now normalize to `http(s)` URLs only, blocking unsupported schemes before they become clickable
- `.landroid` imports now reject malformed JSON/root payloads clearly and normalize optional desk-map/map-reference/canvas content on the way in
- The eager main bundle is now materially smaller again; the lazy `FlowchartView` warning is gone, the Tailwind Markdown-scan warning is gone, and `npm run build` is currently clean
- Leasehold math now aggregates multiple active leases per owner, supports all declared ORRI burden bases, shows both gross-acre and pooled-acre owner acreage, and includes a root error boundary around the app shell
- Neither `Maps` nor `Research` is direct ArcGIS Pro functionality or a live GIS renderer
- The user wants the selected map to dominate the page, with supporting controls staying secondary
- `Owners` is back to the sidebar-plus-detail layout, and `Maps` is back to a map-dominant split layout
- LANDroid now shows a small full-color prospect mark in the shared top navigation next to `Desk Map`, instead of inside the Desk Map canvas
- The user wants to keep pushing deeper on RRC imports and decoding, especially for difficult legacy formats like EBCDIC
- There is now a repo note at `/Users/abstractmapping/projects/landroid/docs/architecture/rrc-import-readability.md` summarizing which RRC families are readable now, which need fixed-width parsers, which need EBCDIC conversion first, and which are GIS/archive-heavy
- The user has now installed the recommended Mac-side toolchain for PDF/GIS/OCR/data work, including Poppler, GDAL/OGR, ExifTool, ImageMagick, Tesseract, Ghostscript, `uv`, `duckdb`, QGIS, DB Browser for SQLite, LibreOffice, and Inkscape
- Latest validation on this handoff branch passed with:
  - `npm test`
  - `npm run lint`
  - `npm run build`
- Focused validation for the latest Desk Map/demo-fixture repair also passed with:
  - `npx vitest run src/store/__tests__/workspace-store.test.ts src/storage/__tests__/seed-test-data.test.ts`
- Focused validation for the latest Desk Map toolbar click-through fix also passed with:
  - `npm run lint`
  - `npm run build`

Open risks / reminders:
- The current leasehold deck, WI lane, and transfer-order review / payout-entry surface are code-validated but have not been manually browser-QA’d yet
- The first payout-entry layer saves only owner number, status, and notes; decimals still remain derived and non-editable
- Over-assignment is intentionally warning-only for now; if we ever want hard blocking, it should likely arrive with a more explicit draft/save validation flow instead of the current blur-save cards
- Multi-root Desk Map starts are intentionally allowed even when provisional mineral coverage exceeds `100%`; that state should remain visible for reconciliation, not be hard-blocked
- Relevant source/docs work should now live on `main`; keep unrelated local noise separate from future checkpoints
- `dist/` and `dist-node/` contain generated validation output and should stay out of checkpoints unless explicitly requested

Likely next steps:
- Harden the next correctness tier from `/Users/abstractmapping/projects/landroid/FULL-AUDIT-PROMPT.md` and `/Users/abstractmapping/projects/landroid/LANDMAN-MATH-REFERENCE.md`:
  - CSV precision preservation
- Revisit the deferred import-path decision:
  - whether CSV / `.landroid` import should reject, quarantine, or interactively repair malformed ownership or leasehold payloads
- Decide how much lease-overlap warning UX is needed when multiple active leases together request more than an owner's current fraction
- Do a quick manual browser pass on Desk Map with two or more starting families so the new helper copy and provisional-coverage tone feel clear in practice
- Do a manual browser pass on `Leasehold (8 Tracts)` now that unit-focus payout-entry rows are editable
- Decide which additional transfer-order fields should come next after `owner number`, `status`, and `notes`
- Add the next payout-entry field slice only if it stays metadata-first and does not duplicate the derived decimal math
- Revisit hard-block validation only if the later payout-entry flow introduces a better draft/save checkpoint for assignment edits

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
   - `/Users/abstractmapping/projects/landroid/FULL-AUDIT-PROMPT.md` when the next chat is the full audit pass
6. Paste a short task-focused prompt or use `FULL-AUDIT-PROMPT.md` instead of trying to reconstruct everything from memory.

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
1. Extend the same fixed-width decoder seam to the next high-value ASCII family after horizontal permits, likely `Wellbore Query Data` or `Completion Information in Data Format`
2. Do a manual browser pass on the 500-card stress tract to confirm the new NPRI cards and lease-node interaction path feel acceptable in practice
3. Decide how much NPRI summary, if any, should be surfaced on Desk Map beyond the separate branch cards
4. Keep assignments entirely out of Desk Map and plan the later lessee-side assignment / ORRI / division-order / royalty workflow
5. Decide whether to add a root error boundary and any richer recovery UX now that corrupt autosaves are surfaced cleanly
6. Extend the future lessee-side calculations only after the Desk Map mineral-vs-royalty boundary still feels right in practice

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
I am working in `/Users/abstractmapping/projects/landroid` on branch `codex/full-audit-handoff`.

Before making architectural decisions, read:
- `/Users/abstractmapping/projects/landroid/AGENTS.md`
- `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`
- `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`
- `/Users/abstractmapping/projects/landroid/FULL-AUDIT-PROMPT.md`

Current focus:
- perform the next comprehensive production-quality audit of LANDroid math and architecture
- verify the repo's actual stack first from `package.json`, `vite.config.ts`, `src/main.tsx`, and `src/App.tsx`
- start with the current math and lease-sync entry points in `math-engine.ts`, `leasehold-summary.ts`, `deskmap-coverage.ts`, `workspace-store.ts`, `owner-store.ts`, `DeskMapView.tsx`, `RunsheetView.tsx`, and `OwnerDatabaseView.tsx`
- use `LANDMAN-MATH-REFERENCE.md` and `FULL-AUDIT-PROMPT.md` as the current audit context

Start by:
1. Inspecting the current branch/worktree state
2. Re-reading the audit and math context in `CONTINUATION-PROMPT.md` and `FULL-AUDIT-PROMPT.md`
3. Producing findings-first audit output with file references, source-grounded math notes, and explicit testing gaps
4. Keeping Texas fee/state and federal BLM/ONRR regimes separate throughout the audit
```

Full audit paste-ready prompt:
- Use `/Users/abstractmapping/projects/landroid/FULL-AUDIT-PROMPT.md`
- Use it together with `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`, not by itself
