# LANDroid Changelog

This file records meaningful project changes so `CONTINUATION-PROMPT.md` can
stay short.

## 2026-04-21

- Added `DEPLOYMENT_PLAN.md`, a staged AWS-hosted rollout plan covering secure
  frontend hosting, Cognito auth, App Runner backend, S3/RDS persistence,
  server-side AI proxying, provider strategy (OpenAI / Anthropic / Bedrock),
  and go-live security controls.

## 2026-04-20

- Added project-scale unit focus for Raven Forest Unit A/B and future units:
  Leasehold and Owners now switch by active unit, new units can be created from
  the selector, and unit-wide ORRI/WI records carry a unit code so A/B math
  stays separated.
- Added a confirmed `Clear Map` Desk Map action that empties the active tract,
  removes cleared node artifacts, preserves other tracts, and avoids deleting
  node records still shared with another Desk Map.
- Improved spreadsheet row staging against the Elmore DOTO workbook format:
  tract-tab detection, gross-acre extraction, safer Grantor/Grantee header
  mapping, DOTO ownership-row inheritance, and simple title-interest expression
  parsing.
- Added per-sheet Desk Map targeting in workbook row review, including a
  `Create missing tracts` action before root-node creation.
- Reused the workspace Instrument dropdown in workbook row review so imported
  instrument types can be added to the persisted type list.

## 2026-04-19

- Created `AUDIT_REPORT.md` and `PATCH_PLAN.md`.
- Hardened AI rollback snapshots so mutating AI tool activity snapshots before
  live changes and includes node PDF workspace data.
- Added AI cancel/status UX and provider timeouts.
- Made OpenAI/Anthropic keys session-only and stripped old persisted cloud-key
  fields from AI settings.
- Enforced Texas-only active lease math gates for Desk Map/Leasehold consumers
  and lease attachment paths.
- Tightened AI lease creation with strict royalty/leased-interest parsing and
  `tx_fee` / `tx_state` jurisdiction limits.
- Improved Desk Map over-100 mineral coverage visibility by listing current
  mineral contributors.
- Added first-pass spreadsheet `Review rows` workflow for row-by-row editable
  node staging, parent suggestions, create-root, attach, and skip.
- Added professional docs rails: architecture, testing, security, roadmap,
  changelog, docs map, and core ADRs.
