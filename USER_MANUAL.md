# LANDroid User Manual

This manual explains the current LANDroid workflow, including the startup workspace system, DeskMap management enhancements, Runsheet/Flow source filters, offline behavior, and print/export operations.

---

## 1) Quick start and launch

### Desktop launchers
LANDroid ships with local launchers:
- **macOS/Linux:** `LANDroid.command`
- **Windows:** `LANDroid.bat`

Each launcher opens the app in your browser and presents the **Home / Workspace Picker**.

### Browser-only launch
If needed, you can also run a local static server from the app folder and open `index.html` through that server.

---

## 2) Home screen (workspace picker)

When LANDroid opens, you land on Home. This is your control center.

### Primary actions
- **Start New Workspace**
  - Creates a new workspace with default starter data.
- **Import CSV**
  - Imports a CSV backup into a workspace.
- **Open Existing Workspace**
  - Loads a previously saved local workspace.

### What Home stores
Workspace data is saved in your browser’s local IndexedDB storage. Workspace metadata (last-opened workspace id) is stored locally as well.

### Save and return behavior
Inside a workspace, use:
- **Save Workspace**: saves changes in place.
- **Save + Home** (or equivalent home-return action): saves current work, then returns to Home for workspace switching.

---

## 3) Core app views and what each is for

LANDroid has three main views:

1. **Desk Map**
   - Tree-based title lineage editor.
   - Best for branch logic and parent/child relationships.

2. **Runsheet**
   - Chronological and audit-friendly table.
   - Best for QA review, chain integrity, and chronology checks.

3. **Flow Chart**
   - Presentation/print layout canvas.
   - Best for page-formatted exhibits and handoff diagrams.

---

## 4) Record types and chain behavior

LANDroid records generally fall into these categories:

- **Conveyance**: participates in ownership math.
- **Related Document**: attached for context/reference; does not move title fraction.
- **Loose Record**: parked document not yet linked to lineage.
- **Root / independent chain starter**: beginning of a tree.

Typical fields include:
- Instrument type
- File/effective date
- Volume/page/document no.
- Grantor/grantee
- Land description
- Remarks
- Optional document attachment/link

---

## 5) Desk Map guide (including new multi-DeskMap controls)

Desk Map is your primary editing surface.

### Canvas interaction
- Pan by drag.
- Zoom with mouse wheel/trackpad.
- Use node-level actions to edit, convey, attach docs, or delete (where allowed).

### DeskMap management (new additions)
LANDroid supports multiple DeskMaps in one workspace.

- **Add DeskMap (`+ DeskMap`)**
  - Creates a new DeskMap segment (useful for tracts, phases, or organizational splits).
- **Rename active DeskMap (`Save Name`)**
  - Edit DeskMap title/code and save updates.
- **Active DeskMap switching**
  - Choose which DeskMap is currently being edited in Desk Map view.

### Suggested usage
- Keep one DeskMap per logical tract/unit when practical.
- Use consistent naming conventions for easier Runsheet/Flow filtering.

---

## 6) Runsheet guide (with DeskMap filter controls)

Runsheet is the QA/audit surface.

### Core uses
- Validate chronology.
- Confirm grantor/grantee transitions.
- Review title-moving entries quickly.

### Filters (new additions)
Runsheet DeskMap scope selector supports:
- **Active DeskMap**
- **All DeskMaps**
- **Specific DeskMap**

Use these modes to inspect a single tract or full-workspace activity without changing your underlying Desk Map context.

---

## 7) Flow Chart guide (source selection, import, and append)

Flow Chart is optimized for print-ready diagrams.

### Tooling
- Move box
- Move tree/group
- Pan canvas
- Link boxes/connectors

### Source filter and import actions (new additions)
Flow Chart source selector supports:
- **Active DeskMap**
- **All DeskMaps**
- **Specific DeskMap**

Import actions:
- **Import Selected DeskMap(s)**
  - Rebuilds/loads selected source nodes into Flow Chart.
- **Import + Append**
  - Adds selected source content to existing Flow Chart instead of replacing it.

### Print setup
- Orientation (portrait/landscape)
- Grid/page configuration
- Scale and placement adjustments

Before printing, verify boundary/seam alignment and page count.

---

## 8) Import/export and backups

### Import
- Use **Import CSV** at Home or **Upload Data** in-workspace (if shown in your toolbar) to load data.

### Export
- Use **Save Data** / export action for CSV backup.
- Use **Export Runsheet** when you need reporting output.

### Backup best practice
- Export before major edits.
- Export after milestone checkpoints.
- Keep timestamped backups when collaborating across teams.

---

## 9) Offline mode and sync expectations

LANDroid includes offline-friendly behavior:
- App shell is service-worker cached for repeat loads.
- Workspaces are stored in local browser storage.

### Important notes
- Data is local to the browser profile/device unless you export/import manually.
- “Cloud sync unavailable” indicators generally reflect network status; local editing still works.

---

## 10) Standard operating workflow (recommended)

1. Open Home and pick/create workspace.
2. Build chain structure in **Desk Map**.
3. Add related docs and loose records as needed.
4. Audit in **Runsheet** (Active vs All DeskMaps as needed).
5. Build final exhibit in **Flow Chart** using source filters and import/append tools.
6. Save workspace and export backups.
7. Return to Home for workspace switching or archival actions.

---

## 11) Troubleshooting

### “I don’t see a record where expected”
- Confirm current DeskMap/view filters.
- In Runsheet/Flow, switch from Active DeskMap to All DeskMaps.

### “Totals look off”
- Verify entries are correctly marked as conveyance vs related doc.
- Recheck conveyance mode/basis for the affected transaction.

### “Print output is clipped”
- Reposition content in Flow Chart.
- Adjust orientation and tree scale.
- Re-run print preview before final output.

### “I need to change workspaces safely”
- Save current workspace.
- Export CSV backup.
- Use Save + Home, then open target workspace.

---

## 12) Team conventions (recommended)

- Keep instrument naming consistent.
- Use DeskMap naming standards (`TRACT-1`, `TRACT-2`, etc.).
- Resolve loose records before final issue, or annotate intentional exceptions.
- Perform final QA pass in Runsheet before generating Flow exhibit.
