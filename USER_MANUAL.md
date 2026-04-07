# LANDroid User Manual

This manual describes the active LANDroid app in the repository root.
It focuses on the features that exist today, the safest day-to-day workflow, and the recent additions around tract tabs, owner records, research map assets, flowchart printing, runsheet export, and precision-safe ownership math.

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

The top bar has seven view buttons:
- `Desk Map`
- `Leasehold`
- `Flowchart`
- `Runsheet`
- `Owners`
- `Maps`
- `Research`

The top bar also has:
- `Save` to export a `.landroid` workspace snapshot
- `Load` to import a `.landroid` or `.csv` file
- `Stress (100/150/500)` to load sample tract data for testing
- `Leasehold (8 Tracts)` to load an eight-tract unit demo with acreage and lease data

The current project name appears in the top bar. Local autosave still uses browser storage, but `Save` now captures workspace data, flowchart canvas state, owner records, owner documents, map assets, and research imports in the exported `.landroid` file.
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
- Click a card to edit it.
- Hover a card to reveal actions such as `PRECEDE`, `CONVEY`, `ATTACH`, and `DELETE`.
- Related documents stay attached to a title card and do not change ownership math.
- Cards that still retain interest are visually emphasized so they are easier to spot.
- The node edit modal includes an `Owner Record` section so you can create or open a linked owner record without crowding the card footer.
- The node edit modal also includes a `Lease / Lessee Node` section for present-interest mineral owners. Use that button to create or reopen the terminal lessee node.
- The node edit modal also includes an `Add NPRI` action for present-interest mineral owners. Use it to create a separate fixed or floating NPRI branch without reducing the mineral ownership total.
- Current-owner cards now distinguish ownership from leasing:
  - blue `Present Owner` status for the mineral owner who still holds the interest
  - green `Leased` status when that owner has an active lease on file
- The mineral-owner card stays part of the main title tree and does not turn into a separate lessor card.
- The attached green lessee node is the lease-side view. It is terminal in Desk Map, holds the lease terms and metadata, and stays linked back to the same owner record so Desk Map and `Owners` use the same lease data.
- NPRI nodes render as their own amber royalty cards. They can convey within the NPRI branch, but they stay separate from the mineral-owner coverage totals.

### Coverage totals
The floating summary panel in the top-left now separates three coverage checks:
- `Found in Chain` shows how much of the tract is currently accounted for in the active ownership chain.
- `Linked Owners` shows how much of the tract is tied to structured owner records.
- `Leased` shows how much of the tract is covered by active leases on those linked owners.

These totals are mineral totals only. NPRI branches are tracked separately on Desk Map and are not deducted from `Found in Chain`, because the actual royalty-payment math is deferred to later lessee-side workflows.

These are intentionally different numbers. A tract can be fully found before it is fully linked to owner records, and fully linked before it is fully leased.
If `Found in Chain` is temporarily over `100%`, LANDroid keeps that state visible instead of blocking it so you can keep tracing separate families and reconcile them later.

### Important delete behavior
Deleting a conveyance branch removes that branch and restores the deleted conveyed amount back to the original grantor or parent. This is safer than simply dropping the branch and losing the fraction.

### Empty-state behavior
If a tract has no cards yet, start with `+ Add Root` or load a `.landroid` or `.csv` file.

### Presentation watermark
LANDroid can display a small full-color prospect mark in the top navigation next to the `Desk Map` button so it stays visible across pages. This is visual context only and does not affect node behavior, math, or printing.

## Leasehold view

`Leasehold` is the acreage-first review surface for the same tract records you see in `Desk Map`.

It now has two internal modes:
- `Overview` for acreage, unit setup, and numeric tract review
- `Deck` for a card-based leasehold board that keeps ORRIs, WI / assignments, and transfer-order review off the Desk Map title tree

### What it does today
- Treats the current workspace's Desk Maps as one provisional unit
- Lets you set unit name, operator / lessee, effective date, and a short unit description
- Lets you set `gross acres`, `pooled acres`, and a short tract description for each Desk Map
- Derives tract participation from pooled acres
- Derives each present owner's net mineral acres from gross tract acres and also shows the pooled-acre participation equivalent
- Pulls active lease data from `Owners` so the tract summary and owner rows stay tied to the same lease record
- Aggregates multiple active leases per owner instead of collapsing to one primary lease for the math
- Calculates weighted tract royalty and total unit royalty from the active lease rates now on file
- Tracks leasehold-side ORRIs at either unit or tract scope, with an explicit burden-basis field
- Calculates ORRI and pre-assignment NRI totals for gross `8/8`, working-interest, and net-revenue-interest ORRI burdens
- Tracks leasehold-side WI assignments at either unit or tract scope
- Includes a `Deck` mode that focuses on one tract at a time and shows the lessee-side cards beneath that leasehold estate, including retained WI and assignment cards
- Includes a read-only transfer-order review surface in `Deck` that rolls up lease royalty, ORRI, retained WI, and assigned WI for the current focus
- Lets unit-focus transfer-order rows carry saved `owner number`, `status`, and `notes` without changing the derived decimal math underneath
- Pulls lease effective dates and doc numbers into royalty review rows when those details are present on the linked lease record
- Flags review rows that are still missing an effective date or doc number so source cleanup is visible before payout entry exists
- Keeps WI over-assignment as a warning-only review state in this v1 pass so the entered split can stay visible while you correct it

### Current assumptions
- Desk Map remains the title source of truth
- `Owners` remains the lease-record source of truth
- Pooled acres drive participation and payout decimals
- The starter demo begins with pooled acres equal to gross acres on every tract for easier audit checks
- Leasehold math now aggregates all active owner leases in effective-date order and caps the leased total at the owner's current fraction
- ORRI math now supports gross `8/8`, working-interest, and net-revenue-interest burden bases
- The first WI slice tracks retained and assigned WI and now shows the resulting transfer-order review decimals; the first saved payout-entry layer is unit-focus metadata only, not an editable decimal engine
- WI over-assignment is currently warning-only instead of hard-blocked; retained WI is clamped at zero until the split is corrected
- Assignments remain outside Desk Map and outside this first Leasehold tab pass
- Unit focus is the editable payout-entry surface; tract focus stays read-only because those rows are partial tract slices rather than final unit payout rows
- The `Deck` mode is the intended visual home for WI, assignments, transfer-order review, and later deeper payout workflows

### Leasehold demo workspace
- `Leasehold (8 Tracts)` loads a dedicated eight-tract unit demo
- The tract gross acres are `80`, `160`, `240`, `320`, `400`, `480`, `560`, and `640`
- The tract pooled acres match those same `80`, `160`, `240`, `320`, `400`, `480`, `560`, and `640` values
- The present-owner splits stay on clean half / quarter / eighth fractions for easier testing
- Every present owner in that demo is leased to the same lessee at `1/8` royalty so the first royalty totals are easier to inspect
- The demo also starts with one unit-wide gross `1/16` ORRI so the burden summary has a clean check number
- The demo also starts with a unit-wide `1/2` WI assignment and a tract-specific `1/4` WI assignment on `Tract 4` so the deck has clean starter splits
- The demo starts with no saved transfer-order row metadata, so you can test the first editable row layer from a clean slate
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
- Use the `Info` tab for mailing/contact/prospect notes.
- Use `Leases` and `Contacts` for working notes tied to that owner.
- Use `Docs` to upload and preview supporting files.
- Editing an existing lease in `Owners` now refreshes any linked Desk Map lease node and Runsheet lease row text that came from that lease record.
- Each saved lease card also shows `Desk Map Lease Node` buttons for the linked tract chains, so you can create or reopen the terminal lessee node from `Owners` without hunting for that owner in the tree first.

### Math safety
- Core title-math mutations now fail fast on zero, blank, or non-numeric share inputs instead of quietly converting them to zero-interest branches.
- Related nodes such as lease or document attachments are also validated to ensure they do not carry ownership fractions.

### Persistence behavior
- Owner data is scoped to the current workspace.
- Loading a `.landroid` file restores owner records and owner docs from that file.
- Loading a `.csv` creates a fresh workspace and clears owner records for that imported workspace unless you later add them.

## 6) Maps view

`Maps` is now the map-first workspace for the current project.

### What it supports today
- PDF map files
- PNG / JPG images
- GeoJSON files for exported GIS artifacts
- saved rectangular presentation regions on image assets
- saved outside reference links for maps or regions

### How to use it
- Upload one or more files into `Maps`.
- Mark the main prospect map as the featured map. `Maps` opens to that map first.
- Use `Present` mode for a cleaner map/story view.
- Use `Edit` mode to update metadata, place image-based regions, and save outside reference links.
- Map reference links accept `http://` and `https://` URLs; plain domains are normalized to `https://`, and unsupported schemes are blocked.
- Add metadata such as county, prospect, effective date, and source.
- Optionally link the map or a region to a desk map, title node, owner record, or lease.
- Preview supported file types inline, or download them back out.

### Current scope
- PDF maps can be featured and previewed inline, but clickable region overlays currently start with PNG / JPG exports.
- Region placement in this phase uses saved rectangular overlays rather than freeform GIS drawing.
- This is still a lightweight map/presentation workflow, not a live GIS viewer.
- ArcGIS Pro is not embedded in the app.
- The practical short-term path is to bring ArcGIS outputs into LANDroid as exported PDF, image, or GeoJSON artifacts.

## 7) Research view

`Research` is now the RRC-oriented workspace for official dataset families, imported downloads, and decoder triage.

### What it supports today
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
- Pick a dataset family from the left side.
- Import the files you downloaded from the official RRC site.
- Use the decoder status badges to see what is preview-ready now versus what still needs parser/manual work.
- Edit title, dataset family, and notes in the detail panel, then use `Save Details` to commit those metadata changes.
- Use `Reset` if you want to discard local note/title changes before saving.
- For `Drilling Permits Pending Approval`, import the permit, wellbore, and lat/long TXT files together to unlock the joined permit preview.
- For `Drilling Permit Master` and `Drilling Permit Master and Trailer`, import the ASCII master files to unlock the fixed-width permit preview. If the lat/long records are present, LANDroid will attach surface and bottom-hole coordinates to the same permit summary.
- For `Horizontal Drilling Permits`, import the ASCII file to unlock the row-by-row fixed-width permit preview with API, operator, validated-field, and schedule status details.
- Even supplemental pending-permit TXT files that are not yet part of the joined decoder can now render as an easier-to-read table instead of raw delimiter text.

### Current scope
- LANDroid can stage all of these files now, but it does not fully decode every RRC legacy format yet.
- The pending-permit decoder currently focuses on the core permit/wellbore/lat-long files. Other files in that family are still staged and previewed, but not yet joined into the structured summary.
- The permit-master decoder currently focuses on the core status and permit records, plus the surface and bottom-hole coordinate records when present. Other companion segment types are still staged and called out honestly instead of being treated as fully decoded.
- The horizontal-permit decoder currently focuses on the published 360-character row layout for that family. It does not yet cross-link those rows to other RRC families inside LANDroid.
- EBCDIC-heavy families are stored/imported first and decoded later.
- This phase favors safe cataloging, file organization, and triage over pretending every format is already solved.

## 8) Flowchart view

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

## 9) Files and persistence

### `.landroid` files
These are the main workspace snapshot files. They now include:
- workspace nodes
- tract tabs
- tract gross acres and tract descriptions
- active tract selection
- instrument types
- workspace owner records
- workspace owner documents
- workspace map assets
- workspace research imports
- flowchart nodes and edges
- flowchart viewport
- page/grid/orientation settings
- flowchart spacing settings

### `.csv` import
CSV import loads workspace data, resets the flowchart canvas, and starts a fresh empty owner/maps/research side workspace so you can re-import and relink cleanly.

### Local browser storage
The app also uses browser storage for local autosave. This is convenient, but it is not a substitute for named backups.
Autosaved workspace loads now validate the ownership graph before hydration. If the saved workspace or flowchart canvas is corrupt, LANDroid shows a startup warning and falls back to a safe fresh state instead of quietly loading invalid data.

### Recommended backup habit
- Save a `.landroid` file before major edits
- Save another `.landroid` file before printing or exporting deliverables
- Keep dated backup copies when testing risky changes

## 10) Precision and ownership math

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

## 11) Recommended workflow

1. Launch the app from `LANDroid.command` or `LANDroid.bat`.
2. Load an existing `.landroid` file or import a `.csv`.
3. Organize work by tract tabs in `Desk Map`.
4. Build or correct the title chain in `Desk Map`.
5. Create or open linked owner records where you need follow-up tracking.
6. Add supporting prospect maps and exhibits in `Maps`.
7. Bring in any official RRC downloads you want to stage in `Research`.
8. Review chronology and field quality in `Runsheet`.
9. Export the runsheet if you need workbook output.
10. Import the active tract into `Flowchart`.
11. Adjust paper size, spacing, and fit settings.
12. Print or save final backups.

## 12) Troubleshooting

### "The app opened, but I still see old work"
- Load the correct `.landroid` file.
- If you just imported a `.csv`, re-import the active tract into `Flowchart`.
- If you just imported a `.csv`, remember that owner records, map assets, and research imports start empty for that imported workspace.

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
- Confirm the affected records have a document number.

### "I want to test without touching real work"
- Use the `Stress (100/150/500)` button to load sample tract data.
- Save a separate `.landroid` snapshot before going back to real data.

## 13) Practical habits for a new user

- Keep one tract tab per tract unless you have a strong reason not to.
- Rename tabs early so the runsheet and flowchart stay easy to follow.
- Link owner records from the node edit modal when you need follow-up work tied to a title holder.
- Use `Maps` for presentation-facing prospect maps and region storytelling.
- Use `Research` for official RRC downloads, decoder notes, and research staging.
- Use `Runsheet` as your QA pass, not just `Desk Map`.
- Save often, and keep milestone `.landroid` files.
- Before deleting a branch, pause and confirm you really want the interest restored to the parent.
- Before printing, always do a preview pass.
