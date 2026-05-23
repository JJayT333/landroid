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

The fixture uses deterministic stub PDF blobs so the document registry, packet manifest, and `.landroid` side-store shape are testable without committing the large TORS document corpus.

Regenerate with:

```bash
./node_modules/.bin/tsx scripts/generate-phase-0-fixtures.ts
```
