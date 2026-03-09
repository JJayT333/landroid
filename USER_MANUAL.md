# LANDroid User Manual


## 0) Quick launch package (double-click)
This package includes launchers so you can open a main landing page and choose a saved workspace.

- **macOS/Linux:** double-click `LANDroid.command`
- **Windows:** double-click `LANDroid.bat`

The launcher starts a local web server, opens LANDroid in your browser, and shows a startup home screen where you can:
- Start a new workspace
- Import CSV
- Open any saved workspace from local storage

## 1) What LANDroid is for
LANDroid is a title-chain workspace for landmen and survey/title professionals. It combines:

- **Desk Map**: interactive title lineage tree.
- **Runsheet**: chronological, ledger-style document view.
- **Flow Chart**: print-focused diagram builder for clean exhibit output.

The app keeps a surveyor/landman visual style (parchment, ink, sepia) while supporting day-to-day chain construction, conveyance math, and print prep.

---

## 2) Main navigation and layout
At the top of the app, use the view switcher:

- **Desk Map** → interactive lineage/tree view.
- **Runsheet** → tabular master log.
- **Flow Chart** → presentation/print canvas.

Also in the header:

- **Master Total** stamp: shows the current total remaining interest.
- **New Tree**: start a separate root chain.
- **Add Loose Record**: add a parking-lot record not yet linked.
- **Upload Data**: import CSV.
- **Save Data**: export CSV backup.
- **Export Runsheet**: export runsheet file.

---

## 3) Core record concepts
A title record can exist in one of these practical states:

1. **Chain-linked conveyance** (part of the main title math lineage).
2. **Related document** (non-conveying support docs; e.g., probate/affidavit).
3. **Loose record** (parking lot item waiting to be linked).
4. **Independent chain root** (new tree, separate branch set).

Each record can include key metadata such as:

- Instrument type
- Effective/file dates
- Volume/page/instrument number
- Grantor / grantee
- Land description
- Remarks
- Optional PDF attachment (Vault PDF Link)

---

## 4) Typical workflow (recommended)

### Step 1: Start your base chain
- Click **New Tree** to create a new chain root record.
- Fill in base instrument and party details.

### Step 2: Add conveyances
- From Desk Map or Runsheet, use **Convey** on the parent record.
- Choose conveyance math mode and basis (fraction/decimal behavior depends on your selected options).
- Commit the transaction.

### Step 3: Add non-conveying support docs
- Use **+ DOC** / **Attach Related Document** for docs that should display with a branch but not change math totals.

### Step 4: Manage unlinked documents
- Add to **Loose Record** when details are known but parent linkage is pending.
- Later use **Link Imported Document to Lineage** to attach to a parent and choose attachment type.

### Step 5: QA in Runsheet
- Review chronology in **Runsheet**.
- Toggle **All Records** / **Conveyances Only** for focused math review.

### Step 6: Build print output in Flow Chart
- Switch to **Flow Chart**.
- Use **Import** to generate a top-down layout from Desk Map.
- Clean up placement and connector routing.
- Set orientation/grid and print.

---

## 5) Desk Map guide
Desk Map is for visual chain development.

### Interactions
- **Pan**: click-drag canvas (grab cursor behavior).
- **Zoom**: mouse wheel.
- **Node actions** (depending on context):
  - Edit
  - Precede (insert prior doc)
  - Related doc
  - Convey
  - Delete (when allowed)

### Tips
- Use Desk Map for branch logic and quick spatial review.
- Keep related docs attached at the right branch point for clarity.

---

## 6) Runsheet guide
Runsheet is the auditing/verification surface.

### What it gives you
- Chronological table with instrument details and parties.
- Optional **Conveyances Only** mode for quick retained-share checks.
- Visibility of loose-record backlog.

### Row actions
- Edit a record
- Add predecessor
- Attach related doc
- Convey from row
- Delete (when allowed)

Use this view to verify:
- Dates are in expected order
- Correct grantor/grantee transitions
- Conveyance-only math looks right

---

## 7) Record modal (add/edit) explained
When adding or editing, modal title changes by task (e.g., Convey Title Link, Add Loose Document, Attach Related Document).

Common sections include:
- Parent selection (when linking/attaching)
- Instrument controls (select existing or create custom instrument)
- Book/page/instrument number
- Party names
- Dates
- Land description and remarks
- Conveyance math controls (for conveyance entries)
- PDF upload/view

### PDF behavior
- Uploading a PDF can auto-populate instrument number.
- You can view the attached PDF from the modal when present.

---

## 8) Flow Chart guide (for exhibits/print)
Flow Chart is optimized for page-aware output.

### Toolbar tools
- **Move Box**: reposition individual elements.
- **Move Tree**: reposition whole structure on paper area.
- **Pan Canvas**: move viewport only.
- **Link Boxes**: draw connectors.

### Layout controls
- Grid/page dimensions and tree scale.
- Orientation toggle (portrait/landscape).
- Import from Desk Map.

### Print behavior
- Uses page slicing under the hood for multi-page output.
- Print boundary and seam guides help avoid accidental clipping.

---

## 9) Import, export, and backups

### Export
- **Save Data** exports internal data (CSV) for backup/transfer.
- **Export Runsheet** exports a runsheet-oriented output.

### Import
- **Upload Data** loads CSV into the app.
- Verify key fields after import (especially dates, parties, and fraction values).

**Best practice:** export before major edits, then export again after completing review.

---

## 10) Quality-control checklist
Before finalizing work:

- [ ] Master Total is as expected.
- [ ] All conveyances are connected to intended parent.
- [ ] Related docs are marked correctly (not accidentally math-bearing).
- [ ] Runsheet chronology is correct.
- [ ] Loose records are resolved or intentionally parked.
- [ ] Flow Chart print boundary/orientation verified.
- [ ] Final CSV backup exported.

---

## 11) Troubleshooting

### I imported records but they are not in the right branch
Use **Link Imported Document to Lineage** and pick the correct parent + attachment type.

### My totals look wrong
Check whether a record was entered as conveyance vs related document and verify conveyance basis/mode values.

### Printing is clipped or awkward
Open **Flow Chart**, adjust tree position/scale, verify page seams and orientation, then reprint.

### I need to start over safely
Export current data first, then import your known-good CSV backup.

---

## 12) Operating tips for land/title teams
- Build conveyance chain first, then attach related docs.
- Keep instrument naming consistent (or define custom types intentionally).
- Use Runsheet for audit; use Desk Map for relationship comprehension; use Flow Chart for deliverables.
- Export frequent backups during complex chain reconstruction.
