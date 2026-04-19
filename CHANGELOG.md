# LANDroid Changelog

This file records meaningful project changes so `CONTINUATION-PROMPT.md` can
stay short.

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
