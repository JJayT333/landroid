# ADR-0001: LANDroid Evolution Direction (Local-first Monolith with Cloud-ready Boundaries)

- **Status:** Accepted
- **Date:** 2026-03-10

## Context
LANDroid currently runs as a browser-loaded app using runtime Babel and persists workspaces in IndexedDB with localStorage metadata for the last workspace id.

The app must evolve toward Dropbox-first collaboration without breaking existing users' local workflows.

## Decision
Adopt a **monolith-first, modular-boundary** approach:

1. Keep the current browser app workflow fully operational.
2. Introduce internal boundaries for domain, storage providers, migration, and integrations.
3. Treat existing IndexedDB/localStorage persistence as the compatibility baseline.
4. Add new capabilities (cloud/dropbox/sync) behind explicit boundaries and feature flags.

## Compatibility Guardrails
- Existing local workspace flows remain available and default-safe.
- Existing persisted data remains readable after upgrades.
- No removal of current IndexedDB/localStorage behavior until a migration path is implemented and validated.

## Initial Modular Boundaries
- `src/domain/*`: canonical entities + adapters.
- `src/storage/*`: provider interface with local implementation.
- `src/storage/migrations/*`: schema version migration pipeline.
- `src/integrations/dropbox/*`: Dropbox-specific metadata/auth helpers.

## Why this direction
- Preserves current user behavior while enabling progressive modernization.
- Keeps implementation reversible and low-risk per iteration.
- Improves AI-assisted implementation confidence by reducing implicit coupling.

## Consequences
### Positive
- Backward-compatible evolution path.
- Reduced regression risk from feature additions.
- Cleaner introduction point for Dropbox and cloud sync.

### Trade-offs
- Slightly more indirection before feature velocity accelerates.
- Requires discipline around boundary ownership.
