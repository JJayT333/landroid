# NEXT — Audit Sheet export

Handoff prompt for the next chat session. Paste the body of this file into a
new chat to continue.

---

## Build an Audit Sheet export for LANDroid tracts

**Repo:** this worktree branch (`claude/epic-hoover-48f4d0`, pushed to
`origin/claude/epic-hoover-48f4d0`).

**Context.** LANDroid is an oil & gas mineral-title app the user (a landman)
uses day-to-day. The Leasehold tab does the actual NRI / ORRI / NPRI / WI
math; the Desk Map tab is title side. Two features were just shipped
back-to-back on this branch:

1. **Crackbaby Carnival demo fixture** (`src/storage/seed-crackbaby-carnival.ts`)
   — second option in the Navbar Demo Data dropdown alongside the existing
   Raven Forest demo (`src/storage/seed-test-data.ts`).
2. **FormulaTooltip popovers** (`src/components/leasehold/FormulaTooltip.tsx`,
   `src/components/leasehold/leasehold-formulas.ts`,
   `src/components/deskmap/deskmap-formulas.ts`) — hover any decimal in the
   Leasehold or Desk Map view to see the math broken down step-by-step.

### Goal

Build an **Audit Sheet export**: a one-page-per-tract printable document
showing every input and every derived number with the formula and
substitutions printed inline. Designed for handing to a buyer, partner, or
auditor who can't sit in the app with the landman. Effectively a printable
form of the FormulaTooltip popovers — every number that has a tooltip in
the live app should appear with its derivation on the sheet.

Must work for **both Raven Forest and Crackbaby Carnival** (and any future
tract — the implementation should be tract-agnostic).

### What the Audit Sheet should contain (per tract)

1. **Tract header** — code, name, county, gross/pooled acres, operator,
   lessee(s), primary royalty, jurisdiction, effective date.
2. **Tract participation + leased ownership** — TPF (with formula), leased
   ownership (with per-owner contributions).
3. **Owner table** — every present owner with: mineral fraction, NMA, NPA
   (with `pooledAcres × fraction` derivation), each of their leases (royalty
   rate, leased fraction, owner tract royalty, NPRI burdens, net unit
   royalty), all with formulas shown.
4. **NPRIs on this tract** — per-NPRI: payee, kind (fixed/floating), basis
   (whole-tract/branch/royalty), burden fraction, tract burden rate, unit
   decimal, with each computation shown.
5. **ORRIs affecting this tract** — per-ORRI: payee, scope, basis (gross 8/8
   / WI / NRI), burden fraction, unit decimal.
6. **WI splits** — Pre-WI computation (5-input subtraction), every
   assignment (assignee, scope, WI fraction, unit decimal), retained WI.
7. **Warning panel** — surfaces any active flags: over-conveyance,
   over-burdened, over-floating-NPRI-burdened, over-assigned, lease overlap,
   input warnings. Each warning describes what tripped it.
8. **Transfer-order roll-up** — visible total, expected coverage, variance,
   plus per-row decimal listing.

For every computed number, print the formula + substitution + result on
the line below (e.g., `Owner Tract Royalty = Leased Fraction × Royalty Rate
= 1/2 × 1/4 = 0.1250000 (12.50%)`).

### Implementation guidance

**Recommended path: HTML printable, not a PDF library.** Build a new React
component (e.g. `LeaseholdAuditSheet.tsx`) that renders the audit sheet
using existing Tailwind. Use the browser's native print-to-PDF
(`window.print()`) with appropriate `@media print` CSS. This is faster to
iterate, doesn't require a new dependency, and the data is already
in-store.

**Don't reinvent the formulas.** The existing formula formatters at
`src/components/leasehold/leasehold-formulas.ts` and
`src/components/deskmap/deskmap-formulas.ts` already produce
`FormulaContent` objects with `inputs`, `steps`, and `result`. Render those
structures as static print-ready HTML — same math, different presentation.
The `FormulaContent` shape is in
`src/components/leasehold/FormulaTooltip.tsx`.

**Data entry points:**

- `buildLeaseholdUnitSummary({ deskMaps, nodes, owners, leases,
  leaseholdAssignments, leaseholdOrris })` from
  `src/components/leasehold/leasehold-summary.ts` returns a
  `LeaseholdUnitSummary` containing every tract summary, NPRIs, ORRIs, and
  assignments computed.
- Workspace store: `useWorkspaceStore` gives nodes, deskMaps, leasehold
  unit/assignments/orris/transfer-orders. Owner store: `useOwnerStore` gives
  owners and leases.

**Trigger UX (suggested):**

- Add a small "Export Audit Sheet" button on each tract card in the
  Leasehold Overview view (`src/views/LeaseholdView.tsx` — `LeaseholdTractCard`
  around line 334).
- Clicking opens a new browser tab (or modal) with the print-ready sheet.
- A second button on the unit header — "Audit All Tracts" — that renders
  every tract back-to-back with page breaks between them.

### Scope for v1

- ✅ One audit sheet per tract; "Audit All" stitches them together with
  `page-break-after`.
- ✅ Render-and-print via `window.print()` — user "saves as PDF" from the
  browser dialog.
- ✅ Works on both Raven Forest and Crackbaby Carnival without code changes.
- ❌ No custom branding / company letterhead (v2).
- ❌ No Excel / CSV export — printable PDF only.
- ❌ No owner-by-owner sheets (tract-level only).
- ❌ No e-sign / digital signing.

### Verification

1. Run dev server (Vite, `npm run dev`); the user prefers Chrome opened
   automatically.
2. Load **Raven Forest** from Navbar → Demo Data.
3. Click "Export Audit Sheet" on tract C1 → verify the sheet shows tract
   header, owner table with math, NPRIs, ORRIs, WI assignments. Cross-check
   2–3 numbers against the FormulaTooltip popovers in the live app to
   confirm they agree.
4. Test C7 (deliberate over-conveyance), C3 (NPRI discrepancy), C8 (lease
   overlap), C10 (kitchen sink) — every warning that fires in the live app
   should be reflected in the audit sheet's warning panel.
5. Load **Crackbaby Carnival** and verify the planted errors
   (over-conveyance CC2, over-burdened NPRI CC3, malformed royalty CC4,
   divide-by-zero ORRI CC5, lease overlap CC7, over-assigned Unit A) all
   show up.
6. Print to PDF and visually check that the printout doesn't get truncated,
   that page breaks happen at sensible spots, and that the typography is
   readable.
7. Typecheck (`npx tsc --noEmit`) clean.

### User context

- Code style preference: tight, terse, no over-engineering, no premature
  DRY. Existing pattern is to colocate formula formatters with their domain.
- Always start the dev server, kill old processes first, and open Chrome on
  completion.
- User has a dark / twisted sense of humor — the Crackbaby Carnival fixture
  has darkly funny owner names. Don't tone that down if names show up on
  the audit sheet.

### Where to start

Read `src/components/leasehold/leasehold-formulas.ts` and
`src/components/leasehold/FormulaTooltip.tsx` first — those define the
`FormulaContent` shape you'll be rendering as static print HTML. Then look
at how `LeaseholdTractCard` (`src/views/LeaseholdView.tsx:334`) renders
today; the audit sheet is roughly the same structure, just with formula
derivations expanded inline instead of hidden behind hover tooltips.

Don't commit until the user has verified the output looks right.
