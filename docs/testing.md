# Testing & Validation Strategy

## Primary test path
- `npm test`
- Runs Jest test suite (`jest --runInBand`).

## Environment fallback path
Some environments do not permit installing dependencies from npm registry. When Jest cannot run, use:

- `npm run test:smoke`

This smoke check validates:
- critical module exports
- audit log basic persistence behavior
- sync op-log pending/synced summary behavior
- dropbox metadata normalization seam
- workspace domain save payload hygiene (name trim + docData stripping)

## Recommended CI behavior
1. Run `npm test`.
2. If dependency install is blocked by environment policy, run `npm run test:smoke` and mark build with warning.
3. Keep both checks green during iterative refactors.
