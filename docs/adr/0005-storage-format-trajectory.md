# ADR 0005: Storage Format Trajectory

## Status

Proposed for rebuild planning.

## Context

LANDroid is local-first today. Browser IndexedDB/Dexie is the current runtime
store, while `.landroid` import/export carries project snapshots. LANDroid is
now planned as a hosted web app first with PWA/iPad support, so browser storage
must be treated as a serious runtime rather than a toy cache. Large title
projects such as Raven Forest can grow beyond what a single autosaved workspace
payload should carry comfortably, especially when records, packets, OCR text,
and document evidence become first-class.

The rebuild needs a professional durability story without forcing a premature
backend, desktop shell, or database migration.

## Decision

LANDroid stays local-first for the rebuild.

Storage changes are staged:

1. Preserve current browser/Dexie behavior until Phase 0 inventory and golden
   masters exist.
2. Add Phase 0.5 workspace sharding inside Dexie before broad record-schema
   work. Phase 0.5 must also cover multi-tab protection, persistent-storage
   requests where supported, lazy document/PDF blob loading, canvas viewport
   persistence, and measured Raven Forest-scale behavior on iPad Pro-class
   hardware or a documented equivalent.
3. Treat document originals, checksums, source metadata, and package manifests
   as canonical evidence state.
4. Treat OCR text, embeddings, FTS rows, page images, and packet exports as
   rebuildable derivatives.
5. Evaluate SQLite WASM in OPFS only when query/search needs justify it.
6. Consider Tauri/native filesystem only when local OCR process control,
   Finder-visible project packages, native SQLite, or corpus size forces it.
7. Treat cloud object storage as an adapter boundary, not the Phase 1 source of
   truth.
8. Treat backend implementation as approved in principle but deferred until a
   hard trigger such as OCR/search scale, multi-device sync, live sharing,
   second-user access, or browser storage limits. Phase 0.5 through Phase 6
   must use backend-ready local data shapes so the later backend is a sync/job
   layer rather than a rewrite.

## Consequences

- The rebuild does not start by replacing the app shell or all persistence.
- Phase 0.5 becomes a required scale-risk step before Phase 1 implementation.
- `.landroid` import/export and in-flight migration safety stay part of the
  contract.
- Complete `.landroid` export stays permanent even after backend/sync work.
- Backend-ready record shape matters before backend code exists: stable IDs,
  `workspaceId`, `lastModified` / version metadata where needed, and
  content-hash references for blobs.
- Future SQLite, Tauri, or object-storage work needs its own decision gate.
