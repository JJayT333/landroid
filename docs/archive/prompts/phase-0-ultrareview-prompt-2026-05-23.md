# Phase 0 Ultra-Review Prompt

Paste the block below into `/ultrareview` (no PR argument — review the current
`main` checkpoint). Source of truth: `docs/rebuild-plan.md`, section
"Phase 0 Operating Plan" (lines 591–665).

---

## Prompt

You are running the **Phase 0 ultra-review** for LANDroid, against the current
`main` branch checkpoint. This is **not** a broad rebuild architecture audit
and **not** an implementation pass. The output is a behavior catalog and
fixture plan that freezes current observable behavior before the rebuild
begins.

Authoritative spec: `docs/rebuild-plan.md`, "Phase 0 Operating Plan" and
"Phase 0: Current Behavior Inventory And Golden Masters". Follow it. Where
this prompt and the doc disagree, the doc wins.

### Objectives

1. Turn Phase 0 into an executable inventory and testing plan.
2. Define inventory row shape, fixtures, baselines, commands, and exit gates.
3. Decide exactly which current behaviors must be preserved before rebuild
   implementation starts.
4. Capture surprising or implicit current behavior (sort orders, default
   filters, warning thresholds, autosave timing, destructive confirmations,
   print/page layout) before the rebuild plan is revisited.

### Hard constraints

- Read-only review. Do not propose or apply implementation changes to app
  code. Documentation, test scaffolding, and fixture plans are allowed as
  proposals, not commits.
- Do not redesign architecture. Do not relitigate the project-record-vs-event-
  log decision; that is settled in the rebuild plan.
- Do not expand scope into Phase 0.5 (storage sharding), Phase 0.75 (backend
  decision), or Phase 1+. Flag findings that affect those phases, but stay in
  Phase 0.
- Record known gaps explicitly. Do not pretend uncovered behavior is covered.

### Lanes (review each independently, then reconcile)

For each lane, produce: documented current behavior, atomic testable behavior
rows, missing coverage, proposed golden masters, migration risks, validation
commands, and reference-workspace needs.

1. **Desk Map** — title-tree actions, invariants, fit/clear behavior,
   graph/math warnings.
2. **Leasehold** — unit focus, ORRI/WI, payout review, formulas, transfer-
   order behavior.
3. **Documents** — packet preview/export, document chips, imports, metadata,
   PDF preview.
4. **AI** — approval flow, undo, blocked previews, action journal, proposal
   lifecycle.
5. **Persistence** — `.landroid` round trip, side stores, autosave,
   import/export, multi-tab risk.
6. **Runsheet** — spreadsheet staging, package assumptions, source rows,
   export expectations.
7. **Flowchart** — print fidelity, canvas layout, import-from-Desk-Map
   behavior.
8. **Maps / Research / Federal Leasing** — reference data, GIS evidence,
   no-effect Texas math boundaries.
9. **Performance & scale fixtures** — Raven Forest-like project shapes;
   capture baselines for large Desk Map, document registry, packet preview,
   import/export, `.landroid` round trip, and print workflows.

### Inventory row shape (propose and apply consistently)

Each behavior row should at minimum carry:

- `id` (stable, lane-prefixed)
- `page` / `workflow`
- `behavior` (one atomic, testable statement)
- `acceptance check` (how to verify)
- `current coverage` (unit / integration / Playwright / golden master / none)
- `proposed golden master` (yes/no + fixture pointer)
- `implicit?` (sort order, default filter, threshold, timing, confirmation,
  layout)
- `migration risk` if the rebuild touches it
- `validation command` to run locally / in CI

### Reference workspaces and baselines

- Identify at least one reference workspace per major demo/project shape.
- Specify export, checksum, and expected-output capture (JSON where
  practical).
- For each performance-sensitive workflow, specify command, fixture, machine
  profile, measured baseline, and acceptable drift.

### Exit gate (from the rebuild plan)

Report whether each is met, and if not, what is missing:

- documented page/workflow inventory on current branch
- frozen reference workspaces and expected outputs checked in (or explicitly
  documented if too large)
- performance baselines recorded with command, fixture, machine, drift
- full relevant tests pass
- missing coverage listed in `docs/rebuild-plan.md` or `TESTING.md`

### Deliverables

Return, per lane and then consolidated:

1. Behavior inventory rows (table form).
2. Proposed golden masters and fixture plan (file paths, formats, checksums).
3. Performance baseline plan (commands, fixtures, machine, drift budget).
4. Surprising / implicit behavior log.
5. Known-gap log (explicit, not hidden).
6. Sequencing notes — anything Phase 0 reveals that should change Phase 0.5,
   0.75, or 1 sequencing in `docs/rebuild-plan.md`.
7. Exit-gate status with a concrete checklist.

Lane reviewers are read-only and return findings. A single consolidated
master inventory is the final artifact; do not produce competing master
plans.
