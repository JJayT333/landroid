# Phase 0 Performance Baselines

This folder is reserved for Phase 0 performance capture outputs.

Current status: baseline capture is documented, but the PERF-01 through PERF-08
measurements are not captured yet.

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
