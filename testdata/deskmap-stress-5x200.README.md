# DeskMap Stress Dataset (5x200)

Generated via:

```bash
node scripts/large-deskmap-stress.js
```

## Files

- `deskmap-stress-5x200.workspace.json`
  - Full workspace-style payload with `deskMaps`, `tracts`, and `activeDeskMapId`.
- `deskmap-stress-5x200.import.csv`
  - Importable CSV for LANDroid `Import CSV` flow.
  - Use import mode `1` (replace) to load all five maps from the embedded `INTERNAL_DESKMAPS` payload.
- `deskmap-stress-5x200.summary.json`
  - Quick summary of generated map counts/types.
- `split-tract-imports-5x200/`
  - Five separate import CSVs (`deskmap-stress-tract-1-200.import.csv` ... `deskmap-stress-tract-5-200.import.csv`).
  - Each file carries one tract/map with 200 entries and full internal metadata.

## Coverage included

Each map has exactly 200 entries and mixes:

- Conveyances across varied transfer math outcomes (all/fixed/fraction-like ratios).
- Parent/child branching trees with branch scaling operations.
- Predecessor-style insertion with descendant scaling.
- Attach-like reparenting from unlinked branches into active trees.
- Related (non-conveyance) records.
- Residual unlinked records.

All generated maps are deterministic and validated for:

- finite/non-negative fractions,
- parent/link integrity,
- cycle-free hierarchy,
- root-level ownership totals within tolerance.
