# Phase 0 Performance Baseline Capture

This walkthrough records repeatable performance baselines for
`docs/phase-0-inventory.md` PERF-01 through PERF-08.

Do not mark a baseline as captured unless the fixture, machine profile, command,
browser profile, and result are all recorded. Guesses do not count. Neither does
"felt fine on my machine," which is how software quietly turns into a haunted
deed room.

## Scope

Phase 0 captures current behavior. It does not optimize performance.

In scope:

- Record the machine and runtime context.
- Use deterministic Phase 0 fixtures.
- Save browser profiles or command output under `fixtures/phase-0/perf/`.
- Update `fixtures/phase-0/perf/baseline-status.json` with measured results.

Out of scope:

- Sharding storage.
- Rewriting render paths.
- Changing autosave behavior.
- Rebuilding the Raven Forest stress fixture in app code before Phase 0.5.

## Required Machine Profile

Run these before capturing any baseline:

```bash
git rev-parse HEAD
git status --short --branch
sw_vers
node -v
npm -v
sysctl -n machdep.cpu.brand_string
sysctl -n hw.ncpu
sysctl -n hw.memsize
```

Also record the browser manually:

- Chrome version: `chrome://version`
- Device class: Mac laptop, iPad Pro, iPad Air, or documented equivalent
- Power mode: plugged in or battery
- Dev-server mode: Vite dev server or production preview
- Browser storage state: clean profile or existing LANDroid profile

If a command is blocked by local permissions, record the failure in the status
file instead of inventing the value.

## Output Layout

Create one folder per capture run:

```text
fixtures/phase-0/perf/
  README.md
  baseline-status.json
  2026-05-24-macbook-pro/
    machine-profile.txt
    perf-01-large-desk-map-render.json
    perf-02-document-registry-load.json
    perf-03-packet-preview-build.json
    perf-04-landroid-round-trip.txt
    perf-05-autosave-debounce.json
    perf-06-flowchart-print.json
    perf-07-spreadsheet-parse.txt
    perf-08-leasehold-transfer-order.txt
```

Use a dated folder name and keep the raw profile files. The summarized result in
`baseline-status.json` should point back to the raw file.

## Fixture Rules

- W1: `fixtures/phase-0/demo.landroid`
- W2: Raven Forest-scale generated fixture from
  `fixtures/phase-0/raven-forest-stress-recipe.md`
- W3: `fixtures/phase-0/migration-v7-orphan.landroid`

W2 is intentionally a recipe right now. Do not record W2 baselines until the
generated stress fixture exists for the rebuild and has a deterministic seed,
checksum, row counts, and fixture manifest.

## Baseline Steps

### PERF-01 - Large Desk Map Render

Fixture: W2.

1. Start the app:

   ```bash
   npm run dev
   ```

2. Open the app in Chrome.
3. Load the W2 stress fixture.
4. Activate the largest tract or the tract named by the W2 manifest.
5. Use Chrome Performance Insights or the Performance panel.
6. Record:
   - first contentful paint for the Desk Map view
   - time to interactive after tract activation
   - visible node count
   - browser profile JSON path

Drift budget: +/- 15%.

### PERF-02 - Document Registry Load

Fixture: W2 with stubbed document blobs.

1. Load W2.
2. Open the Documents view.
3. Record a Chrome Performance profile for the first load.
4. Record:
   - time to render the first 25 rows
   - document row count
   - duplicate-map computation time if separately measurable
   - profile JSON path

Drift budget: +/- 15%.

### PERF-03 - Packet Preview Build

Fixture: W2.

1. Load W2.
2. Open the Documents packet/export surface.
3. Set packet source to filter mode with broad filters.
4. Build a packet preview of about 40 documents.
5. Record:
   - preview build wall-clock time
   - document count
   - manifest generation time if separately measurable
   - profile JSON path

Drift budget: +/- 15%.

### PERF-04 - `.landroid` Round Trip

Fixture: W2.

1. Export W2 as `.landroid`.
2. Import the exported package back into a clean browser profile.
3. Record:
   - export wall-clock time
   - import wall-clock time
   - package size
   - peak heap during import if the browser profile exposes it
   - resulting checksum or fixture manifest path

Drift budget: +/- 20%.

### PERF-05 - Autosave Debounce

Fixture: W1.

1. Load `fixtures/phase-0/demo.landroid`.
2. Edit one Desk Map node field.
3. Record the time between edit and IndexedDB write completion.
4. Record:
   - observed debounce delay
   - snapshot serialization time
   - whether the expected target is still `2000ms +/- 50ms`
   - profile JSON path

Drift budget: +/- 10%.

### PERF-06 - Flowchart Print

Fixture: W2.

1. Load W2.
2. Open Flowchart.
3. Use the deterministic layout specified by the W2 manifest.
4. Trigger print preview.
5. Record:
   - print overlay render time
   - number of pages
   - per-page render time when available
   - screenshots or profile JSON path

Drift budget: +/- 15%.

### PERF-07 - Spreadsheet Import Parse Only

Fixture: `fixtures/phase-0/import-stress.csv` once created.

1. Generate or load a deterministic 5,000-row CSV fixture.
2. Open the spreadsheet import wizard.
3. Upload the CSV.
4. Stop before applying rows to the workspace.
5. Record:
   - worker parse time
   - main-thread block time
   - row count
   - parse warning count
   - command output or profile path

Drift budget: +/- 20%.

### PERF-08 - Leasehold Transfer-Order Build

Fixture: W2.

1. Load W2.
2. Open Leasehold.
3. Set unit focus to `Raven Forest A` or the unit named by the W2 manifest.
4. Trigger the transfer-order / decimal-row build.
5. Record:
   - row build wall-clock time
   - lease count
   - ORRI/WI/NPRI burden count
   - command output or profile path

Drift budget: +/- 15%.

## Status Update Rule

After every capture run, update `fixtures/phase-0/perf/baseline-status.json`.

Allowed statuses:

- `not_captured`
- `blocked_fixture_missing`
- `blocked_tooling`
- `captured`
- `superseded`

Each captured row must include:

- fixture name
- fixture checksum or manifest path
- machine profile path
- command or browser action
- baseline result
- raw profile path
- drift budget
- reviewer/date

If a value is not measured, leave it null and explain why in `notes`.
