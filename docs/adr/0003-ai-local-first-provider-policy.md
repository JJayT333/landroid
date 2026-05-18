# ADR 0003: AI Local-First Provider Policy

## Status

Accepted for the current single-user local workflow.

## Context

LANDroid has an AI assistant layer for local workflow help, workspace review, and
spreadsheet staging. The app may contain sensitive title, lease, owner, research,
and document data.

## Decision

Ollama/local models are the preferred default. Cloud providers are optional and
their API keys are session-only in browser memory. Cloud keys must not persist to
browser storage.

AI may perform live local workspace mutations in the current user-approved
single-user workflow, but it must capture rollback state before mutating and
show the user a way back from the latest AI change.

Spreadsheet imports should prefer deterministic row staging and user review over
blind bulk AI mutation.

## Consequences

- Direct browser cloud-provider use is acceptable only as a local-user tradeoff,
  not as a hosted production security model.
- Future hosted/cloud use should move provider keys behind a backend/proxy.
- AI mutation approval boundaries remain a high-priority hardening area tracked
  in `PATCH_PLAN.md`.
