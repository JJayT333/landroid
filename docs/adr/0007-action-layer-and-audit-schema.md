# ADR 0007: Action Layer And Audit Schema

## Status

Proposed for rebuild planning.

## Context

LANDroid needs mutation history, approval records, undo boundaries, and
attorney-grade provenance. A pure event-sourced domain model is too large a
rewrite and does not match the way the current app represents title work.

The rebuild should keep records as business truth while making meaningful
changes reviewable and auditable.

## Decision

The domain truth is a project record schema, not an event log.

The action and audit layer sits over records:

- `ActionPlan` represents a typed proposal or dry run before mutation
- user approval is required before mutating title, lease, owner, document,
  import, curative, or AI-proposed records
- `ActionRecord` represents an approved change that should survive reload/export
  when intended
- `AuditEvent` records meaningful vault, packet, import, AI-approval, and
  destructive actions and can support hash continuity
- documents and binary evidence do not live inside action records
- `MathInputView` insulates existing Texas math from rebuild record-shape churn

Phase 1 defines the schema. Phase 3 consumes `ActionPlan` for staged imports.
Phase 4 makes the action layer the canonical mutation path one workflow at a
time after parity checks pass.

## Consequences

- The app avoids a whole-app event-sourced rewrite.
- Import and AI work must produce typed previews before mutations.
- Durable auditability improves without making event replay the source of truth.
- Existing stores remain operational until each workflow passes parity.
