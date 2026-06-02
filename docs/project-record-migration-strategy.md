# Project Record Migration Strategy

Status: v9 action-ledger durability is implemented for `.landroid` export/import.
The full project-record read cutover remains deferred.

## Current Format

The live package format is `LANDROID_FILE_VERSION = 9`. Export/import still
serializes the current `WorkspaceData` snapshot plus side-store sections for
documents, owners, maps, research, curative records, and canvas state. The
snapshot remains authoritative on import.

v9 may add one optional envelope key, `actionLedger`, when manual save is given
non-empty title action/audit rows. The ledger is a valid `ProjectRecordBundle`
containing only `action_record` and `audit_event` rows from the title action
log. It does not contain the full projected record set because those records are
reconstructable from the snapshot. Empty ledgers omit the key.

v8 and older packages remain readable. Unknown future versions are rejected
before workspace normalization or side-store replacement.

## Current Write Strategy

The record-bearing package format is explicit, not an unannounced extension of
v8. The export writer must:

- keep the complete local snapshot and side-store payload as the rollback
  source
- add only the validated title `action_record` and `audit_event` rows under
  `actionLedger`
- validate the bundle with `ProjectRecordBundleSchema`
- verify the audit chain before writing the ledger
- include document bytes only in the existing package sections
- omit `actionLedger` when there are no ledger rows

## Current Import Strategy

Import must continue to dispatch by file version. The safe import sequence for a
record-bearing version is:

1. Parse the package envelope and reject unknown future versions before any
   store replacement.
2. Validate the existing snapshot/side-store sections through the current
   normalizers.
3. If `actionLedger` is present, validate it with `ProjectRecordBundleSchema`
   and verify the audit chain.
4. If ledger validation fails, drop the ledger, warn, and continue with the
   snapshot.
5. Keep the snapshot authoritative until a later workstream proves workflow
   parity and explicitly migrates a surface to records.

## Required Tests

- v8 import compatibility and future-version rejection
- `.landroid` export/import round trip with `actionLedger` present
- rollback-safe snapshot return when ledger validation fails
- serialization round trip for every declared record type
- `MathInputView` parity against Phase 0 goldens for decimal/fraction display,
  lease allocation order, warning-only states, and jurisdiction isolation
