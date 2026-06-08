# Springhill Sample Workflow

Springhill Dr. Elmore is stored in the app as a bundled `.landroid` sample:

- `public/samples/springhill-dr-elmore.landroid`

That file is the shareable, scrubbed sample loaded by
`Demo Data -> Dr. Elmore #1 Unit - Sample`. It is not the private source of
truth.

## Source Boundary

The private source build uses local operator files that must remain untracked:

- the NRI status workbook
- the DOTO/runsheet workbook
- the Springhill PDF packet

The raw generator embeds real owner addresses and real PDF blobs. It must write
only to a private path outside the repository. Do not point it at
`public/samples/`, and do not commit raw generator output.

## Regeneration Sequence

Use the bundled Python runtime when `openpyxl` is not installed in system
Python. Set private paths explicitly so the run is reviewable:

```bash
SPRINGHILL_SOURCE_DIR="/private/path/to/LANDroid - Springhill" \
SPRINGHILL_OUT="/private/path/to/Springhill_Dr-Elmore-1_PresentDay.landroid" \
SPRINGHILL_REPORT="/private/path/to/Springhill_Dr-Elmore-1_PresentDay.report.txt" \
python3 scripts/springhill/build_landroid.py
```

If the source folder layout differs, pass direct workbook paths:

```bash
python3 scripts/springhill/build_landroid.py \
  --runsheet "/private/path/DOTO_Runsheet_Elmore#1_Unit_2026_02-05.xlsx" \
  --nri "/private/path/Status_Springhill_Dr.Elmore#1_Unit_NRI_2026_03-09_RKH copy.xlsx" \
  --out "/private/path/Springhill_Dr-Elmore-1_PresentDay.landroid" \
  --report "/private/path/Springhill_Dr-Elmore-1_PresentDay.report.txt"
```

Then scrub the raw private output into the public sample:

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/springhill-scrub.ts \
  --in "/private/path/Springhill_Dr-Elmore-1_PresentDay.landroid" \
  --out "public/samples/springhill-dr-elmore.landroid"
```

Review the generator report and scrub report before committing the public
sample. The scrubber preserves names, nodes, fractions, and math; it only fakes
mailing addresses and replaces embedded PDF blobs.

## Merge Gate

For Springhill sample changes, do not claim source-to-output proof unless all of
these pass in the same branch:

```bash
npm test -- src/phase0/__tests__/springhill-sample.test.ts \
  src/components/deskmap/__tests__/deskmap-coverage.test.ts \
  src/components/leasehold/__tests__/leasehold-summary.test.ts \
  src/storage/__tests__/workspace-persistence.test.ts
npm run lint
npm test
npm run build
git diff --check
```

If the private workbooks are unreadable in the current environment, keep the PR
held or draft and state the boundary plainly. A bounded repo-local PDF proof can
justify a narrow correction, but it is not a complete workbook-to-public-sample
regeneration.
