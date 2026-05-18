# ADR 0001: Local-First Browser App

## Status

Accepted.

## Context

LANDroid is used for title, lease, owner, research, document, and map workflows
that may contain sensitive business data and PII. The current product is built
for a single user working locally.

## Decision

LANDroid remains a local-first browser application for the current phase.
Workspace data is stored in local browser IndexedDB and exported/imported through
`.landroid` files.

## Consequences

- Browser storage and local backups are part of the core workflow.
- Imports must treat files as untrusted because local-first does not mean safe.
- Cloud or multi-user deployment requires a separate security/design decision.
- Direct browser cloud-AI calls remain a local-user convenience, not a hosted
  production security model.
