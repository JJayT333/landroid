# Workspace Persistence Compatibility Contract

## Purpose
Define backward compatibility guarantees for LANDroid workspace persistence while evolving toward cloud-capable and Dropbox-first workflows.

## Current Storage Baseline (authoritative for compatibility)
From current implementation:

- localStorage key for last selected workspace id:
  - `landroid:lastWorkspaceId`
- IndexedDB:
  - DB name: `landroid-offline-db`
  - DB version: `1`
  - store: `workspaces` (`keyPath: id`)
  - index: `updatedAt`

## Current Workspace Record Shape
Workspace records are persisted as a copy of app data with storage metadata:

- `id` (string)
- `updatedAt` (number, epoch ms)
- all app workspace fields currently produced by `src/app.jsx`

## Compatibility Guarantees
1. Existing workspaces saved under the current `workspaces` store must continue to load.
2. Existing localStorage metadata key behavior is preserved.
3. New fields must be additive and default-safe.
4. Field removals/renames require explicit migration mapping.
5. Unknown fields must be preserved on load/save round-trips when possible.

## Migration Policy
- Introduce `schemaVersion` on persisted workspace payloads in a future incremental release.
- Add deterministic migration functions per version transition (N -> N+1).
- Migration functions must be idempotent for already-migrated records.
- If migration fails, do not silently discard data; surface recoverable error and preserve raw record for export/debug.

## Export/Import Backward Compatibility
- Export must include enough metadata to reconstruct current workspace payload.
- Import must accept historical payloads and apply migrations before hydration.
- Import validation errors should be explicit and non-destructive.

## Dropbox-Oriented Forward Contract
When Dropbox integration is enabled, attachment references should progressively move to metadata pointers (e.g., file id/path/rev/shared link), while preserving local workflows for existing records.

## Regression Checklist for Persistence Changes
- Load latest workspace still works.
- List workspaces sorted by `updatedAt` still works.
- Save updates localStorage last workspace id.
- Delete single workspace and delete-all keep metadata behavior correct.
