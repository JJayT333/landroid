# LANDroid Roadmap

This is a short priority map. Detailed remediation work lives in `PATCH_PLAN.md`;
session handoff lives in `CONTINUATION-PROMPT.md`.

## Now

- Test spreadsheet row staging against additional recurring workbook formats.
- Refine column aliases and row-review UX from real import feedback beyond the
  Elmore DOTO sample.
- Add file-size/worker containment or replacement for vulnerable `xlsx` read paths.
- Make batch graft/attach operations atomic.
- Harden `.landroid` and CSV import validation.

## Next

- Execute Phase 0/1 of `DEPLOYMENT_PLAN.md`: hosted frontend, backend boundary,
  auth, cloud save path, and server-side AI proxy before any broad internet
  exposure.
- Design the project picker landing page after adding a real multi-workspace
  saved-project index instead of the current single autosave slot.
- Promote unit metadata to first-class records if future units need separate
  operator/effective-date settings beyond current Desk Map unit tags.
- Retarget or replace the five skipped Playwright workflows.
- Clean up the AI settings test storage warning.
- Improve AI mutation approval/proposal UX without losing the user's desired
  single-user local workflow speed.
- Add a persistent import ledger for staged spreadsheet rows.

## Later

- Federal/private Phase 2 math only after the reference workspace and source
  packet workflow are stable enough for that gate.
- Hosted/security posture, including CSP and a backend AI proxy if cloud use
  becomes a deployment requirement.
- Deeper RRC decoder coverage only for high-value file families proven by real
  workflow use.

## Not Planned Unless Explicitly Requested

- Tribal lease math.
- Full federal/BLM calculation engine during the current Texas baseline.
- Rewriting the app architecture for its own sake.
- Broad parser support for every legacy RRC format before the high-value paths
  prove useful.
