# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Active Ticket Handoff - 2026-06-07

Current workstream: hosted Springhill sample visibility.

Branch: `fix/hosted-landroid-static`

Worktree: `/private/tmp/landroid-hosted-landroid-static`

Base state: `origin/main` at `bf268e2 feat(workspace): add project picker
landing`. PRs #129, #130, #132, and #131 are merged. The hosted frontend at
`https://landroid.abstractmapping.com` has deployed the Dr. Elmore menu item,
but `/samples/springhill-dr-elmore.landroid` still serves `index.html` because
the Amplify SPA fallback rewrite did not exclude `.landroid` static assets.

### Scope

- Fix only hosted static asset serving for existing bundled assets.
- Keep `/api/ai/<*>` and `/api/spine/<*>` rewrite ordering unchanged.
- Exclude `.landroid`, `.pdf`, and `.pptx` from the SPA fallback so the
  Springhill sample package and existing bundled deck/PDF assets serve as files.
- Add repo-side predeploy and post-deploy smoke coverage so the issue is caught
  before or immediately after hosted deployment.

### Latest Validation

Passed in this worktree:

- `npm ci --offline` passed with the known Node 26 engine warning.
- `bash -n scripts/predeploy-check.sh scripts/smoke-test-hosted.sh` passed.
- Local backend bundle generation for ignored predeploy artifacts passed:
  `backend/ai-proxy/lambda.zip` and `backend/spine/lambda.zip` were generated
  locally and remain untracked.
- `npm run deploy:check` passed, including the `.landroid`, `.pdf`, and
  `.pptx` static asset allowlist guard.
- `npm run lint` passed.
- `npm run build` passed with existing Vite dynamic/static import warnings,
  large-chunk warnings, and Node `module.register()` deprecation warning.
- Built artifact check passed: `dist/samples/springhill-dr-elmore.landroid`
  exists and contains `OGML-LCT-Trust`, `Charlyn K. Tyra`,
  `Magnolia Petroleum Company, LLC`, and `one-year primary term`.
- `npm test -- src/phase0/__tests__/springhill-sample.test.ts` passed, 1 file
  / 2 tests.
- `git diff --check` passed.

Post-merge / post-Amplify deploy validation still required:

- `curl -I -L https://landroid.abstractmapping.com/samples/springhill-dr-elmore.landroid`
  must return the `.landroid` package, not `index.html`.
- `curl -fsSL https://landroid.abstractmapping.com/samples/springhill-dr-elmore.landroid`
  must contain `OGML-LCT-Trust` and `one-year primary term`.
- `bash scripts/smoke-test-hosted.sh` should pass against the hosted domain.

### Open Risks / Deferred

- This PR only changes the rewrite template and deployment checks. The currently
  hosted Amplify rewrite rules will not change until the branch merges to
  `main` and Amplify redeploys, or the JSON rewrite rules are manually updated
  in the Amplify console.
- No Springhill sample data, generator, lease math, project picker behavior,
  T8-T19, demo polish, branch pruning, federal/private math, or drill-site
  tract designation is included.
- Do not work from the noisy root checkout. Do not stage root noise:
  `.worktrees/`, archived audit docs, or root `scripts/springhill/`.

### Likely Next Steps

1. Finish validation in `/private/tmp/landroid-hosted-landroid-static`.
2. Commit and push `fix/hosted-landroid-static`.
3. Open a PR against `main`.
4. After merge and Amplify redeploy, run the hosted smoke script and confirm
   the Springhill sample URL serves package data.

Paste-ready next chat prompt:

> Read `/Users/abstractmapping/projects/landroid/AGENTS.md`,
> `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`,
> `/Users/abstractmapping/projects/landroid/docs/README.md`, and
> `/private/tmp/landroid-hosted-landroid-static/CONTINUATION-PROMPT.md`.
> Continue branch `fix/hosted-landroid-static` in
> `/private/tmp/landroid-hosted-landroid-static`. The task is to make hosted
> `.landroid` sample files bypass the Amplify SPA fallback so the Springhill Dr.
> Elmore demo loader works online. Do not change Springhill sample data, project
> picker behavior, T8-T19, demo polish, branch pruning, federal/private math, or
> drill-site tract designation.
