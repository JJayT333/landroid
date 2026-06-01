# Evidence Vault Notes

Workstream: document vault and packet model.

Assumptions recorded during implementation:

- This slice is additive and rollback-safe. Existing v8 `.landroid` package
  shape, IndexedDB side stores, Documents view, Desk Map document chips, and
  current packet preview remain the runtime source of truth.
- The unified model is projected under `src/project-records/evidence-vault.ts`.
  It does not delete, rewrite, or migrate owner documents, map assets, research
  imports, or registry documents in Dexie.
- Existing registry `DocumentRecord.contentHash` values must already be valid
  SHA-256 hashes. Blob-backed owner docs, map assets, and research imports do
  not have persisted hashes yet, so the projection computes SHA-256 from their
  current blobs when building evidence-vault records.
- Document records are stable project entities; each original gets a
  `document`, `document_version`, and original `vault_object`, while links are
  represented by `document_link` rows.
- Link deletion in the project-record layer removes only `document_link` rows.
  Documents, versions, and vault objects are not auto-deleted by record-layer
  link removal. The live document store keeps its existing cascade behavior:
  node/tract deletes remove affected links and delete a document only when that
  same removal leaves no surviving links.
- Registry attachment ordering is preserved from
  `document_attachments.position`. Side-store links use deterministic
  source-order positions scoped by `workspaceId`, `entityKind`, and `entityId`.
- Map asset `deskMapId` links project as `tract` links using the current
  `DeskMap.tractId` when available, falling back to the Desk Map id.
- Research imports project as `import_row` links and also link to research
  sources/project records that reference the import.
- Attorney packet export is modeled as deterministic JSON manifest records,
  packet item/export records, source-citation sidecars, unresolved-issue
  summaries, and optional eDiscovery load-file sidecars. A native ZIP/PDF
  writer is still a later packaging step.
- `VaultObject.derivedFromVaultObjectId` is optional and backward-compatible;
  no derivative objects are emitted until OCR/text/packet-copy artifacts exist.
