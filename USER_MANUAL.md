# LANDroid User Manual

This manual describes the active LANDroid app in the repository root.
It focuses on the features that exist today, the safest day-to-day workflow, and the recent additions around tract tabs, flowchart printing, runsheet export, and precision-safe ownership math.

## 1) Quick start

### Launchers
- macOS: `LANDroid.command`
- Windows: `LANDroid.bat`

Both launchers start the local Vite dev server on port `5173`, open the app in your browser, and reuse the same project folder as the working directory.

### Manual start
If you prefer the terminal:

```bash
cd /path/to/landroid
npm install
npm run dev
```

Then open `http://localhost:5173/`.

## 2) Main navigation

The top bar has four view buttons:
- `Desk Map`
- `Flowchart`
- `Runsheet`
- `Research`

The top bar also has:
- `Save` to export a `.landroid` workspace snapshot
- `Load` to import a `.landroid` or `.csv` file
- `Stress (100/150/200)` to load sample tract data for testing

The current project name appears in the top bar. Local autosave still uses browser storage, but `Save` now captures both workspace data and flowchart canvas state in the exported `.landroid` file.

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

## 5) Flowchart view

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

## 6) Files and persistence

### `.landroid` files
These are the main workspace snapshot files. They now include:
- workspace nodes
- tract tabs
- active tract selection
- instrument types
- flowchart nodes and edges
- flowchart viewport
- page/grid/orientation settings
- flowchart spacing settings

### `.csv` import
CSV import loads workspace data and resets the flowchart canvas so you can re-import the active tract cleanly.

### Local browser storage
The app also uses browser storage for local autosave. This is convenient, but it is not a substitute for named backups.

### Recommended backup habit
- Save a `.landroid` file before major edits
- Save another `.landroid` file before printing or exporting deliverables
- Keep dated backup copies when testing risky changes

## 7) Precision and ownership math

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

## 8) Recommended workflow

1. Launch the app from `LANDroid.command` or `LANDroid.bat`.
2. Load an existing `.landroid` file or import a `.csv`.
3. Organize work by tract tabs in `Desk Map`.
4. Build or correct the title chain in `Desk Map`.
5. Review chronology and field quality in `Runsheet`.
6. Export the runsheet if you need workbook output.
7. Import the active tract into `Flowchart`.
8. Adjust paper size, spacing, and fit settings.
9. Print or save final backups.

## 9) Troubleshooting

### "The app opened, but I still see old work"
- Load the correct `.landroid` file.
- If you just imported a `.csv`, re-import the active tract into `Flowchart`.

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

## 10) Practical habits for a new user

- Keep one tract tab per tract unless you have a strong reason not to.
- Rename tabs early so the runsheet and flowchart stay easy to follow.
- Use `Runsheet` as your QA pass, not just `Desk Map`.
- Save often, and keep milestone `.landroid` files.
- Before deleting a branch, pause and confirm you really want the interest restored to the parent.
- Before printing, always do a preview pass.
