# Testing & Validation Strategy

## Primary test path
- `npm test`
- Runs Node-based smoke + storage checks (`test:smoke` and `test:storage`).

## Environment fallback path
`npm run test:smoke` validates general module and integration seams.

`npm run test:storage` validates workspace-storage behavior using an IndexedDB/localStorage mock.

Smoke check validates:
- critical module exports
- audit log basic persistence behavior
- sync op-log pending/synced summary behavior
- dropbox metadata normalization seam
- workspace domain save payload hygiene (name trim + docData stripping)

## Recommended CI behavior
1. Run `npm test`.
2. Keep both `test:smoke` and `test:storage` green during iterative refactors.
3. Optionally run browser smoke checks for UI regressions.
