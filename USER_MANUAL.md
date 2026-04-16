# LANDroid User Manual

This manual describes the active LANDroid app in the repository root.
It focuses on the features that exist today, the safest day-to-day workflow, and the recent additions around tract tabs, owner records, curative issues, research map assets, flowchart printing, runsheet export, and precision-safe ownership math.

## 1) Quick start

### Launchers
- macOS: `LANDroid.command`
- Windows: `LANDroid.bat`

Both launchers start the local Vite dev server on port `5173`, open the app in your default browser, and reuse the same project folder as the working directory.

### Manual start
If you prefer the terminal:

```bash
cd /path/to/landroid
npm install
npm run dev
```

Then open `http://localhost:5173/`.

## 2) Main navigation

The top bar has eight view buttons:
- `Desk Map`
- `Leasehold`
- `Flowchart`
- `Runsheet`
- `Owners`
- `Curative`
- `Maps`
- `Federal Leasing`
- `Research`

The top bar also has:
- `File ▾` with `Save workspace` (exports a `.landroid` snapshot) and `Load workspace` (imports a `.landroid` or `.csv` file)
- `Demo Data ▾` with the `Combinatorial — Raven Forest` sample fixture for exercising Desk Map, Leasehold, and Federal Leasing surfaces without real project data

The current project name appears in the top bar and is editable inline — click the name, type a new one, and press `Enter` to commit or `Esc` to cancel. Local autosave still uses browser storage, but `Save` now captures workspace data, flowchart canvas state, owner records, owner documents, curative title issues, map assets, and Research sources, formulas, project records, saved questions, and imports in the exported `.landroid` file.
The top-left brand area can also carry a custom logo for demo or prospect-specific presentation.
If LANDroid detects corrupt autosaved workspace or canvas data during startup, it now opens a safe fresh state and shows a warning banner instead of silently pretending there was no saved data.
If a render or lazy-load failure occurs, LANDroid now shows a reload screen with the error details instead of dropping to a blank page.

## 3) Desk Map view

`Desk Map` is the main editing surface for title chains.

### Tract tabs
- Each tract appears as a tab across the top.
- Click a tab to switch tracts.
- Double-click a tab name to rename it.
- Click the `x` on the active tab to delete that tract tab.
- `+ Add Tract` creates a new tract tab.

Deleting a tract tab does not delete the underlying nodes from the workspace. It only removes that tab container.
Gross acres and tract descriptions now live on the tract record itself, but you edit those values from the `Leasehold` view instead of the Desk Map tab strip.

### Working with title cards
- `+ Add Root` starts a new title chain in the active tract.
- Use `+ Add Root` more than once when a tract starts from separate families or competing starting points.
- Temporary totals over `100%` are acceptable while you work farther back in title and reconcile the chain later.
- Use the `Find Mineral Owner` box in the top-left toolbar to jump straight to a mineral-owner card by name, even if that owner lives on another tract tab. Matching results now appear as a clickable list beneath the search box.
- Click a card to edit it.
- Hover a card to reveal actions such as `PRECEDE`, `CONVEY`, `ATTACH`, and `DELETE`.
- Related documents stay attached to a title card and do not change ownership math.
- Cards that still retain interest are visually emphasized so they are easier to spot.
- The node edit modal includes an `Owner Record` section so you can create or open a linked owner record without crowding the card footer.
- If the title card is not linked to an owner yet, `Owner Record` can link an existing owner record. Use this when the same legal owner appears in another tract and you want one owner/lease file without merging the tract title branches.
- The node edit modal also includes a `Lease / Lessee Node` section for present-interest mineral owners. Use that button to create or reopen the terminal lessee node.
- When creating a lessee node from an unlinked title card, choose an existing owner in the lease modal if this is the same party already tracked in `Owners`. Leaving it blank creates a new owner record from the title card when you save.
- The node edit modal also includes an `Add NPRI` action for present-interest mineral owners. Use it to create a separate fixed or floating NPRI branch without reducing the mineral ownership total.
- Fixed NPRIs now require one extra deed-reading choice: `Of burdened branch` when the deed fraction is tied to the grantor's branch, or `Of whole tract` when the fixed fraction is already stated against production from the land itself.
- LANDroid allows NPRI title discrepancies to be entered. If fixed or floating NPRIs over-claim the burdened branch or royalty bucket, the affected Desk Map branch and NPRI cards turn red and the toolbar shows an NPRI title-discrepancy warning.
- Current-owner cards now distinguish ownership from leasing through the card tint itself:
  - soft sky-blue card for a mineral owner who still holds the interest
  - soft emerald-green card when that owner also has an active lease on file
  - a small gold dot in the card header marks any card that still retains mineral interest
- The mineral-owner card stays part of the main title tree and does not turn into a separate lessor card.
- The attached green lessee node is the lease-side view. It is terminal in Desk Map, holds the lease terms and metadata, and stays linked back to the same owner record so Desk Map and `Owners` use the same lease data.
- Any Desk Map card with an attached PDF shows a PDF chip and filename on the card face, including title cards, lessee cards, NPRI cards, and related document chips.
- NPRI nodes render as their own amber royalty cards. They can convey within the NPRI branch, but they stay separate from the mineral-owner coverage totals.

### Coverage totals
The floating summary panel in the top-left now separates three coverage checks:
- `Found in Chain` shows how much of the tract is currently accounted for in the active ownership chain.
- `Linked Owners` shows how much of the tract is tied to structured owner records.
- `Leased` shows how much of the tract is covered by active leases on those linked owners.

These totals are mineral totals only. NPRI branches are tracked separately on Desk Map and are not deducted from `Found in Chain`, even though Leasehold now consumes those NPRI branches in payout math.

These are intentionally different numbers. A tract can be fully found before it is fully linked to owner records, and fully linked before it is fully leased.
If `Found in Chain` is temporarily over `100%`, LANDroid keeps that state visible instead of blocking it so you can keep tracing separate families and reconcile them later.

### Important delete behavior
Deleting a conveyance branch removes that branch and restores the deleted conveyed amount back to the original grantor or parent. This is safer than simply dropping the branch and losing the fraction.
Deleting the only Desk Map lessee card tied to an owner lease also removes that lease from the owner record. If another Desk Map card still uses the same lease record, deleting one lessee card leaves the owner lease in place and only removes that card.

### Empty-state behavior
If a tract has no cards yet, start with `+ Add Root` or load a `.landroid` or `.csv` file.

### Sample data readability
The combinatorial Raven Forest demo uses conventional person names with no duplicate owner-card grantee names, so it is easier to scan when you are exercising Desk Map or Leasehold behavior.

### Presentation watermark
LANDroid can display a small full-color prospect mark in the top navigation next to the `Desk Map` button so it stays visible across pages. This is visual context only and does not affect node behavior, math, or printing.

## Leasehold view

`Leasehold` is the acreage-first review surface for the same tract records you see in `Desk Map`.

It now has three internal modes:
- `Overview` for acreage, unit setup, and numeric tract review
- `Map` for a full-size leasehold hierarchy that starts at the unit, then tracts, then tract-specific owner / ORRI / WI branches
- `Deck` for a card-based leasehold board that keeps ORRIs, WI / assignments, and transfer-order review off the Desk Map title tree

### What it does today
- Treats the current workspace's Desk Maps as one provisional unit
- Lets you set unit name, operator / lessee, effective date, and a short unit description
- Lets you set `gross acres`, `pooled acres`, and a short tract description for each Desk Map
- Derives tract participation from pooled acres
- Derives each present owner's net mineral acres from gross tract acres and also shows the pooled-acre participation equivalent
- Pulls active lease data from `Owners` so the tract summary and owner rows stay tied to the same lease record; leases with linked Desk Map lease cards are scoped to that owner branch, while owner leases without a Desk Map lease card remain owner-level
- Aggregates multiple active leases per owner instead of collapsing to one primary lease for the math
- Calculates weighted tract royalty and total unit royalty from the active lease rates now on file
- Tracks leasehold-side ORRIs at either unit or tract scope, with an explicit burden-basis field
- Calculates ORRI and pre-assignment NRI totals for gross `8/8`, working-interest, and net-revenue-interest ORRI burdens
- Stacks multiple NRI-basis ORRIs one by one in effective-date order instead of flattening them into one combined carve
- Tracks leasehold-side WI assignments at either unit or tract scope
- Includes a full-size `Map` mode that keeps the title story and the payout story separate: Desk Map stays mineral/title, while Map shows the leased-side picture for the same tract
- Uses `Unit -> Tract` as the overview shape, then expands the selected tract into owner branches with lease slices and branch-bound NPRIs, plus separate tract-level ORRI and WI branches
- Includes a `Deck` mode that focuses on one tract at a time and shows the lessee-side cards beneath that leasehold estate, including retained WI and assignment cards
- Includes a transfer-order review surface in `Deck` that rolls up lease royalty, ORRI, retained WI, and assigned WI for the current focus
- Lets unit-focus transfer-order rows carry saved `owner number`, `status`, and `notes` without changing the derived decimal math underneath
- Pulls lease effective dates and doc numbers into royalty review rows when those details are present on the linked lease record
- Flags review rows that are still missing an effective date or doc number so source cleanup is visible before payout entry exists
- Keeps WI over-assignment as a warning-only review state in this v1 pass so the entered split can stay visible while you correct it
- Keeps floating-NPRI over-carves warning-only for title-building, but marks unit-focus payout readiness as `Hold` until the royalty over-carve is corrected

### Current assumptions
- Desk Map remains the title source of truth
- `Owners` remains the lease-record source of truth
- Pooled acres drive participation and payout decimals
- The starter demo begins with pooled acres equal to gross acres on every tract for easier audit checks
- Leasehold math now aggregates all active owner leases in effective-date order and caps the leased total at the owner's current fraction; a lease linked to a Desk Map lease card is treated as branch-scoped instead of applying to every tract for the same owner
- Deleting the only branch-scoped Desk Map lease card now removes that linked lease from `Owners`; shared lease records stay in `Owners` while other cards still use them
- ORRI math now supports gross `8/8`, working-interest, and net-revenue-interest burden bases, with NRI-basis ORRIs stacking in effective-date order
- If NPRI branches exist, Leasehold now derives separate fixed and floating NPRI payout rows and shows them in both the deck and the transfer-order ledger
- Fixed NPRIs can now pay two different ways depending on the deed: branch-based fixed burdens scale with the leased slice of the burdened branch, while whole-tract fixed burdens are treated as fixed against tract production and only reduced when less than the full burdened branch is leased
- NPRI over-claim situations remain warning-only for title-building. Desk Map highlights the affected branch in red; Leasehold still calculates the visible payout rows so the discrepancy can be reviewed and corrected later.
- The first WI slice tracks retained and assigned WI and now shows the resulting transfer-order review decimals; the first saved payout-entry layer is unit-focus metadata only, not an editable decimal engine
- WI over-assignment is currently warning-only instead of hard-blocked; retained WI is clamped at zero until the split is corrected
- Floating-NPRI over-carves do not block editing, but they now keep unit-focus payout review on `Hold` so the payout sheet cannot be treated as ready by mistake
- Assignments remain outside Desk Map title math and are handled in the Leasehold deck/review surface
- Unit focus is the editable payout-entry surface; tract focus stays read-only because those rows are partial tract slices rather than final unit payout rows
- `Map` mode is the intended visual home for the leasehold hierarchy itself
- `Deck` mode is the intended visual home for WI, assignments, transfer-order review, and later deeper payout workflows

### Demo workspace
- `Demo Data ▾ → Combinatorial — Raven Forest` loads the sample fixture
- Every tract covers one or more of the combinatorial flavors (baseline splits, probate / heirship, fixed NPRI carves, floating NPRI carves, correction / release, royalty deeds, lease overlap, kitchen sink) so the same workspace can exercise Desk Map, Leasehold, and Research surfaces without real project data
- Owner-card grantee names stay unique across the fixture so it is easy to scan
- Seeded title and lease PDFs show their filenames on the Desk Map cards
- The demo starts with one unit, a small ORRI burden, and a starter WI assignment so the leasehold deck has a clean check number from the first load
- The demo loader resets Curative, Maps, and Research side workspaces so stale side records from previous work are not carried over
- The tract descriptions are prefilled so you can see how the tab is meant to be used before entering your own data

## 4) Runsheet view

`Runsheet` is the review and audit table.

### What it shows
- Instruments from the current workspace
- Related documents, visually marked as `(RELATED)`
- Interest display using fraction formatting
- An `Edit` action on each row that opens the same node or lease modal used in `Desk Map`
- Columns in this order:
  - Instrument
  - File Date
  - Inst. Date
  - Vol/Pg
  - Grantor
  - Grantee
  - Interest
  - Land Desc.
  - Remarks

### Sorting
Click the header for:
- Instrument
- File Date
- Inst. Date
- Grantor
- Grantee

Click again to reverse the sort direction.

### Tract filtering
At the top of the runsheet:
- `All Tracts` shows the full workspace
- Each tract button filters to that tract only

### Editing from Runsheet
- Use the `Edit` button on any row to open the same editor flow used in `Desk Map`.
- Mineral-owner and related-document rows open the node edit modal.
- Lease rows reopen the linked lease / lessee modal instead of a different form.
- If you update a lease from `Owners`, linked lease rows in `Runsheet` and the linked Desk Map lease node refresh from that shared lease record.

### Export Runsheet
`Export Runsheet` creates an `.xlsx` workbook from the current runsheet view.

Useful notes:
- The export respects the current tract filter and current sort order.
- The workbook includes the `TORS_Documents\{docNo}.pdf` path formula structure.
- If you want those links to resolve outside LANDroid, keep the `TORS_Documents` folder alongside the workbook.

## 5) Owners view

`Owners` keeps workspace-scoped owner records separate from the title-chain math while still letting you link one primary owner record to a title node.

### What it stores
- owner records
- lease records tied to an owner
- contact log entries
- owner documents with optional lease links

### Typical workflow
- Create a new owner from the `Owners` tab, or open `Owner Record` from a node edit modal in `Desk Map`.
- For a same owner in multiple tracts, link each tract's Desk Map branch to the existing owner record before creating branch-specific lease nodes.
- Use the left-side `Search` box and `Sort By` picker to cut long owner lists down by owner name, county, prospect, lease text, active lease count, or recent activity.
- Use the `Info` tab for mailing/contact/prospect notes.
- Use `Leases` and `Contacts` for working notes tied to that owner.
- Use `Docs` to upload and preview supporting files.
- Editing an existing lease in `Owners` now refreshes any linked Desk Map lease node and Runsheet lease row text that came from that lease record.
- New lease edits now use a short status list (`Active`, `Expired`, `Released`, `Terminated`, `Inactive`, `Dead`) so active-lease math stays consistent; older custom status text still displays until you choose a canonical replacement.
- Each saved lease card also shows `Desk Map Lease Node` buttons for the linked tract chains, so you can create or reopen the terminal lessee node from `Owners` without hunting for that owner in the tree first.
- Deleting a lease from `Owners` clears the linked lease reference on Desk Map cards; deleting the only linked Desk Map lessee card removes that lease from `Owners`.

### Math safety
- Core title-math mutations now fail fast on zero, blank, or non-numeric share inputs instead of quietly converting them to zero-interest branches.
- Related nodes such as lease or document attachments are also validated to ensure they do not carry ownership fractions.

### Persistence behavior
- Owner data is scoped to the current workspace.
- Loading a `.landroid` file restores owner records and owner docs from that file.
- Loading a `.csv` creates a fresh workspace and clears owner records for that imported workspace unless you later add them.

## 6) Curative view

`Curative` is the title issue and curative tracker. It is meant for the real-world problems a Texas landman needs to keep visible while the title chain is still being cleaned up.

### What it tracks
- NPRI discrepancies and royalty over-claim questions
- over-conveyances
- missing leases
- missing ratifications
- probate and heirship gaps
- bad legal descriptions
- name mismatches
- unreleased liens
- unrecorded assignments
- title opinion requirements
- other company-specific curative items

### How to use it
- Click `+ New Issue` to create a curative item.
- Set the issue type, priority, status, source document number, responsible party, and due date.
- Use `Required Curative Action` for the actual fix: affidavit, probate, release, ratification, correction deed, title-opinion waiver, or other needed document.
- Link the issue to a tract / Desk Map, a specific branch or card, an owner record, and a lease record when applicable.
- Use `Open Desk Map` to jump from a linked issue back to the affected tract and branch.
- Use the left-side search and filters to cut the list by owner, tract, defect language, document number, responsible party, status, or priority.

### Status convention
- Curative issues are warning-only workflow records. They do not block title-building edits.
- Use `Open`, `Researching`, `Curative Requested`, `Waiting on Third Party`, or `Ready for Review` while the problem still matters.
- Use `Resolved` when the issue is cured.
- Use `Deferred` when the issue is intentionally held for later review rather than cured now.

### Company readiness backlog
The Curative view also keeps the next broader company-readiness areas visible so they do not get lost:
- lease admin calendar and clause flags
- division order, pay status, and suspense workflow
- pooling / unit document package
- RRC well and GIS integration
- document OCR and clause extraction
- advanced interests such as executive rights, life estates, term minerals, NPI, and BIAPO
- enterprise audit trail and reviewer signoff

### Persistence behavior
- Curative issues are scoped to the current workspace.
- Loading a `.landroid` file restores title issues from that file.
- Loading a `.csv` starts a fresh workspace and clears curative records for that imported workspace.
- If a linked owner, lease, branch, or tract is deleted, LANDroid keeps the issue but clears the broken link so the issue itself is not silently lost.

## 7) Maps view

`Maps` is now the map-first workspace for the current project.

### What it supports today
- PDF map files
- PNG / JPG images
- GeoJSON files for exported GIS artifacts
- GeoJSON feature summaries for supported text GeoJSON
- saved rectangular presentation regions on image assets
- saved outside reference links for maps or regions
- links from maps or regions to Research sources and project records

### How to use it
- Upload one or more files into `Maps`.
- Mark the main prospect map as the featured map. `Maps` opens to that map first.
- Use `Present` mode for a cleaner map/story view.
- Use `Edit` mode to update metadata, place image-based regions, and save outside reference links.
- Map reference links accept `http://` and `https://` URLs; plain domains are normalized to `https://`, and unsupported schemes are blocked.
- Add metadata such as county, prospect, effective date, and source.
- Optionally link the map or a region to a desk map, title node, owner record, lease, Research source, or Research project record.
- Preview supported file types inline, or download them back out.

### Current scope
- PDF maps can be featured and previewed inline, but clickable region overlays currently start with PNG / JPG exports.
- Region placement in this phase uses saved rectangular overlays rather than freeform GIS drawing.
- This is still a lightweight map/presentation workflow, not a live GIS viewer.
- ArcGIS Pro is not embedded in the app.
- The practical short-term path is to bring ArcGIS outputs into LANDroid as exported PDF, image, or GeoJSON artifacts, then link those artifacts back to the sources and project records that explain them.

## 8) Federal Leasing view

`Federal Leasing` is the first-class workspace for federal/BLM lease inventory, expiration tracking, potential leasing targets, source packets, and map evidence. It uses the same saved project-record backbone as `Research`, so a federal lease created here still appears in Research project records and exports in the same `.landroid` file.

### What it supports today
- current federal lease inventory with legacy BLM serials, MLRS serials, lessee/applicant, operator, county, prospect area, acres, and legal-description notes
- potential targets, mapped tracts, and Unit / CA reference records for tracking only
- expiration-date and next-action tracking, including missing-date visibility and 180-day upcoming-expiration counts
- source-packet status, linked Research sources, linked import files, map assets, map regions, Desk Map tracts/cards, owners, and owner lease records
- search across federal lease names, serials, county/prospect notes, parties, source names, map labels, linked LANDroid object labels, next actions, and notes

### How to use it
- Use `Add Existing Federal Lease` for a lease you already hold or are actively tracking as current.
- Use `Add Potential Target` for a lease-sale target, acquisition target, or federal tract you may pursue.
- Use `Add Unit / CA Reference` for a communitization-agreement or unit reference packet without turning on CA/TPF math.
- Use `Add Mapped Tract` when the map evidence is the starting point and the lease/source packet is still being assembled.
- Use `Inventory`, `Targets`, `Expirations`, `Map Evidence`, and `Source Packets` to work from the operational view you need that day.
- Link Research sources and map evidence as soon as the record depends on a source packet, case file, GIS artifact, or tract exhibit.

### Current scope
- Federal Leasing records are reference and tracking records only. They do not change Texas Desk Map, Leasehold, transfer-order, payout, NPRI, ORRI, or WI calculations.
- No federal royalty math, ONRR reporting, payout math, BLM calculation behavior, CA/TPF math, or tribal lease workflow is active here.
- Research remains the source library and cross-record hub; Federal Leasing is the working board for the federal lease inventory itself.

## 9) Research view

`Research` is now the source-of-truth workspace for project sources, formulas, shared project records, saved questions, and advanced data imports. It opens to a home view with cross-library search, a review queue, and quick actions before you dive into any one record type.

### What it supports today
- `Sources` for statutes, cases, agency pages, manuals, uploaded files, project notes, map/GIS references, lease/source documents, linked LANDroid objects, and review status
- `Formulas` for landman-readable formula cards with variables, examples, source links, review status, optional LANDroid engine references, and starter Texas formula cards scaffolded from `LANDMAN-MATH-REFERENCE.md`
- `Project Records` for shared reference records used by Federal Leasing, private leases, mapped tracts, target acquisitions, current leases, legal-description notes, map links, and source links
- `Questions` for saved research questions, manual answers/notes, source links, formula links, project-record links, and review status
- `Data Imports` for the older RRC catalog/import/decoder workspace, now treated as an advanced section

### Research home
- Use the home tiles to add a source, add formula starters, add a project record, or add a saved question.
- Use `Search Research` from the home view when you want to search across sources, formulas, project records, and saved questions at once.
- Search includes linked source names, map asset/region labels, owner names, lease labels, Desk Map labels, and import labels where those links exist.
- Use the review queue to jump to sources or formulas marked `Needs Review`, project records under review, or saved questions that still need an answer.
- Federal/private records shown from Research home remain reference-only. They do not change Texas Desk Map or Leasehold math.

### Data Imports support today
- an in-app catalog of major official RRC downloadable dataset families
- direct links back to the official RRC downloads page
- workspace-scoped imports of downloaded files, including CSV, JSON, PDF, images, ZIPs, shapefile parts, ASCII, and EBCDIC files
- inline preview for browser-friendly formats, with raw-file staging for harder legacy formats
- readable table preview for `}`-delimited RRC TXT files when LANDroid can recognize a header row or known column layout
- a structured decoder for `Drilling Permits Pending Approval` core files:
  `dp_drilling_permit_pending`, `dp_wellbore_pending`, and `dp_latlongs_pending`
- a fixed-width structured decoder for `Drilling Permit Master` and `Drilling Permit Master and Trailer`, including core permit rows and lat/long companion records when present
- a fixed-width structured decoder for `Horizontal Drilling Permits`, turning the row-based ASCII file into a readable permit preview

### How to use it
- Start in `Sources` when you need to save the authority, document, page, map reference, or project note that supports your work. Set the source status to `Draft`, `Needs Review`, or `Verified` as your confidence changes.
- Use `Formulas` to document what a calculation means, which variables go into it, which source or convention supports it, and where LANDroid currently uses the logic. Use `Add Math Starters` when you want starter cards for the current Texas math reference.
- Use `Project Records` to inspect or edit the same reference records used by Federal Leasing, plus private leases, mapped tracts, target acquisitions, or other project items that should not change Texas Desk Map or Leasehold math.
- Use `Questions` to save a research question and the sources, formulas, or project records that support the answer.
- Use the filters in each section to narrow sources by type/context/status, formulas by category/status, project records by type/status, and saved questions by status.
- Use `Data Imports` only when you want to stage official RRC downloads or review the existing decoder output.
- In `Data Imports`, pick a dataset family from the left side and import the files you downloaded from the official RRC site.
- Use the decoder status badges to see what is preview-ready now versus what still needs parser/manual work.
- Edit title, dataset family, and notes in the detail panel, then use `Save Details` to commit those metadata changes.
- Use `Reset` if you want to discard local note/title changes before saving.
- For `Drilling Permits Pending Approval`, import the permit, wellbore, and lat/long TXT files together to unlock the joined permit preview.
- For `Drilling Permit Master` and `Drilling Permit Master and Trailer`, import the ASCII master files to unlock the fixed-width permit preview. If the lat/long records are present, LANDroid will attach surface and bottom-hole coordinates to the same permit summary.
- For `Horizontal Drilling Permits`, import the ASCII file to unlock the row-by-row fixed-width permit preview with API, operator, validated-field, and schedule status details.
- Even supplemental pending-permit TXT files that are not yet part of the joined decoder can now render as an easier-to-read table instead of raw delimiter text.

### Current scope
- Federal/private project records are reference-only in this phase. They can be searched, linked to sources, linked to map assets/regions, linked to LANDroid objects, and saved in `.landroid` files, but they do not drive federal royalty, CA/TPF, ONRR, payout, or private-lease math.
- Formula starters document current Texas LANDroid behavior and are marked `Needs Review` so company conventions can still be confirmed before relying on them.
- Deleting a Research source, formula, project record, or import now clears dependent Research links inside the active workspace so saved questions and formula cards do not keep hidden stale references.
- LANDroid can stage RRC files now, but it does not fully decode every RRC legacy format.
- The pending-permit decoder currently focuses on the core permit/wellbore/lat-long files. Other files in that family are still staged and previewed, but not yet joined into the structured summary.
- The permit-master decoder currently focuses on the core status and permit records, plus the surface and bottom-hole coordinate records when present. Other companion segment types are still staged and called out honestly instead of being treated as fully decoded.
- The horizontal-permit decoder currently focuses on the published 360-character row layout for that family. It does not yet cross-link those rows to other RRC families inside LANDroid.
- DBF and EBCDIC-heavy imports are no longer near-term roadmap work. They remain staged safely for later if that work becomes worth the time.
- No AI provider, prompt system, or API proxy is active in this phase. The saved source/formula/project/question records are structured so a later AI layer can use them.

## 10) Flowchart view

`Flowchart` is the presentation and print surface.

### Main actions
- `Import Desk Map` rebuilds the flowchart from the active tract
- `Fit to Grid` scales the current chart to fit inside the chosen paper/grid area
- `Resize All` lets you drag the whole chart larger or smaller
- `Print` opens the browser print flow
- `Select All` selects all canvas nodes
- `Clear` clears the current flowchart canvas

### Drawing and editing tools
The toolbar supports:
- Select
- Pan
- Connect
- Rectangle
- Rounded
- Ellipse
- Diamond
- Note

### Page and print controls
The flowchart toolbar includes:
- Paper size
- Column count
- Row count
- Portrait/landscape toggle
- Horizontal spacing (`H`)
- Vertical spacing (`V`)

These settings are now included when you save a `.landroid` file.

### Import behavior
- Flowchart import uses the active tract tab as its source
- Related documents are excluded from the imported ownership tree
- The imported tree is centered in the current paper/grid area

### Printing tips
- Use `Fit to Grid` before printing if the chart is too large
- Adjust paper size, rows, and columns before final output
- Use horizontal and vertical spacing controls when the tree feels too cramped or too loose
- Use browser print preview before final printing

## 11) Files and persistence

### `.landroid` files
These are the main workspace snapshot files. They now include:
- workspace nodes
- tract tabs
- tract gross acres and tract descriptions
- active tract selection
- instrument types
- workspace owner records
- workspace owner documents
- workspace curative title issues
- workspace map assets
- workspace Research sources, formulas, project records, saved questions, and imports
- flowchart nodes and edges
- flowchart viewport
- page/grid/orientation settings
- flowchart spacing settings

### `.csv` import
CSV import loads workspace data, resets the flowchart canvas, and starts a fresh empty owner/curative/maps/research side workspace so you can re-import and relink cleanly. `.landroid` export/import carries node PDF attachments; if an older backup says a title card has a PDF but does not include the attachment payload, LANDroid clears the PDF flag instead of substituting an unrelated document.
When a PDF payload is present, LANDroid preserves the stored PDF filename so Desk Map can show what is attached instead of only saying that a PDF exists.

### Local browser storage
The app also uses browser storage for local autosave. This is convenient, but it is not a substitute for named backups.
Autosaved workspace loads now validate the ownership graph before hydration. If the saved workspace or flowchart canvas is corrupt, LANDroid shows a startup warning and falls back to a safe fresh state instead of quietly loading invalid data.

### Recommended backup habit
- Save a `.landroid` file before major edits
- Save another `.landroid` file before printing or exporting deliverables
- Keep dated backup copies when testing risky changes

## 12) Precision and ownership math

Recent ownership work improved how fractions are stored and displayed.

### What changed
- Internal decimal precision is higher than display precision
- Repeated small conveyances preserve more meaningful fractional detail
- Exact finite decimals reduce to cleaner fractions where possible, such as `1/1024`
- Delete-and-restore branch behavior protects the grantor's fraction when a branch is removed

### What to watch for
- Conveyances move title fraction
- Related documents do not
- Parent/child relationships matter for recalculation
- If something looks wrong, review the branch in Desk Map first, then confirm the chronology in Runsheet

## 13) Recommended workflow

1. Launch the app from `LANDroid.command` or `LANDroid.bat`.
2. Load an existing `.landroid` file or import a `.csv`.
3. Organize work by tract tabs in `Desk Map`.
4. Build or correct the title chain in `Desk Map`.
5. Create or open linked owner records where you need follow-up tracking.
6. Add curative issues for defects, missing documents, title-opinion requirements, and payout holds in `Curative`.
7. Add supporting prospect maps and exhibits in `Maps`.
8. Track federal lease inventory, expirations, potential targets, source packets, and federal map evidence in `Federal Leasing` when that work is part of the project.
9. Capture supporting sources, formulas, shared project records, saved questions, and any useful RRC data imports in `Research`.
10. Review chronology and field quality in `Runsheet`.
11. Export the runsheet if you need workbook output.
12. Import the active tract into `Flowchart`.
13. Adjust paper size, spacing, and fit settings.
14. Print or save final backups.

## 14) Troubleshooting

### "The app opened, but I still see old work"
- Load the correct `.landroid` file.
- If you just imported a `.csv`, re-import the active tract into `Flowchart`.
- If you just imported a `.csv`, remember that owner records, map assets, and research imports start empty for that imported workspace.
- If you just imported a `.csv`, remember that curative title issues start empty too.

### "The flowchart is empty"
- Make sure the active tract has title cards.
- Click `Import Desk Map`.
- Remember that related documents do not import into the ownership flowchart.

### "The print preview is too big or clipped"
- Change paper size.
- Increase rows or columns.
- Use `Fit to Grid`.
- Adjust `H` and `V` spacing if the tree is crowded.
- Use `Resize All` if you need a larger or smaller global scale.

### "My runsheet export does not open the PDFs"
- Make sure the exported workbook can still reference a `TORS_Documents` folder beside it.
- Confirm the affected records have both a document number and an attached PDF. Rows without both are exported without fake hyperlinks.

### "I want to test without touching real work"
- Use `Demo Data ▾ → Combinatorial — Raven Forest` to load sample tract data.
- Save a separate `.landroid` snapshot before going back to real data.
- Browser QA covers the combinatorial demo loader with Playwright, including visible PDF filenames on Desk Map cards, inline project-name editing, Federal Leasing lease/target/source/map/search tracking, and Research home surfacing. Deeper leasehold-branch coverage is temporarily skipped in the Playwright suite while the Raven Forest fixture is rebuilt.

## 15) Practical habits for a new user

- Keep one tract tab per tract unless you have a strong reason not to.
- Rename tabs early so the runsheet and flowchart stay easy to follow.
- Link owner records from the node edit modal when you need follow-up work tied to a title holder.
- Add a Curative issue when something is not ready to rely on yet, even if you are intentionally leaving title-building edits warning-only.
- Use `Maps` for presentation-facing prospect maps and region storytelling.
- Use `Federal Leasing` for federal lease inventory, expirations, potential targets, source packets, and federal map evidence.
- Use `Research` as the source-of-truth shelf for laws, formulas, project notes, supporting records, map evidence, and questions you want to revisit.
- Use `Runsheet` as your QA pass, not just `Desk Map`.
- Save often, and keep milestone `.landroid` files.
- Before deleting a branch, pause and confirm you really want the interest restored to the parent.
- Before printing, always do a preview pass.
