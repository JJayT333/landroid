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

The top bar has six view buttons:
- `Desk Map`
- `Flowchart`
- `Runsheet`
- `Owners`
- `Maps`
- `Research`

The top bar also has:
- `Save` to export a `.landroid` workspace snapshot
- `Load` to import a `.landroid` or `.csv` file
- `Stress (100/150/200)` to load sample tract data for testing

The current project name appears in the top bar. Local autosave still uses browser storage, but `Save` now captures workspace data, flowchart canvas state, owner records, owner documents, map assets, and research imports in the exported `.landroid` file.

## 3) Desk Map view

`Desk Map` is the main editing surface for title chains.

### Tract tabs
- Each tract appears as a tab across the top.
- Click a tab to switch tracts.
- Double-click a tab name to rename it.
- Click the `x` on the active tab to delete that tract tab.
- `+ Add Tract` creates a new tract tab.

Deleting a tract tab does not delete the underlying nodes from the workspace. It only removes that tab container.

### Working with title cards
- `+ Add Root` starts a new title chain in the active tract.
- Click a card to edit it.
- Hover a card to reveal actions such as `PRECEDE`, `CONVEY`, `ATTACH`, and `DELETE`.
- Related documents stay attached to a title card and do not change ownership math.
- Cards that still retain interest are visually emphasized so they are easier to spot.
- The node edit modal includes an `Owner Record` section so you can create or open a linked owner record without crowding the card footer.

### Important delete behavior
Deleting a conveyance branch removes that branch and restores the deleted conveyed amount back to the original grantor or parent. This is safer than simply dropping the branch and losing the fraction.

### Empty-state behavior
If a tract has no cards yet, start with `+ Add Root` or load a `.landroid` or `.csv` file.

## 4) Runsheet view

`Runsheet` is the review and audit table.

### What it shows
- Instruments from the current workspace
- Related documents, visually marked as `(RELATED)`
- Interest display using fraction formatting
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
- a structured decoder for `Drilling Permits Pending Approval` core files:
  `dp_drilling_permit_pending`, `dp_wellbore_pending`, and `dp_latlongs_pending`

### How to use it
- Pick a dataset family from the left side.
- Import the files you downloaded from the official RRC site.
- Use the decoder status badges to see what is preview-ready now versus what still needs parser/manual work.
- Keep notes with the raw imported file so LANDroid becomes the place where the file and your understanding stay together.
- For `Drilling Permits Pending Approval`, import the permit, wellbore, and lat/long TXT files together to unlock the joined permit preview.

### Current scope
- LANDroid can stage all of these files now, but it does not fully decode every RRC legacy format yet.
- The pending-permit decoder currently focuses on the core permit/wellbore/lat-long files. Other files in that family are still staged and previewed, but not yet joined into the structured summary.
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
- Use the `Stress (100/150/200)` button to load sample tract data.
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
