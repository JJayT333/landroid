# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Active Ticket Handoff - 2026-06-07

Current workstream: project picker import/index correctness.

Branch: `feat/project-picker-landing`

Worktree: `/private/tmp/landroid-project-picker-landing`

Remote PR: #131, `feat(workspace): add project picker landing`.

Base state: PR #132, `fix(springhill): restore LCT lease in sample`, was
squash-merged to `main` at
`ef442fabf18d86ee6d789237ca5c827e75b343af`. This branch was rebased onto that
post-#132 `main` and then corrected for the project-index import bug found in
the June 6 audit.

### Scope

- Keep the browser-local project picker landing surface: create, open, rename,
  duplicate, and typed-confirm-delete project flows.
- Keep Dexie v13 `savedProjects` index rows and per-project workspace storage
  keys so project switching does not reuse another project's workspace, canvas,
  side-store, or title-ledger rows.
- Fix workspace-replacing imports. `.landroid`, Springhill sample, and CSV
  imports now enter through `src/app/project-workspace-lifecycle.ts`, which
  flushes the previous project, creates or reconciles the imported project
  identity, switches the active project storage key, writes imported side
  stores/snapshot/canvas under that key, then hydrates the visible workspace.
- Preserve the blank-startup guard. The implicit default `Untitled Workspace`
  shell, including a Desk Map shell with no nodes or leasehold rows, must not
  create a saved-project index row. Explicitly created blank projects under a
  per-project key still remain indexed.

### Latest Validation

Passed locally in this worktree:

- `npm test -- src/app/project-workspace-lifecycle.test.ts src/storage/__tests__/active-workspace-key.test.ts src/storage/__tests__/persistence-db-key.test.ts src/storage/__tests__/workspace-shard-writer.test.ts`
  passed, 4 files / 26 tests.
- `npm run lint`
  passed.
- `npm test`
  passed, 135 files / 927 tests. Existing intentional stderr appeared for
  simulated title divergence, Dexie cleanup failure, and post-v8 backup failure
  paths.
- `npm run build`
  passed with existing Node `module.register()` deprecation, Vite
  dynamic/static import, and large-chunk warnings.
- `npm run test:e2e -- --grep "project picker creates"`
  passed, 1 Chromium test.
- `git diff --check`
  passed.

### Open Risks / Deferred

- PR #131 has not been pushed after the rebase/import fix yet.
- GitHub CI must be re-run on the updated branch before marking #131 ready.
- No cloud, Dropbox, sync, non-`.landroid` export format, title read-flip
  production enablement, Springhill follow-up, T8-T19, demo polish, branch
  pruning, federal/private math, or drill-site tract designation is included.
- Do not work from the noisy root checkout. Do not stage root noise:
  `.worktrees/`, archived audit docs, or root `scripts/springhill/`.

### Likely Next Steps

1. Commit the #131 import/index correctness fix.
2. Force-with-lease push `feat/project-picker-landing`.
3. Update PR #131 with the bug, fix, validation, and remaining risks.
4. Wait for GitHub CI and confirm PR #131 is no longer conflicting before
   marking it ready.

Paste-ready next chat prompt:

> Read `/Users/abstractmapping/projects/landroid/AGENTS.md`,
> `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`,
> `/Users/abstractmapping/projects/landroid/docs/README.md`, and
> `/private/tmp/landroid-project-picker-landing/CONTINUATION-PROMPT.md`.
> Continue branch `feat/project-picker-landing` in
> `/private/tmp/landroid-project-picker-landing`. PR #132 is merged into main;
> this branch is rebased onto post-#132 main. Finish the project picker
> import/index correctness fix: imports must select their own project storage
> key before side-store/snapshot/autosave writes, blank startup shells must not
> become saved projects, and #131 must not include Springhill follow-up,
> T8-T19, demo polish, branch pruning, federal/private math, or drill-site tract
> designation.
