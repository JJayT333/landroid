# Phase 0 Fixtures

Generated reference artifacts for the Phase 0 behavior inventory.

## W1 - Vulcan Mesa

- `demo.landroid`: deterministic v8 workspace export for the Vulcan Mesa demo fixture.
- `demo.sha256`: SHA-256 checksum for `demo.landroid`.
- `demo.runsheet.csv`: runsheet CSV golden from the exported nodes.
- `demo.packet-manifest.json`: document packet manifest golden from the fixture document registry rows.
- `demo.leasehold-decimals.json`: leasehold decimal and transfer-order review golden.
- `demo.coverage-summary.json`: Desk Map mineral coverage summary golden per tract.
- `demo.fixture-manifest.json`: counts, generator name, and checksum metadata.
- `migration-v7-orphan.landroid`: hand-crafted legacy v7 import fixture with one linked PDF and one orphaned PDF.
- `migration-v7-orphan.expected.json`: expected migration behavior for the orphaned legacy PDF.
- `raven-forest-stress-recipe.md`: W2 instructions for rebuilding a Raven Forest-sized stress fixture later without committing today's exact seed.
- `raven-forest-stress-manifest.json`: deterministic W2 stress-fixture manifest generated from the current combinatorial seed.
- `raven-forest-stress-manifest.sha256`: SHA-256 checksum for `raven-forest-stress-manifest.json`.
- `ai/system-prompt.snapshot.md`: AI-036 golden snapshot for the ten non-negotiable system-prompt rules.
- `perf/`: Phase 0 performance baseline capture status and future raw/summarized profiles.

The fixture uses deterministic stub PDF blobs so the document registry, packet manifest, and `.landroid` side-store shape are testable without committing the large TORS document corpus.

Regenerate with:

```bash
./node_modules/.bin/tsx scripts/generate-phase-0-fixtures.ts
```

Performance capture is documented separately:

```bash
scripts/capture-phase-0-baselines.md
```

The current `perf/baseline-status.json` file is a status template, not evidence that PERF-01 through PERF-08 have been captured.
