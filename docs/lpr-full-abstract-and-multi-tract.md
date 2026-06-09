# LPR full abstract and multi-tract

Status: implemented on `feat/lpr-full-abstract`. Builds on the Lease Purchase
Report (LPR) foundation merged in PR #134.

## What this adds

A Lease Purchase Report is a landman's lease abstract that overlays the present
mineral owner — a `fraction:'0'` lessee node — and never conveys mineral
ownership. PR #134 shipped the model, storage, `.landroid` round-trip, and a
`LEASE` workflow that wrote a single tract slice. This workstream turns the
editor into a full abstract and lets one lessor be leased across several tracts
of a unit in one report.

1. Full abstract fields. The editor (`src/components/modals/AttachLeaseModal.tsx`)
   now surfaces the 19-row significant-provisions checklist (checkbox + lease
   paragraph number), the 8 attachment toggles, and the preparer / legal-
   description fields, in collapsed-by-default sections. All are descriptive and
   persist through the existing `normalizeLeasePurchaseReport` path.

2. Derived economics. `computeLeaseEconomicsTotals`
   (`src/types/lease-purchase-report.ts`) shows total bonus (`bonus/ac × Σ net
   acres`) and delay rental (`rental/ac × Σ net acres`, suppressed when paid up)
   read-only in the editor. These totals are never persisted and never feed
   coverage, royalty, or NRI math.

3. Multi-tract reconcile. `buildLeaseTractRows`
   (`src/components/leasehold/lease-tract-rows.ts`) lists the lessor's present
   mineral-owner presence across the unit's desk maps — one row per tract, keyed
   by the mineral node. The editor renders a per-tract table; each checked tract
   carries its own lessor interest, gross acres, status, and doc number. On save,
   `planTractReconcile` splits the rows into create / update / remove, and the
   editor materializes one lease slice + one lessee node per checked tract on
   that tract's own desk map (via the new `addNodeToDeskMap` workspace-store
   action). Unchecking a tract removes exactly that tract's slice and node; the
   parent LPR is dropped when no tract remains.

## Math invariant

Only the per-tract slice scalars `leasedInterest`, `royaltyRate`, `status`, and
`jurisdiction` feed the math. Every field added here is descriptive. Net mineral
acres is the acre view of `leasedInterest` and never re-enters the math. The
coverage-stability guard in
`src/types/__tests__/lease-purchase-report.test.ts` stays green, and Springhill
still computes 0.225 / 0.775. The math modules (`deskmap-coverage.ts`,
`leasehold-summary.ts`) are untouched.

## When the lessor is not linked yet

If the originating mineral node has no linked owner, only the originating tract
shows in the table; the owner is created on save. Cross-tract rows appear on
later edits once that owner exists across the unit's tracts.

## Compatibility

No migration layer. The existing `normalizeLease` /
`normalizeLeasePurchaseReport` defaults remain the compatibility mechanism:
repo-bundled samples (including Springhill) import cleanly, absent new fields
normalize safely, and new multi-tract exports round-trip
(`src/storage/__tests__/workspace-persistence.test.ts`).

## Deferred

SSN / W-9 / TIN tax-packet work, the printable LPR report (PDF mirroring
`B_LPR_01`), and federal/private jurisdiction math remain out of scope.
