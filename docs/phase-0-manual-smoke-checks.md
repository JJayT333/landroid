# Phase 0 Manual Smoke Checks

This runbook captures the manual checks needed before rebuild implementation
starts. Automated golden-master tests catch deterministic outputs; these checks
catch workflow feel, visible UI contracts, print surfaces, previews, and safety
states that are expensive or brittle to automate right now.

Phase 0 smoke checks are observational. Do not fix bugs during the run. Record
the behavior, console errors, screenshots, exported artifacts, and whether the
behavior should be preserved or intentionally changed in the rebuild.

## Ground Rules

- Use a clean browser profile when possible.
- Keep the devtools console open.
- Record browser, OS, branch, commit, fixture, and date.
- Do not run the full runsheet walkthrough wizard unless the user explicitly
  redirects to that scope.
- Do not overwrite committed fixture files from the app.
- Export a `.landroid` backup before any destructive or mutating smoke check.
- If a check risks corrupting local project data, run it against W1 Vulcan Mesa
  only.

Recommended capture folder:

```text
fixtures/phase-0/manual-smoke/
  2026-05-24-vulcan-mesa/
    notes.md
    screenshots/
    exports/
    console.log
```

Do not commit large screenshots or browser artifacts unless they are small and
reviewable. If they are too large, commit a manifest with local path, checksum,
file size, and date.

## Setup

1. Confirm branch and commit:

   ```bash
   git status --short --branch
   git rev-parse HEAD
   ```

2. Start the app:

   ```bash
   npm run dev
   ```

3. Load W1 Vulcan Mesa:
   - Prefer app import from `fixtures/phase-0/demo.landroid`.
   - If using Demo Data, confirm it loads the renamed Vulcan Mesa demo, not the
     old internal fixture name.

4. Confirm the browser console is clean except for known development-mode
   warnings.

## Desk Map

Goal: preserve the primary title-tree work surface.

Check:

- Vulcan Mesa loads with expected tract tabs and active tract state.
- Title cards preserve grantor/grantee, instrument, dates, fractions, document
  chips, and warning badges.
- Fit-to-content centers the visible tree without losing cards offscreen.
- Pan/zoom feels usable and does not cause card click/drag confusion.
- Formula hover popovers show the decimal/fraction explanation.
- Clicking formula details still pins or opens the current comparison surface.
- NPRI discrepancy styling is visible and clears only when the underlying issue
  is corrected.
- Over-100% mineral coverage warning remains visible and warning-only unless
  the rebuild intentionally changes that policy.
- Predecessor insert, conveyance, attach/graft, rebalance, and delete-branch
  entry points are present and routed to preview/confirmation where expected.
- Attached document chips open the correct document preview.

Record:

- Screenshot of each major tract.
- Any console errors.
- Any workflow that feels hidden, ambiguous, or easy to misuse.

## Leasehold

Goal: preserve lease and transfer-order review behavior.

Check:

- Unit focus selector changes the visible leasehold rows.
- ORRI, WI, NPRI, retained WI, and lease royalty formulas display both decimals
  and fractions where currently expected.
- Included-in-math flags filter rows as they do today.
- Unit-scoped ORRI/WI records appear only in the focused unit.
- Transfer-order rows sort by current category/order rules.
- Variance, expected total, and total decimal displays match the W1 golden.
- Switching unit focus while a draft is in progress is recorded as either
  preserved behavior or intentional rebuild change.

Record:

- Screenshot of the focused unit summary.
- Screenshot of at least one formula popover.
- Any silent draft loss or surprising filter change.

## Documents

Goal: preserve document registry, document chips, preview, and packet behavior.

Check:

- Document registry opens from the main navigation.
- Saved views/filters render expected W1 document counts.
- Missing metadata, unlinked, duplicate, leasehold, and runsheet-like views
  still route to the expected document rows when present.
- Document metadata panel shows title, kind, county, recording reference, date,
  parties, source area, and links.
- PDF preview opens for stub fixture PDFs without loading every document into
  memory.
- Desk Map document chips open the same document record as the registry row.
- Packet preview produces the same document set as
  `fixtures/phase-0/demo.packet-manifest.json`.
- Export/download actions are visible but do not silently alter the registry.

Record:

- Screenshot of registry list + selected document.
- Packet preview count and manifest checksum if exported.
- Any broken preview, stale metadata, or wrong chip target.

## Runsheet

Goal: preserve chronological display and export shape.

Check:

- Runsheet opens without starting the walkthrough wizard.
- Rows are chronological by current sort behavior.
- Key columns match `fixtures/phase-0/demo.runsheet.csv`.
- Linked documents or recording references remain visible.
- CSV export matches the committed golden when run from W1.

Record:

- Screenshot of first visible rows.
- Exported CSV checksum if a manual export is performed.

## Flowchart And Print

Goal: preserve visual deliverables.

Check:

- Flowchart imports or reflects the active Desk Map tree as it does today.
- Node labels, fractions, and relationships remain legible.
- Pan/zoom/editing controls are visible.
- Page grid or print overlay appears.
- Print preview does not cut off essential nodes.
- Current viewport persistence behavior is recorded; today it is known as a
  Phase 0.5 risk if it does not survive reload.

Record:

- Screenshot of canvas.
- Screenshot or PDF of print preview if practical.

## Owners

Goal: preserve owner records as the project relationship hub.

Check:

- Owner list opens and shows expected W1 owners.
- Owner detail shows contacts, documents, leases, and Desk Map link options.
- Linked leases and documents match the selected owner.
- Creating/editing owner data prompts through current UI guardrails.
- Removing a link does not imply deleting shared document originals.

Record:

- Screenshot of an owner with at least one lease/document relationship.
- Any duplicate-party or stale-link behavior.

## Curative

Goal: preserve issue tracking and entity linkage.

Check:

- Curative issue list opens.
- Status, priority, notes, and linked entity chips display.
- Issue links route back to Desk Map, owner, document, or research records where
  applicable.
- Closing/reopening an issue is either confirmed or clearly reversible.

Record:

- Screenshot of issue list and one issue detail.
- Any missing link target.

## Maps And GIS Evidence

Goal: preserve maps as evidence/reference, not hidden decoration.

Check:

- Maps view opens and lists map assets.
- PDF and passive map uploads follow current file safety rules.
- GeoJSON summary or geometry metadata displays where present.
- Linked map evidence routes to the related project record or Desk Map context.
- Map PDFs preview without script execution or unsafe file handling.

Record:

- Screenshot of map list and selected asset.
- Any file type accepted unexpectedly.

## Research

Goal: preserve research records/imports and external evidence organization.

Check:

- Research home opens.
- Existing record categories, import metadata, source notes, and formula
  starters display.
- RRC dataset helpers still show expected catalog/sample behavior.
- Research records remain reference/project evidence and do not alter Texas
  title math unless explicitly designed to do so later.

Record:

- Screenshot of Research home.
- Screenshot of one imported/sample record if available.

## Federal Leasing

Goal: preserve federal leasing as reference-only with no Texas math effect.

Check:

- Federal Leasing opens.
- BLM/federal lease records display as inventory/reference records.
- Expiration, target, source packet, and mapped evidence fields remain visible
  where present.
- No federal lease record changes Desk Map mineral math, Leasehold decimals,
  NPRI, ORRI, WI, payout, or transfer-order totals.

Record:

- Screenshot of Federal Leasing list/detail.
- Before/after Texas math totals if any federal field is touched.

## AI Approval And Context

Goal: preserve safe AI behavior and approval boundaries.

Check:

- AI panel opens without requiring a cloud key for local/offline mode setup.
- Provider settings still distinguish local/Ollama from hosted providers.
- Read-only questions can use visible app context.
- Mutating proposals create approval cards instead of immediate edits.
- Preview shows before/after and validation state where current tools support
  it.
- Blocked previews cannot be approved.
- Approved proposals write to the action journal.
- Undo restores the prior state for AI-approved mutations.
- The system prompt core rules match
  `fixtures/phase-0/ai/system-prompt.snapshot.md`.

Record:

- Screenshot of one read-only answer context if safe.
- Screenshot of one pending approval card.
- Any proposal that mutates immediately or lacks undo.

## Persistence, Import, Export, And Recovery

Goal: preserve the user's escape hatch and prevent silent data loss.

Check:

- `.landroid` export succeeds from W1.
- Exported package re-imports into a clean profile.
- Future-version rejection remains visible and non-destructive.
- Side-store replacement clears stale owners/documents/maps/research/curative
  data when importing another workspace.
- W3 migration fixture routes orphaned pre-v8 PDFs to the expected orphan
  workspace behavior.
- Autosave state is visible enough to tell whether edits are persisted.
- Multi-tab behavior is recorded as current risk if last-write-wins remains
  silent.

Record:

- Exported package checksum.
- Import result notes.
- Any stale side-store or silent overwrite behavior.

## Stop Conditions

Stop the run and record a blocker if any of these occur:

- `.landroid` import/export corrupts or loses records.
- A document chip opens the wrong document.
- Texas math changes after reference-only federal edits.
- AI mutates workspace data without approval.
- A blocked AI preview can be approved.
- Console errors appear during normal lane navigation.
- Browser storage warning, quota failure, or IndexedDB failure appears.
- Print/export produces blank or cut-off deliverables.

## Completion Criteria

A manual smoke run is complete when:

- Every lane above has a pass/fail/blocked note.
- Screenshots or artifact references exist for high-risk lanes.
- Console state is recorded.
- Export/import checksums are recorded when run.
- Any behavior mismatch is linked back to a row in
  `docs/phase-0-inventory.md` or marked `needs verification`.
