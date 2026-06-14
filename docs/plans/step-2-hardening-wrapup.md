# Step 2 Hardening — Wrap-up Master Plan

Created 2026-06-14. Source of truth: `docs/audit-backlog.md` (updated 2026-06-13),
`ROADMAP.md`, `docs/deep-audit-2026-06-10*.md`. This plan sequences every
**actionable, ungated** open item, marks the **gated** ones, and notes
**downstream unlocks**. Aesthetics §5 lane shipped in PR #161.

Working branch: `claude/flowchart-rebuild-plan-cumi48` (reset onto `main` per
lane; one PR per lane; squash-merge after CI green + self-review).

Policy defaults chosen this session (operator may override):
- Percent display stays `50.00%` (no churn to 9dp-gloss).
- Enforce the precision policy with a **grep-based vitest guard** (mirrors
  `theme-tokens.test.ts`) — no new ESLint dependency.
- Over-conveyance & Add-Root over-100: **warn, never hard-block** (operator
  directive, CONTINUATION-PROMPT). Structural invariants (negative/cycle/
  non-finite) stay hard blocks.

---

## EXECUTE NOW — ungated lanes (this sprint), in dependency order

### Lane 1 — Precision policy completion (DA-M6, DA-M7, §3) · display-only, golden-safe
- Wire remaining ad-hoc number formatting onto `src/engine/display-format.ts`:
  `NodeEditModal` cascade preview, `AttachLeaseModal` net acres,
  `leasehold-formulas.ts`, `deskmap-formulas.ts`, formula-tooltip helpers.
- DA-M7: expose `orriBurdenRateByTractId` on the unit summary (computed once at
  `leasehold-summary.ts`); delete the two recompute copies in
  `buildLeaseholdDecimalRows` and the view.
- DA-M6: formula tooltips render staged intermediates (no flat recompute);
  replace local `asFraction` with `formatAsFraction` (exact denominators).
- Add grep-based guard test banning `.toFixed(` in `src/views/**` &
  `src/components/**` (allowlist `display-format.ts`, zoom/geometry).
- **Unlocks:** numeric typography fully realized; displayed-number confidence.

### Lane 2 — Quick wins (DA-L*, LLA-L02) · low-risk filler
- DA-L1 dead `rootOwnershipTotal` export; DA-L3 dead code (`readOnlyLandroidTools`,
  unreachable clamp); DA-L4 hide hosted "Analyze with AI" (always 400s);
  DA-L2 `d()`/`toCalc` surface a validation issue instead of silent 0;
  DA-L5 doc drift; DA-L6 undo-label matching; DA-L8 non-numeric version reject;
  DA-L10 auth-token scan; LLA-L02 warning dots from shared validation helper.

### Lane 3 — Research optimistic-update safety (DA2-R1) · High, self-contained
- Shared `applyPersistedUpdate` helper in `research-store.ts`: revert state on
  Dexie save failure + surface a `Notice`. Add catch to research unlink cascades.
- **Unlocks:** safe research editing → prerequisite for the research catalog.

### Lane 4 — Structural validation on Add Root + over-conveyance (DA-M2/LLA-H03, DA-M1)
- Route DeskMap "Add Root" through validated `createRootNode`; strip/validate
  fraction fields on `updateNode`; keep over-100 as a **warned** working state.
- Remove the silent `Decimal.min` cap in `calculateShare`; `ConveyModal` shows a
  blocking inline warning ("requested X exceeds remaining Y") but lets the user
  proceed. Verify Springhill goldens unchanged.
- **Unlocks:** validated graph → precondition for Step 4 Texas math.
- ⚠ Math-engine-adjacent: PR + extra verification; flag for review before merge.

### Lane 5 — Title-ledger trust (ACT-H05, ACT-M01/DA-M3, DA-H4, DA-H5)
- ACT-H05: visible app-level divergence banner (via `Notice`); block cutover
  candidacy until cleared.
- ACT-M01/DA-M3: thread `origin` (user|ai|import|system) through the journal hook
  via a synchronous `withMutationOrigin` context; set it in the AI approval
  executor and staged-apply.
- DA-H4: flush ledger in the debounced shard unit (before the generation guard);
  on hydrate, warn when head hash ≠ recorded; **quarantine** invalid chains
  instead of erasing.
- DA-H5: add `actionHash = sha256(canonicalJson(record))` to each audit event;
  verifiers recompute/compare; bump ledger schema marker (accept legacy w/ warn).
- **Unlocks:** defensible title read-path **cutover**; real tamper-evidence.
- ⚠ Ledger-format (DA-H5 marker bump): PR + review before merge.

### Lane 6 — Null-unit record visibility (LLA-M06) · Fix Now
- Surface null-`unitCode` unit-wide ORRI/WI records as excluded-with-reason;
  require assignment before transfer-order reliance (warn, don't guess).

### Lane 7 — Flowchart F-Phase 1 remainder (verify scope) · parallel, no math
- Confirm what's left after #159 (pane-click shape create, lasso, merge-import,
  viewport restore, PNG export). Implement the genuinely-missing pieces only.

---

## NEEDS A DECISION before code (surface to operator, don't guess)
- **LLA-M04 / DA2-R2 / DEF-DOC-02** — `.landroid` export scope for non-node
  document links (owners/leases/curative/research/maps). Design-first: export all
  workspace-scoped links vs version-gate. Blocks research/curative/map doc
  attachments. **Unlocks** DEF-DOC-01 attorney-packet completeness (#96).
- **ACT-M02** replay canonical ordering; **ACT-M04** snapshot growth; **ACT-H03**
  runtime Dexie ledger persistence — design-first.
- **DA2-R5** research catalog schema (stable IDs, authorityYear, status enum) —
  design-first; gates the canonical Texas-math index + CSV importer.

## GATED — do not start without the trigger
- **DA-H1** fixed-NPRI allocation — **attorney sign-off** (decision recorded);
  material payout change + golden regen. **Unlocks** Step 4 NPRI math.
- **DEF-TXMATH-01 / DEF-FED-01** math expansion — explicit gates (golden masters
  / user start). **DEF-BE-01** backend, **DEF-NATIVE-01** runtime — explicit.
- Hosted-AI hardening (LLA-M07/M09/M10, AI20-HOSTED-3) — hosted/privacy design;
  needs hosted testing. **LLA-H01/H02** storage isolation/atomic fence — large,
  hosted/private-beta gated. **LLA-M12** CI e2e policy.
- Large Part-2 surfaces — Curative (DA2-C1..10), Maps/GIS (DA2-M1..11), RRC
  decoders (DA2-X*), Federal register (DA2-FED*) — sequenced later, several
  design-first.
- Performance (AI20-P3-PERF-1..5) — deferred; profile-first.

---

## UNLOCK MAP (what completing the EXECUTE-NOW lanes enables)
- Lanes 1 → numeric-typography payoff; precision drift prevented permanently.
- Lanes 4+5 → **title read-path cutover** defensible (the action layer's whole
  purpose) + validated graph → **Step 4 Texas math** (with DA-H1 attorney gate).
- Lane 3 (+ R2 after export-scope decision) → **research catalog** import →
  canonical TX-math reference → feeds Step 4.
- Export-scope decision (LLA-M04) → owner/lease/curative/research/map document
  attachments (DEF-DOC-02) + attorney-packet completeness (#96, DEF-DOC-01).
- Storage isolation (LLA-H01/H02) → hosted / private-beta readiness.

## VERIFICATION PROTOCOL (every lane)
- `npm run lint` (tsc) + `npm test` green; `theme-tokens` + new precision guard green.
- Golden masters (Springhill 0.225/0.775) unchanged unless a lane deliberately
  regenerates them (only DA-H1, which is gated).
- Self-review the diff (`/code-review`) before PR.
- For UI-visible changes, Playwright screenshot of the touched surface.
- Merge safe lanes after CI green; **flag math-engine (Lane 4) and ledger-format
  (DA-H5) changes for operator review** before merge.
