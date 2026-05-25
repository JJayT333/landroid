# Phase 0 Performance Baselines

This folder is reserved for Phase 0 performance capture outputs.

Current status: the 2026-05-24 closeout capture records PERF-01 through
PERF-06 and PERF-08 under `2026-05-24-codex-closeout/`. PERF-07 remains
blocked until `fixtures/phase-0/import-stress.csv` exists.

Use:

```bash
scripts/capture-phase-0-baselines.md
```

The status file in this folder is intentionally explicit about missing data.
Phase 0 should not close until every PERF row is either captured or deliberately
deferred with a documented reason.

Do not commit large browser trace files unless they are small enough to review.
If a Chrome trace is too large, store it outside git and commit a summary row
with the local path, file size, checksum, and capture date.

The W2 `.landroid` UI export produced during the 2026-05-24 closeout run was
about 15.8 MB, so the capture script imported it, recorded its checksum and
size, then removed it from the working tree instead of committing the package.
