# Testing & Validation Strategy

## Primary test path
- `npm test`
- Runs local Node-based validation chain:
  1. `npm run test:smoke`
  2. `npm run test:storage`

## Why this path
- LANDroid currently uses local Node scripts for regression checks in constrained environments.
- This keeps test execution reliable without external dependency installs.

## Individual checks
- `npm run test:smoke`
  - critical module export checks
  - audit log basic persistence behavior
  - sync op-log pending/synced summary behavior
  - dropbox metadata normalization seam
  - workspace domain save payload hygiene (name trim + docData stripping)

- `npm run test:storage`
  - workspace IndexedDB/localStorage persistence flow
  - save/load/sort/delete/deleteAll workflows

## Recommended CI behavior
1. Run `npm test`.
2. Treat any failure as blocking for local-first runtime changes.
3. Keep both checks green during iterative refactors.
