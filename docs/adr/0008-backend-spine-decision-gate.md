# ADR 0008: Minimal Backend Spine Before Storage Sharding

## Status

Accepted for rebuild planning; minimal implementation starts in Phase 0.75.

## Context

LANDroid is local-first today, but the expected growth path includes large
document vaults, OCR, packet exports, AI/RAG over evidence, multi-device use,
backup, and possible future collaboration. A backend could make those concerns
more durable, but it also adds API contracts, schema migrations, auth,
deployment, cloud cost, monitoring, and new failure modes.

Phase 0 is now closed with current-behavior tests, smoke artifacts, performance
captures, and print confirmation. The next risk is total rebuild cost: if
Phase 0.5 shards Dexie around purely browser-local shapes, every later backend
addition would reopen record IDs, versioning, tombstones, document object
identity, action/audit shape, `.landroid` export format, and sync/security
boundaries. The user has limited work windows and prefers more upfront planning
and minimal implementation now if it reduces repeated retrofit work later.

The product direction remains hosted web/PWA first, local-first, and exportable.
Complete `.landroid` package export is permanent.

## Decision

Start Phase 0.75 as a minimal backend-spine phase before Phase 0.5 storage
sharding.

This is not approval for the full backend. The minimal spine owns contracts and
proof points:

- shared TypeScript/Zod record and API schemas
- a versioned `RecordEnvelope` with stable IDs, `workspaceId`, `projectId`,
  schema version, revision, `lastModified`, optional tombstone, and sync state
- a local adapter boundary so the app can run `local-only`, `mock`, or hosted
  modes without changing domain code
- a minimal backend package with health/session and record-validation endpoints
- Cognito-authenticated session proof and server contract version reporting
- a non-user-facing app startup check that proves the adapter path without
  sending real project records or changing user workflows
- separate hosted `/api/spine/*` Lambda/rewrite wiring for the contract proof,
  instead of merging project-record responsibilities into the AI proxy
- deployment and test hooks that prove the backend path exists without making
  it the source of truth

Phase 0.5 sharded Dexie rows must mirror this backend-shaped contract. Records
that are local-only projections or caches must be explicitly labeled as such.

The backend is a spine, not a wholesale SaaS rewrite. It may own:

- durable project-record storage
- object storage for originals, derivatives, and packet artifacts
- signed document access URLs
- OCR, extraction, indexing, and packet-export background jobs
- exact/keyword search and later vector recall
- server-controlled AI/RAG retrieval and provider policy
- durable action/audit records
- backup and multi-device sync
- future multi-user permissions
- future cross-project party identity indexes

Those full responsibilities remain later gates. The Phase 0.75 spine must not
remove local-first project semantics, require network access for core workflows,
upload document bytes by default, enable collaboration, or replace `.landroid`
export.

Likely minimal starting shape:

```text
Frontend: React/Vite LANDroid
Local runtime/cache: Dexie
Backend adapter: local-only/mock/hosted
Backend API: separate Node 22 Lambda-style spine package
Phase 0.75 endpoints: health, session, record validation
Auth: Cognito for hosted proof
Storage: no durable project-record DB yet
Object storage: none yet
Jobs/search/sync: none yet
Export: .landroid package remains mandatory
```

## Consequences

- Phase 0.75 adds implementation work, but only the contract/spine layer.
- Full backend storage, object storage, OCR, search, sync, sharing, and
  collaboration stay out of scope until explicit later gates.
- Backend work must update security, deployment, testing, and architecture docs
  in the same phase.
- The app may probe the spine contract internally, but failed probes must not
  block local-first workflows or make the backend the source of truth.
- Phase 0.5 storage sharding remains the next storage-scale step, but it must
  use the Phase 0.75 record envelope and compatibility rules.
- Hosted web/PWA is the product direction. Native iOS and desktop installers
  remain deferred unless a later decision gate proves they are necessary.
- This spends more time/tokens before sharding, but should reduce total
  context churn by avoiding repeated redesign of Dexie tables, `.landroid`
  formats, action/audit records, and document object identity.
