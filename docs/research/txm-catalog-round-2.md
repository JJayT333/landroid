# TXM Catalog — Round 2 (Tier 1 Build Spec v1), received 2026-06-10

External research deliverable (round 2) from the prompts at
`docs/title-math-research-prompt.md` + `docs/title-math-research-supplement.md`.
Reference, not authority — attorney check required before any formula lands.

**ID WARNING — numbering changed between rounds.** Round 2 restructured the
catalog ("Build Spec v1") and re-used TXM ids with different meanings than
round 1 (`txm-catalog-round-1.md`): R1 TXM-002 (Van Dyke) = R2 TXM-004; R1
TXM-003 (fixed/floating) = R2 TXM-005; R1 TXM-005 (Wenske) = R2 TXM-007; R1
TXM-008 (Relinquishment Act) = R2 TXM-050; R2 TXM-008 is Hahn ratification.
Treat ROUND 2 ("Build Spec v1") AS CANONICAL going forward. Before/with the
IMPORT APPENDIX, instruct the research chat to emit a reconciliation table
mapping round-1 ids → v1 ids and to use v1 ids exclusively in the CSVs.

**Cross-round discrepancies to verify (both post-2026-01, beyond local
verification):** Round 1 cited *Clifton v. Johnson* (Tex. Mar. 13, 2026) as
the first Van Dyke rebuttal and marked it verified; Round 2 instead cites a
Mar. 2026 Eastland remand affirmance (*Navigator Group v. Van Dyke*,
pin cite [UNVERIFIED]) and never mentions Clifton. At least one of these
characterizations needs primary-source confirmation. Round 2 also corrects
two figures: NRC § 91.403 late-payment interest = NY Fed rate + 2 points (do
NOT use a 4-point margin), and the PSF minimum-royalty statute is § 52.022
(a "§ 52.0161" reference is wrong). Content below is verbatim as delivered.

---

# LANDroid Texas Mineral-Title Math Catalog — Tier 1 Reference (Build Spec v1)

**Scope note:** Texas law controls throughout. LAW and PRACTICE are labeled separately. All fractions are given first, then 9-decimal expansions. Worked examples are software test fixtures and are arithmetically exact. Citations verified against primary/secondary sources; unverifiable items flagged [UNVERIFIED]. This is a software specification, not legal advice — every STOP-AND-ASK flag means a licensed Texas oil-and-gas attorney must confirm before a number is booked.

## TL;DR
- Every doctrine that can move a Texas mineral-title decimal is cataloged below as a TXM entry with formula, exact worked fractions/9-decimal expansions, verified authority, temporal scope, and a COMPUTABLE vs STOP-AND-ASK software flag; the single biggest engine risk is the **double-fraction "estate-misconception" presumption** (Van Dyke v. Navigator Group, 668 S.W.3d 353 (Tex. 2023)), which makes "1/2 of 1/8" in antique instruments presumptively mean 1/2 of the whole estate, not 1/16 — a fact-specific, STOP-AND-ASK branch.
- The deterministic, COMPUTABLE core is: Duhig over-conveyance, NPRI proportionate-burden allocation, pooled-unit decimal math (tract participation × royalty), Relinquishment Act 50/50 state splits, intestacy fractions keyed to death date, and division-order decimal balancing to 1.000000000. The judgment-heavy STOP-AND-ASK core is: fixed-vs-floating royalty construction (Hysaw), executive-duty breach remedies (Lesley/KCM), allocation/PSA-well attribution (Browning v. Luecke), and "subject-to" clause burden allocation (Wenske v. Ealy).
- Build the engine so that any instrument dated before roughly 1980 containing a double fraction, any "subject-to" clause, any state-lands tract, and any heirship-derived link triggers a human-review flag rather than a silent computation; for split/fact-specific items emit BOTH candidate decimals, never silently pick one.

---

# PART 1 — MASTER INDEX + TEMPORAL LAW LEDGER

## 1A. Master Index

| ID | Name | Category | Status | Compute? |
|---|---|---|---|---|
| TXM-001 | Duhig over-conveyance rule | Conveyance | SETTLED | COMPUTABLE |
| TXM-002 | Perryman exception (exception-not-reservation) | Conveyance | SETTLED | STOP-AND-ASK |
| TXM-003 | After-acquired title / estoppel by deed | Conveyance | SETTLED | COMPUTABLE |
| TXM-004 | Double-fraction estate-misconception presumption (Van Dyke) | Royalty construction | SETTLED (rule); FACT-SPECIFIC (application) | STOP-AND-ASK |
| TXM-005 | Fixed vs floating royalty (Hysaw) | Royalty construction | FACT-SPECIFIC | STOP-AND-ASK |
| TXM-006 | Four-corners harmonization (Luckel/Concord) | Royalty construction | SETTLED | STOP-AND-ASK |
| TXM-007 | "Subject-to" clause burden allocation (Wenske) | Royalty construction | SPLIT/FACT-SPECIFIC | STOP-AND-ASK |
| TXM-008 | NPRI fixed/floating + ratification (Hahn) | Royalty construction | SETTLED | STOP-AND-ASK |
| TXM-009 | Non-apportionment rule (Japhet) | Royalty allocation | SETTLED | COMPUTABLE |
| TXM-010 | Entirety clause | Royalty allocation | SETTLED | COMPUTABLE |
| TXM-011 | NPRI proportionate-burden default | Royalty allocation | SETTLED | COMPUTABLE |
| TXM-012 | Assignment scope (well/land/lease) (Piranha) | ORRI construction | FACT-SPECIFIC | STOP-AND-ASK |
| TXM-013 | Post-production cost deductibility (Heritage/Hyder/Burlington) | Royalty valuation | FACT-SPECIFIC | STOP-AND-ASK |
| TXM-020 | Intestate succession fractions by death date | Probate | SETTLED | COMPUTABLE |
| TXM-021 | 9/1/1993 community-property descent change | Probate | SETTLED | COMPUTABLE |
| TXM-022 | Separate real property: spouse life estate / collateral heirs | Probate | SETTLED | COMPUTABLE |
| TXM-023 | Per capita with representation (per stirpes) | Probate | SETTLED | COMPUTABLE |
| TXM-024 | Half-blood rule | Probate | SETTLED | COMPUTABLE |
| TXM-025 | Adoption, pretermitted heirs, 120-hour survival | Probate | SETTLED | COMPUTABLE/STOP-ASK |
| TXM-026 | Affidavit-of-heirship reliance limits | Probate | SETTLED | STOP-AND-ASK |
| TXM-030 | Pooled-unit decimal (tract participation) | Pooling/DOI | SETTLED | COMPUTABLE |
| TXM-031 | Texas Mineral Interest Pooling Act (MIPA) | Pooling | SETTLED | STOP-AND-ASK |
| TXM-032 | Allocation/PSA wells (Browning v. Luecke) | Pooling | UNSETTLED (no SCOTX) | STOP-AND-ASK |
| TXM-033 | NPRI/unleased-owner pooling ratification | Pooling | SETTLED | STOP-AND-ASK |
| TXM-034 | Division-order decimal & balancing to 1.0 | DOI | SETTLED | COMPUTABLE |
| TXM-035 | Division-order binding-until-revoked + Gavenda exception | DOI | SETTLED | STOP-AND-ASK |
| TXM-036 | NRC §91.402–.404 payment timing & interest | DOI | SETTLED | COMPUTABLE |
| TXM-040 | Working interest / NRI / proportionate reduction | Leasehold | SETTLED | COMPUTABLE |
| TXM-041 | ORRI computation & washout/anti-washout | Leasehold | SETTLED | COMPUTABLE/STOP-ASK |
| TXM-042 | Executive-right duty (Lesley/KCM/Tex. Outfitters) | Leasehold | SETTLED (duty); FACT-SPECIFIC (remedy) | STOP-AND-ASK |
| TXM-043 | Pugh clauses (vertical/horizontal) | Leasehold | SETTLED | COMPUTABLE |
| TXM-044 | Retained-acreage clauses | Leasehold | FACT-SPECIFIC | STOP-AND-ASK |
| TXM-045 | Term mineral/royalty interests & RAP (Koopmann) | Leasehold | SETTLED | COMPUTABLE/STOP-ASK |
| TXM-046 | Net profits / production payments / carried / BIAPO | Leasehold | SETTLED | STOP-AND-ASK |
| TXM-047 | JOA non-consent penalties / payout WI flip | Leasehold | SETTLED | COMPUTABLE |
| TXM-050 | Relinquishment Act lands 50/50 split | State lands | SETTLED | COMPUTABLE |
| TXM-051 | State free royalty (post-1931 sales) | State lands | SETTLED | COMPUTABLE |
| TXM-052 | PSF/GLO lease royalty | State lands | SETTLED | COMPUTABLE |
| TXM-053 | Riverbed/channel leases | State lands | SETTLED | COMPUTABLE |
| TXM-054 | Highway/county-road ROW minerals | State lands | SETTLED | STOP-AND-ASK |
| TXM-060 | Correction instruments (Prop. Code 5.027–.031; Broadway/Yates) | Curative | SETTLED | STOP-AND-ASK |
| TXM-061 | Strip-and-gore / centerline presumption | Boundary | SETTLED | STOP-AND-ASK |
| TXM-062 | Adverse possession effect on fractions | Title | FACT-SPECIFIC | STOP-AND-ASK |
| TXM-063 | Co-tenancy / disproportionate leasing accounting | Title | SETTLED | COMPUTABLE |
| TXM-064 | Community lease | Royalty allocation | SETTLED | COMPUTABLE |
| TXM-065 | Depth/substance severances | Title | SETTLED | COMPUTABLE |
| TXM-066 | Partition (in kind / by sale) | Title | SETTLED | COMPUTABLE |
| TXM-067 | Vara/league survey conversions; called-vs-actual acreage | Survey | SETTLED | STOP-AND-ASK |
| TXM-068 | Mother Hubbard clause | Conveyance | SETTLED | STOP-AND-ASK |
| TXM-069 | Tax/sheriff's deeds; stranger-to-title; record-gap conventions | Title | SETTLED | STOP-AND-ASK |

## 1B. Temporal Law Ledger (chronological)

| Year | Authority | What changed (math effect) | Applies to | TXM ids |
|---|---|---|---|---|
| 1919 | Relinquishment Act (Acts 36th Leg., 2d C.S., ch. 81); now Tex. Nat. Res. Code §§ 52.171–52.190 | Surface owner = State's leasing agent; owner of soil gets 1/2 of bonus/royalty/rentals; floor 1/16 + 1/16 | Mineral-classified land sold 9/1/1895–8/21/1931 (oil & gas) | TXM-050 |
| 1925 | Japhet v. McRae, 276 S.W. 669 (Tex. Comm'n App. 1925, judgm't adopted) | Non-apportionment: post-lease subdivision → royalty follows tract where well sits | Subdivisions after lease, no entirety clause | TXM-009, TXM-010 |
| 1928 | Greene v. Robison, 117 Tex. 516, 8 S.W.2d 655 | Construed RA: title stays in State, owner of soil is agent; 50/50 of consideration | RA lands | TXM-050 |
| 1931 | Sales and Leasing Act of 1931 / Tex. Nat. Res. Code § 51.054 | State retains free royalty (≥1/16) on later sales | PSF land sold after 8/21/1931 | TXM-051 |
| 1940 | Duhig v. Peavy-Moore Lumber Co., 135 Tex. 503, 144 S.W.2d 878 | Over-conveyance: grantee's interest satisfied first out of grantor's retained share | Warranty deeds w/ reservation ignoring prior outstanding fraction | TXM-001, TXM-003 |
| 1957 | Garrett v. Dils Co., 157 Tex. 92, 299 S.W.2d 904 | Harmonization of differing fractions; floating-royalty reasoning ancestor | Multi-fraction royalty deeds | TXM-005, TXM-006 |
| 1961 | Atlantic Refining (Normanna) line; reservoirs discovered after 3/8/1961 | Set predicate for MIPA applicability | Reservoirs post-3/8/1961 | TXM-031 |
| 1965 | Texas Mineral Interest Pooling Act (orig. 1965; codified Acts 1977, Tex. Nat. Res. Code ch. 102) | RRC forced-pooling w/ risk penalty 0–100% | Common reservoirs post-3/8/1961; not State land | TXM-031 |
| 1968 | Montgomery v. Rittersbacher, 424 S.W.2d 210 | NPRI owner may ratify lease to share in pooled royalty | NPRI on pooled tracts | TXM-008, TXM-033 |
| 1981 | Exxon Corp. v. Middleton, 613 S.W.2d 240 | Division orders don't convey title / rewrite lease; market value at well | Gas valuation, DO effect | TXM-013, TXM-035 |
| 1984 | Alford v. Krum, 671 S.W.2d 870 | (Later OVERRULED) granting clause controlled over other clauses | Multi-fraction deeds (pre-1991) | TXM-006 |
| 1986 | Gavenda v. Strata Energy, 705 S.W.2d 690 | DO binding until revoked EXCEPT where payor unjustly enriched | DO underpayment w/ payor retention | TXM-035 |
| 1991 | Luckel v. White, 819 S.W.2d 459 | Four-corners harmonization; overruled Alford; rejected magic-words | Multi-fraction royalty deeds | TXM-006 |
| 1996 | Heritage Resources v. NationsBank, 939 S.W.2d 118 | "Market value at the well" allows PPC deduction despite no-deduction clause | Royalty valuation | TXM-013 |
| 1998 | Concord Oil v. Pennzoil, 966 S.W.2d 451 | Harmonize granting vs subject-to fractions; single-estate presumption | Multi-fraction deeds | TXM-006 |
| 2000 | Browning Oil Co. v. Luecke, 38 S.W.3d 625 (Tex. App.—Austin, pet. denied) | Unpooled horizontal well → royalty by production attributable w/ reasonable probability | Allocation/PSA wells | TXM-032 |
| 2011 | Lesley v. Veterans Land Bd., 352 S.W.3d 479 | Executive duty triggered by exercise (incl. restrictive covenants); remedy can cancel | Executive vs non-executive | TXM-042 |
| 2011 | Correction Instrument Statutes, Tex. Prop. Code §§ 5.027–.031 (eff. 9/1/2011) | Material vs non-material corrections; relate back | Recorded conveyances corrected after 9/1/2011 | TXM-060 |
| 2015 | KCM Financial v. Bradshaw, 457 S.W.3d 70 | Executive self-dealing (low royalty/high bonus) may breach; remedy fact-specific | Executive vs NPRI | TXM-042 |
| 2016 | Hysaw v. Dawkins, 483 S.W.3d 1 | Holistic fixed/floating; rejected rote multiplication of double fractions | Double-fraction instruments | TXM-004, TXM-005 |
| 2017 | Wenske v. Ealy, 521 S.W.3d 791 | Outstanding NPRI burdens grantor & grantee proportionately absent contrary intent | Fractional mineral conveyance w/ outstanding NPRI | TXM-007, TXM-011 |
| 2018 | ConocoPhillips v. Koopmann, 547 S.W.3d 858 | Term NPRI w/ springing executory interest doesn't violate RAP | Term/defeasible mineral & royalty | TXM-045 |
| 2018 | Perryman v. Spartan Tex. Six Capital, 546 S.W.3d 110 | Duhig not applied where deed creates an exception (not reservation) | "Less, save & except" royalty deeds | TXM-002 |
| 2019 | Burlington Resources v. Texas Crude, No. 17-0266 (Tex. 3/1/2019) | "Into the pipeline" = at-the-well valuation point → PPC deductible | ORRI/royalty valuation | TXM-013, TXM-041 |
| 2020 | Piranha Partners v. Neuhoff, 596 S.W.3d 740 | Assignment scope determined holistically (well vs land vs lease) | ORRI assignments | TXM-012 |
| 2021 | Broadway Nat'l Bank v. Yates Energy, 631 S.W.3d 16 | Original parties may execute §5.029 material correction even after third-party assignment | Correction instruments | TXM-060 |
| 2023 | Van Dyke v. Navigator Group, 668 S.W.3d 353 (Tex. 2023) | Rebuttable presumption: "1/8" in a double fraction = the whole mineral estate | Antique double-fraction instruments | TXM-004 |
| 2024 | ConocoPhillips v. Hahn, No. 23-0024 (Tex. Dec. 31, 2024) | Lease ratification doesn't convert fixed NPRI to floating; stipulation/cross-conveyance can | NPRI ratification/stipulation | TXM-008 |
| 1993 | Probate Code community-property descent change (eff. 9/1/1993); now Estates Code ch. 201 | If all children of the marriage, spouse takes 100% community; else decedent's 1/2 to children | Deaths on/after 9/1/1993 | TXM-020, TXM-021 |
| 2014 | Estates Code (eff. 1/1/2014) replaces Probate Code | Recodification; §§ 201.001–.103, 203.001 | Estate administration after 1/1/2014 | TXM-020–026 |
| 2026 | Navigator Group v. Van Dyke (Tex. App.—Eastland, Mar. 2026) | Affirmed Van Dyke on remand; rejected "royalty misconception" rebuttal [pin cite UNVERIFIED] | Double-fraction remand | TXM-004 |

*Items remaining: Parts 2–6 follow below.*

---

# PART 2 — CONVEYANCE / ROYALTY CONSTRUCTION ITEMS

### TXM-001 — Duhig Over-Conveyance Rule
- **Landman statement:** A grantor who warrants more mineral interest than he owns (typically by reserving a fraction while ignoring a prior outstanding reservation) has the shortfall taken out of his own retained share to make the grantee whole. Triggers whenever granted + reserved + outstanding fractions exceed 100%.
- **Trigger language:** "…grantor retains an undivided one-half (1/2) interest in and to all mineral rights…" in a general warranty deed silent as to a prior recorded reservation.
- **Math rule:** Grantee gets the full interest the deed purports to grant. Outstanding third-party fraction O is honored. Grantor keeps Residual = 1 − (granted) − O, but never less than 0; if negative, warranty is breached and grantor keeps 0.
- **Worked example (LAW):** Owner holds 1/2 MI (other 1/2 = O, prior reservation). Deeds "all," reserving 1/2 MI to self.
  - Naive: grantee 1/2, grantor 1/2, O 1/2 → 1.5 (impossible).
  - Duhig: grantee 1/2 = 0.500000000; O = 1/2 = 0.500000000; grantor = 1 − 0.5 − 0.5 = 0 = 0.000000000.
- **Authority:** Duhig v. Peavy-Moore Lumber Co., 135 Tex. 503, 144 S.W.2d 878 (Tex. 1940). VERIFIED.
- **Temporal:** Construction presumption applied today to deeds of any vintage. No date cutoff.
- **Status:** SETTLED.
- **Interactions:** Overridden by TXM-002 (exception vs reservation); interacts with TXM-003; does not apply to quitclaims.
- **DO practice note:** Analysts book the second reservation as ineffective and treat the second grantor as conveying all its interest; flag the file that Duhig was applied.
- **Software mapping:** Inputs: each deed's granted fraction, reserved fraction, prior outstanding fractions. COMPUTABLE once deed classified as warranty + reservation (not exception). Classification step is STOP-AND-ASK.

### TXM-002 — Perryman Exception (Exception, Not Reservation)
- **Landman statement:** Duhig does NOT apply where the deed *excepts* an interest from the grant rather than *reserving* one to the grantor. An exception shrinks what passes; it makes no warranty representation triggering Duhig estoppel.
- **Trigger language:** "LESS, SAVE AND EXCEPT an undivided one-half (1/2) of all royalties…" vs "grantor reserves…".
- **Math rule:** Excepted interest is removed from the grant; grantor keeps its actual ownership minus what it conveyed; no forced make-whole.
- **Worked example:** Grantor owns 1/2 royalty; deed conveys tract "less, save and except 1/2 of royalties." Grantor retains its actual 1/2 royalty = 0.500000000. No Duhig deduction.
- **Authority:** Perryman v. Spartan Tex. Six Capital Partners, 546 S.W.3d 110 (Tex. 2018). VERIFIED.
- **Status:** SETTLED rule; FACT-SPECIFIC classification. **Interactions:** Gateway test that turns TXM-001 on/off. **Software mapping:** STOP-AND-ASK.

### TXM-003 — After-Acquired Title / Estoppel by Deed
- **Landman statement:** A grantor who conveys with warranty an interest he doesn't yet own is estopped to deny it; title later acquired passes automatically to the grantee up to the warranted quantum.
- **Worked example:** Grantor warrants 1/4 MI but owns 0 at signing; later acquires 1/4 = 0.250000000 → passes to the earlier grantee by operation of law.
- **Authority:** Duhig v. Peavy-Moore, 144 S.W.2d 878 (Tex. 1940). VERIFIED. **Status:** SETTLED. **Software mapping:** COMPUTABLE with chain dates; does not apply to quitclaims.

### TXM-004 — Double-Fraction Estate-Misconception Presumption (Van Dyke)
- **Landman statement:** In antique instruments, "1/8" inside a double fraction is presumed to be a stand-in for the *entire* mineral estate (8/8), not a literal eighth — because last-century parties wrongly believed they kept only 1/8 when they leased. So "1/2 of 1/8" presumptively means 1/2 of the whole, not 1/16. Rebuttable only by other language in the instrument.
- **Trigger language:** "one-half of one-eighth of all minerals and mineral rights…"; "one-third of one-eighth royalty."
- **Math rule:** If a double fraction contains 1/8 and the instrument is of the relevant era, presume the 1/8 = 8/8 (the whole). Reserved/conveyed quantum = the *other* fraction × 1 (not × 1/8) unless rebutted. If rebutted, multiply literally.
- **Worked example (both branches):**
  - "1/2 of 1/8" mineral reservation. Presumption (Van Dyke): 1/2 × (8/8) = 1/2 = 0.500000000. Literal/rebutted: 1/2 × 1/8 = 1/16 = 0.062500000.
  - "1/3 of 1/8 royalty" (Hysaw): floating 1/3 of lease royalty; at lease royalty 1/5: 1/3 × 1/5 = 1/15 = 0.066666667 vs fixed 1/24 = 0.041666667.
- **Authority:** Van Dyke v. Navigator Group, 668 S.W.3d 353 (Tex. 2023) (No. 21-0146, decided Feb. 17, 2023) — VERIFIED reporter cite; building on Hysaw v. Dawkins, 483 S.W.3d 1 (Tex. 2016); affirmed on remand Navigator Group v. Van Dyke (Tex. App.—Eastland Mar. 2026) [pin cite UNVERIFIED]. The opinion noted: "At stake is at least $44 million in accumulated disputed royalties."
- **Temporal:** Applies to instruments of the "relevant era" (≈ early 1900s through mid-century; no bright-line date — courts key on whether 1/8 was the customary royalty when drafted). Modern instruments construed literally.
- **Status:** SETTLED rule; FACT-SPECIFIC application; rebuttal is attorney call.
- **Interactions:** TXM-005, TXM-006, TXM-008.
- **DO practice note:** Operators re-examine every antique double-fraction instrument; many historically paid on the literal (1/16) figure and now face the presumptive (1/2) figure — large retroactive exposure.
- **Software mapping:** STOP-AND-ASK. Flag any double fraction containing /8 in instruments before ~1980; never auto-multiply.

### TXM-005 — Fixed vs Floating Royalty (Hysaw)
- **Landman statement:** A "fractional royalty" is a fixed share of gross production that never changes; a "fraction of royalty" floats with whatever royalty the lease provides. The instrument's whole text decides which.
- **Trigger language:** Fixed: "1/16 of all oil and gas produced." Floating: "1/2 of the royalty provided in any lease."
- **Math rule:** Fixed = constant × gross production. Floating = fraction × lease royalty.
- **Worked example:** "1/2 of royalty," lease royalty 1/4. Floating: 1/2 × 1/4 = 1/8 = 0.125000000. If lease royalty later 1/5: 1/2 × 1/5 = 1/10 = 0.100000000. Fixed "1/16" = 0.062500000 regardless of lease.
- **Authority:** Hysaw v. Dawkins, 483 S.W.3d 1 (Tex. 2016). VERIFIED. **Status:** FACT-SPECIFIC. **Interactions:** TXM-004, TXM-006, TXM-008. **Software mapping:** STOP-AND-ASK.

### TXM-006 — Four-Corners Harmonization (Luckel / Concord)
- **Landman statement:** Courts ascertain intent from the entire instrument, harmonizing apparently conflicting fractions; no clause (granting/habendum/warranty) automatically wins, and no magic words are required.
- **Worked example (Luckel):** Granting clause "1/32 royalty"; future-lease clause "1/4 of royalties under said leases." Harmonized: grantee owns 1/4 of reserved royalty under all leases, never less than 1/32 of production. Under a 1/6 lease: 1/4 × 1/6 = 1/24 = 0.041666667; floor 1/32 = 0.031250000 (1/24 > 1/32, so 1/24 governs).
- **Authority:** Luckel v. White, 819 S.W.2d 459 (Tex. 1991) (overruling Alford v. Krum, 671 S.W.2d 870 (Tex. 1984)); Concord Oil Co. v. Pennzoil, 966 S.W.2d 451 (Tex. 1998). VERIFIED. **Status:** SETTLED. **Software mapping:** STOP-AND-ASK.

### TXM-007 — "Subject-To" Clause Burden Allocation (Wenske)
- **Landman statement:** When a deed conveys a fractional mineral interest "subject to" an outstanding NPRI, both grantor's reserved share and grantee's conveyed share bear the NPRI proportionately, unless the deed clearly puts the whole burden on one party. Intent controls; there is no default rule.
- **Trigger language:** "subject to the Reservations from Conveyance and the Exceptions to Conveyance and Warranty."
- **Math rule:** Each owner bears NPRI × (their MI ÷ total MI burdened).
- **Worked example:** Outstanding NPRI = 1/4. Wenske reserved 3/8 MI; Ealy took 5/8 MI. Wenske bears 3/8 × 1/4 = 3/32 = 0.093750000; Ealy bears 5/8 × 1/4 = 5/32 = 0.156250000. (Alternative urged by grantor: entire 1/4 on grantee = 0.250000000.)
- **Authority:** Wenske v. Ealy, 521 S.W.3d 791 (Tex. 2017) (5–4); distinguishing Bass v. Harper, 441 S.W.2d 825 (Tex. 1969). VERIFIED. **Status:** SPLIT/FACT-SPECIFIC (present BOTH computations). **Software mapping:** STOP-AND-ASK.

### TXM-008 — NPRI Fixed/Floating, Ratification & Stipulation (Hahn)
- **Landman statement:** An NPRI owner's ratification of a later lease binds him to the lease's pooling clause but does NOT, by itself, convert a fixed NPRI to floating or subject it to the lessor's royalty. A signed stipulation/cross-conveyance CAN change the interest.
- **Worked example (Hahn):** Fixed 1/8 NPRI = 0.125000000 of production. Gips lease royalty 1/4. Conoco argued ratification reduced Hahn to 1/8 × 1/4 = 1/32 = 0.031250000. Court: ratification alone does NOT reduce — stays 0.125000000; but the 2011 stipulation ("1/8 of royalty") made it floating: 1/8 × 1/4 = 1/32 = 0.031250000.
- **Authority:** ConocoPhillips Co. v. Hahn, No. 23-0024 (Tex. Dec. 31, 2024); Montgomery v. Rittersbacher, 424 S.W.2d 210 (Tex. 1968); Concho Resources v. Ellison, 627 S.W.3d 226 (Tex. 2021). VERIFIED. **Status:** SETTLED. **Software mapping:** STOP-AND-ASK (check for stipulations/cross-conveyances).

### TXM-009 — Non-Apportionment Rule (Japhet)
- **Landman statement:** If leased land is subdivided after the lease, royalties go entirely to the owner of the tract where the producing well physically sits — other former co-owners get nothing — unless an entirety clause or apportionment agreement says otherwise.
- **Worked example:** 15 acres leased (1/8 royalty); later split; well on south 10 ac. Owner of 10 ac gets 100% of the 1/8 royalty = 0.125000000; owner of north 5 ac gets 0.000000000.
- **Authority:** Japhet v. McRae, 276 S.W. 669 (Tex. Comm'n App. 1925, judgm't adopted). VERIFIED. **Status:** SETTLED. **Interactions:** Overridden by TXM-010, TXM-064. **Software mapping:** COMPUTABLE given well location + subdivision dates.

### TXM-010 — Entirety Clause
- **Landman statement:** A lease entirety clause overrides non-apportionment: if leased land is later subdivided, royalties are shared among divided tracts in proportion to acreage.
- **Worked example:** Same 15-ac/1/8-royalty lease with entirety clause; well on 10-ac tract. North 5-ac owner: 5/15 × 1/8 = 1/24 = 0.041666667; 10-ac owner: 10/15 × 1/8 = 1/12 = 0.083333333.
- **Authority:** industry convention codified in lease forms; recognized in Japhet, 276 S.W. 669, and progeny. VERIFIED (doctrine). **Status:** SETTLED. **Software mapping:** COMPUTABLE.

### TXM-011 — NPRI Proportionate-Burden Default
- **Landman statement:** A severed NPRI carved before a fractional conveyance burdens the whole mineral estate; absent contrary deed language, each later fractional owner bears it in proportion to their mineral share.
- **Worked example:** See TXM-007 numbers. **Authority:** Wenske v. Ealy, 521 S.W.3d 791 (Tex. 2017). VERIFIED. **Status:** SETTLED. **Software mapping:** COMPUTABLE once deed intent fixed (which may be STOP-AND-ASK).

### TXM-012 — Assignment Scope: Well vs Land vs Lease (Piranha)
- **Landman statement:** When an ORRI assignment describes a well, a tract, and a lease, courts decide holistically whether the conveyance is limited to the wellbore, the land, or the whole lease — usually the whole lease if the text points to the lease.
- **Worked example:** Neuhoff's 3.75% ORRI under the Puryear Lease (all of Section 28). Held: assignment conveyed the full 0.037500000 ORRI on all lease production, not just one well.
- **Authority:** Piranha Partners v. Neuhoff, 596 S.W.3d 740 (Tex. 2020). VERIFIED. **Status:** FACT-SPECIFIC. **Software mapping:** STOP-AND-ASK.

### TXM-013 — Post-Production Cost Deductibility
- **Landman statement:** Royalty bears post-production costs (PPC) when valued "at the well" or equivalents like "into the pipeline"; clauses can shift this but must be precise. Changes the *net value*, not the ownership fraction.
- **Math rule:** Net value = royalty fraction × (sales price − allocable PPC) when at-the-well; = royalty fraction × gross proceeds when proceeds/amount-realized without an at-well anchor.
- **Worked example:** 1/8 royalty (0.125000000); gross $6.00/Mcf; PPC $1.00. At-well: 0.125 × ($6−$1) = $0.625. Proceeds (no PPC): 0.125 × $6 = $0.750.
- **Authority:** Heritage Resources v. NationsBank, 939 S.W.2d 118 (Tex. 1996); Chesapeake Exploration v. Hyder, 483 S.W.3d 870 (Tex. 2016); Burlington Resources v. Texas Crude, No. 17-0266 (Tex. Mar. 1, 2019) (9-0). VERIFIED. **Status:** FACT-SPECIFIC. **Software mapping:** STOP-AND-ASK (valuation point); arithmetic COMPUTABLE once point fixed. *Note: cost accounting is out of scope, but the valuation-point fraction is in scope.*

*Items remaining: probate pack; pooling/DOI; leasehold/WI/ORRI; Tier 2 + checklists; double-fraction guide.*

---

# PART 3 — PROBATE / HEIRSHIP MATH PACK

**Core split (Texas, real property, intestate):** Character of property (community vs separate) and death date drive the fractions. Estates Code ch. 201 (post-1/1/2014); Probate Code §§ 38, 45 (pre-2014). The 9/1/1993 change is the key inflection.

### TXM-020 / TXM-021 — Community Property Descent by Death Date
- **Death on/after 9/1/1993 (Estates Code § 201.003):**
  - All decedent's children are also the surviving spouse's → surviving spouse takes 100% of community. Children take 0 of community at this death.
  - At least one child is NOT the surviving spouse's → decedent's 1/2 of community passes to decedent's children (equally); spouse keeps own 1/2.
  - **Worked example (blended, community mineral tract):** Spouse keeps 1/2 = 0.500000000; decedent's 1/2 split among 3 children = 1/2 ÷ 3 = 1/6 each = 0.166666667 each.
- **Death before 9/1/1993 (former Probate Code § 45):** decedent's 1/2 community passed to children even if all of the marriage (spouse did not take all). Blended-family math applied to all cases.
- **Authority:** Tex. Estates Code § 201.003; former Tex. Probate Code § 45. VERIFIED. **Status:** SETTLED. **Software mapping:** COMPUTABLE given death date, property character, family graph.

### TXM-022 — Separate Real Property (Estates Code § 201.002)
- **Spouse + children:** spouse takes 1/3 life estate in separate realty; children take 2/3 plus the remainder.
  - **Worked example:** Separate mineral tract, spouse + 2 children. Spouse: 1/3 life estate (0.333333333 for life); each child: 1/2 of 2/3 = 1/3 fee (0.333333333) plus 1/2 of the remainder in the spouse's 1/3.
- **No children:** 1/2 to spouse, 1/2 to decedent's parents/siblings (§ 201.002(c)); if none, spouse takes all (§ 201.002(d)).
- **Authority:** Tex. Estates Code § 201.002. VERIFIED. **Software mapping:** COMPUTABLE; life-estate valuation (vs fee) is STOP-AND-ASK booking. *(Homestead status does NOT change the mineral fraction — it is a possessory/occupancy right only; book minerals on the descent fractions.)*

### TXM-023 — Per Capita with Representation (per stirpes) (§ 201.101)
- **Rule:** Estate divided at the first generational level with living takers; deceased member's share passes to that member's descendants by representation.
- **Worked example:** Decedent, 3 children; child B predeceased leaving 2 grandchildren. Living children A, C each 1/3 = 0.333333333; B's 1/3 splits to B's 2 children = 1/6 each = 0.166666667.
- **Authority:** Tex. Estates Code § 201.101. VERIFIED. **Software mapping:** COMPUTABLE from the family tree.

### TXM-024 — Half-Blood Rule (§ 201.057)
- **Rule:** When inheritance passes to collateral kindred, a half-blood takes half the share of a whole-blood relative.
- **Worked example:** Decedent (no spouse/children/parents); heirs = 1 whole-blood sibling + 2 half-blood siblings. Weights 2:1:1, total 4. Whole-blood: 2/4 = 0.500000000; each half-blood: 1/4 = 0.250000000.
- **Authority:** Tex. Estates Code § 201.057. VERIFIED. **Software mapping:** COMPUTABLE with blood-relationship flags.

### TXM-025 — Adoption, Pretermitted Heirs, 120-Hour Survival
- Adopted child inherits as a natural child (§ 201.054). Pretermitted-child rules can reallocate testate shares (Estates Code ch. 255). Heir must survive by 120 hours or is treated as predeceased (§§ 121.052–.053). **Software mapping:** survival = COMPUTABLE; pretermitted/adoption status = STOP-AND-ASK.

### TXM-026 — Affidavit-of-Heirship Reliance Limits
- **Landman statement:** An affidavit of heirship is only prima facie evidence (not title) once on record five years (Estates Code § 203.001); it does not bind omitted heirs/creditors and can be rebutted. Title examiners may rely (Texas Title Examination Standards 11.70), but a judgment declaring heirship or probate actually transfers title.
- **Authority:** Tex. Estates Code §§ 203.001–.002; Jeter v. McGraw, 79 S.W.3d 211 (Tex. App.—Beaumont 2002, pet. denied). VERIFIED. **Status:** SETTLED. **Software mapping:** STOP-AND-ASK — book heirship-derived decimals as provisional pending curative.

*Items remaining: pooling/DOI; leasehold/WI/ORRI; Tier 2 + checklists; double-fraction guide.*

---

# PART 4 — POOLING / UNITS / DIVISION-ORDER PACK

### TXM-030 — Pooled-Unit Decimal (Tract Participation)
- **Landman statement:** In a pooled unit, an owner's unit decimal = mineral interest × royalty (or NRI) × tract participation factor (tract acres ÷ unit acres).
- **Math rule:** DOI = MI × royalty × (tract acreage ÷ total unit acreage). For WI: WI × (tract ÷ unit).
- **Worked example:** Owner MI 1/2 in a 40-ac tract; lease royalty 1/5; unit 320 ac. Tract factor = 40/320 = 1/8 = 0.125000000. DOI = 1/2 × 1/5 × 1/8 = 1/80 = 0.012500000.
- **Authority:** industry convention; pooling cross-conveyance recognized in Texas (Hahn discussion). VERIFIED (convention). **Status:** SETTLED. **Software mapping:** COMPUTABLE.

### TXM-031 — Mineral Interest Pooling Act (MIPA)
- **Landman statement:** RRC can force-pool separately owned tracts in a common reservoir if the applicant first made a fair, reasonable voluntary pooling offer; a risk penalty (0–100%) applies to non-consenting/forced participants before they share revenue.
- **Worked example:** Risk penalty 100%; participant's cost share $100,000. Operator recovers $100,000 + $100,000 = $200,000 from participant's revenue share before participant receives proceeds. At 50% penalty: $150,000.
- **Authority:** Tex. Nat. Res. Code ch. 102 (orig. 1965; codified Acts 1977); § 102.003 (not applicable to reservoirs discovered/produced before 3/8/1961); § 102.004 (not applicable to State land). VERIFIED. **Status:** SETTLED. **Software mapping:** STOP-AND-ASK (RRC order sets terms).

### TXM-032 — Allocation / PSA Wells (Browning v. Luecke)
- **Landman statement:** A horizontal well crossing un-pooled tracts is paid by allocating production to each tract with "reasonable probability" — commonly by productive-lateral length in each tract ÷ total productive lateral. No SCOTX holding validates the method; treat as unsettled.
- **Math rule:** Tract allocation factor = productive lateral feet in tract ÷ total productive lateral feet; royalty = lease royalty × factor × MI.
- **Worked example:** Lateral 10,000 ft total; 2,500 ft under owner's tract → factor 0.250000000. Lease royalty 1/4, MI all: DOI = 1/4 × 0.250000000 = 0.062500000. (In Browning, the Lueckes were entitled to royalty on 25 percent of total production, as only about 25 percent of the wellbore was on their acreage.)
- **Authority:** Browning Oil Co. v. Luecke, 38 S.W.3d 625 (Tex. App.—Austin 2000, pet. denied). The RRC has issued PSA-well permits since late 2007 based on the operator's representation that at least 65 percent of each tract's interest owners agreed; in 2010 Devon obtained the first "allocation well" permit (no pooling authority and no PSA). VERIFIED. **Status:** UNSETTLED (no Texas Supreme Court decision). **Software mapping:** STOP-AND-ASK.

### TXM-033 — NPRI / Unleased-Owner Pooling Ratification
- **Landman statement:** An NPRI cannot be pooled without the owner's consent; ratification lets the NPRI share in unitized production on a tract-participation basis but doesn't otherwise change its fixed/floating character (see TXM-008).
- **Authority:** ConocoPhillips v. Hahn (Tex. 2024); Montgomery v. Rittersbacher (Tex. 1968). VERIFIED. **Software mapping:** STOP-AND-ASK.

### TXM-034 — Division-Order Decimal & Balancing to 1.000000000
- **Landman statement:** Every revenue deck must sum to exactly 1.000000000 across all royalty + ORRI + WI/NRI owners; engine must verify closure and handle rounding.
- **Math rule:** Σ all owner decimals = 1.000000000. WI side: Σ WI = 1.0, Σ NRI = 1 − total burdens.
- **Worked example:** 1/5 royalty (0.200000000), 0.037500000 ORRI; WI owners' NRI = 1 − 0.200000000 − 0.037500000 = 0.762500000. Check: 0.200000000 + 0.037500000 + 0.762500000 = 1.000000000. ✓
- **Authority:** industry/NADOA convention; NRC § 91.402 DO form. VERIFIED (convention). **Status:** SETTLED. **Software mapping:** COMPUTABLE; carry 9 decimals, reconcile residual to a designated owner or to suspense.

### TXM-035 — Division Order Binding Until Revoked + Gavenda Exception
- **Landman statement:** A signed division order binds the owner until revoked and protects the payor from double liability — EXCEPT where the payor itself prepared an erroneous DO and was unjustly enriched by underpaying; then the DO doesn't bind and the owner recovers the retained shortfall.
- **Math rule:** Underpaid owner recovers from payor only the portion the payor *retained* (not amounts paid out to others).
- **Worked example:** Deed reserved 1/2 royalty (0.500000000); payor paid on 1/16 (0.062500000) and kept the 7/16 (0.437500000) difference. Owner recovers the retained 0.437500000 share; not amounts paid to third parties. (In Gavenda the underpayment was $2,435,457.51.)
- **Authority:** Gavenda v. Strata Energy, 705 S.W.2d 690 (Tex. 1986); Exxon Corp. v. Middleton, 613 S.W.2d 240 (Tex. 1981). VERIFIED. **Status:** SETTLED. **Software mapping:** STOP-AND-ASK (unjust-enrichment determination).

### TXM-036 — NRC §§ 91.402–.404 Payment Timing & Interest
- **Landman statement:** First proceeds due within 120 days after the end of the month of first sale; thereafter 60 days (oil) / 90 days (gas) absent contrary lease terms. Payments may be withheld without interest for title disputes, unsigned division orders, or unsatisfied title-opinion requirements. Late-payment interest then accrues.
- **Math rule (VERIFIED statutory rate):** Per Tex. Nat. Res. Code § 91.403(a), interest accrues "at two percentage points above the percentage rate charged on loans to depository institutions by the New York Federal Reserve Bank, unless a different rate of interest is specified in a written agreement between payor and payee." (This is a single statutory rate — the earlier belief that some cases use a 4-point margin is incorrect for § 91.403; do not apply a 4-point figure.)
- **Worked example:** $10,000 held 30 days past deadline; assume NY Fed rate 5.50%, so statutory rate = 7.50%: 10,000 × 0.0750 × (30/365) = $61.64.
- **Authority:** Tex. Nat. Res. Code §§ 91.402, 91.403, 91.404. VERIFIED (incl. § 91.403(a) verbatim rate). **Status:** SETTLED. **Software mapping:** COMPUTABLE (pull the current NY Fed rate as an input); suspense triggers STOP-AND-ASK.

*Items remaining: leasehold/WI/ORRI; Tier 2 + checklists; double-fraction guide.*

---

# PART 5 — LEASEHOLD / WI / ORRI ITEMS

### TXM-040 — Working Interest / NRI / Proportionate Reduction
- **Landman statement:** WI is the cost-bearing leasehold share; NRI = WI × (1 − total lease burdens). A lesser-interest/proportionate-reduction clause shrinks royalty if lessor owned less than the full mineral estate.
- **Math rule:** NRI = WI × (1 − royalty − ORRI − NPRI). Proportionate reduction: effective royalty = stated royalty × (lessor's MI ÷ full MI).
- **Worked example:** WI 0.500000000, royalty 1/5, ORRI 0.025000000. NRI = 0.5 × (1 − 0.200000000 − 0.025000000) = 0.5 × 0.775000000 = 0.387500000. Proportionate reduction: lessor owns 1/2 MI, lease royalty 1/5 → effective 1/5 × 1/2 = 1/10 = 0.100000000.
- **Authority:** industry convention; standard lease lesser-interest clause. VERIFIED (convention). **Status:** SETTLED. **Software mapping:** COMPUTABLE.

### TXM-041 — ORRI Computation & Washout / Anti-Washout
- **Landman statement:** An ORRI is carved from the WI and expires with the lease; if the lease terminates and the operator takes a new lease, the ORRI can be "washed out" unless an anti-washout clause extends it to renewals/extensions.
- **Worked example:** 3.75% ORRI = 0.037500000. After washout (new lease, no anti-washout): 0.000000000. With anti-washout: persists at 0.037500000 on the renewal.
- **Authority:** Tex. Prop. Code ch. 31 (Bad Faith Washout of Overriding Royalty Interest in Oil and Gas Lease); industry convention. VERIFIED (statute exists). **Status:** SETTLED. **Software mapping:** COMPUTABLE; anti-washout presence STOP-AND-ASK.

### TXM-042 — Executive-Right Duty (Lesley / KCM / Texas Outfitters)
- **Landman statement:** The executive owes non-executives a duty of utmost good faith and fair dealing; breach (e.g., self-dealing — low royalty for high bonus, or restrictive covenants blocking development) can yield remedies (constructive trust, lease cancellation) that change bookable interests. An UNexercised executive right changes no decimal.
- **Math rule:** No decimal change until the executive acts; if a court grants a remedy, re-book per the judgment.
- **Worked example:** NPRI owner entitled to "not less than 1/8" minimum; executive leases at 1/8 (0.125000000) plus enriched bonus to self. (In KCM the bonus was about $7,505/acre, totaling more than $13 million, at a 1/8 royalty.) If a court finds breach and reforms to a market 1/5 royalty, the NPRI floating share recomputes on 0.200000000. Until then, book on 0.125000000.
- **Authority:** Lesley v. Veterans Land Bd., 352 S.W.3d 479 (Tex. 2011); KCM Financial v. Bradshaw, 457 S.W.3d 70 (Tex. 2015); Schlittler v. Smith (Tex. 1937); Manges v. Guerra, 673 S.W.2d 180 (Tex. 1984). VERIFIED. **Status:** SETTLED (duty); FACT-SPECIFIC (remedy). **Software mapping:** STOP-AND-ASK; default = no decimal change for unexercised rights.

### TXM-043 — Pugh Clauses (Vertical / Horizontal)
- **Landman statement:** A Pugh clause severs the lease at unit boundaries: vertical Pugh releases non-pooled acreage; horizontal Pugh releases depths below the deepest produced/tested. Changes which acreage/depths remain leased.
- **Worked example:** 640-ac lease; 160 ac pooled. Vertical Pugh after primary term: 160 ac held (0.250000000 of original), 480 ac released → reverts to unleased mineral status.
- **Authority:** industry convention (no single controlling statute). VERIFIED (convention). **Status:** SETTLED. **Software mapping:** COMPUTABLE with unit/depth data.

### TXM-044 — Retained-Acreage Clauses
- **Landman statement:** Retained-acreage clauses release all acreage except proration/spacing units around producing wells at end of term. Defines bookable held acreage.
- **Authority:** lease convention; RRC field rules. VERIFIED (convention). **Status:** FACT-SPECIFIC. **Software mapping:** STOP-AND-ASK (proration-unit definition varies).

### TXM-045 — Term Mineral / Royalty Interests & RAP (Koopmann)
- **Landman statement:** A term interest ("for 15 years and so long as production") reverts automatically on expiration; a springing executory interest in a third party doesn't violate the Rule Against Perpetuities. Reversion changes the decimal at the trigger date.
- **Worked example:** Term NPRI 1/8 (0.125000000) for 15 years; on expiration without production it reverts to the mineral owner → NPRI 0.000000000, mineral owner's royalty restored by 0.125000000.
- **Authority:** ConocoPhillips Co. v. Koopmann, 547 S.W.3d 858 (Tex. 2018). VERIFIED. **Status:** SETTLED. **Software mapping:** COMPUTABLE with term dates + production status; "so long as produced" determination can be STOP-AND-ASK.

### TXM-046 — NPI / Production Payments / Carried Interests / BIAPO
- **Landman statement:** A net profits interest (NPI) pays a share of net profits (no cost bearing but only after profitability); a production payment is a dollar- or volume-limited share that terminates when satisfied; a carried interest defers a party's costs; BIAPO/payout flips the WI sharing before vs after payout.
- **Worked example (BIAPO):** Carried party WI before payout = 0.000000000 (carried); after payout reverts to 0.250000000 (BPO 0% / APO 25%).
- **Authority:** industry convention; JOA/farmout terms. VERIFIED (convention). **Status:** SETTLED. **Software mapping:** STOP-AND-ASK (payout accounting is adjacent to COPAS/out of scope, but the flip-decimal is in scope).

### TXM-047 — JOA Non-Consent Penalties / Payout WI Flip
- **Landman statement:** A non-consenting WI owner under a JOA is "relinquished" temporarily; consenting parties recover a penalty multiple (e.g., 300–500% of the non-consenting share of costs) out of the non-consent party's revenue before its WI reverts.
- **Worked example:** Non-consent WI 0.250000000; 400% penalty on $100,000 cost share = $400,000 recovered before the 0.250000000 reverts.
- **Authority:** A.A.P.L. Model Form JOA (industry convention). VERIFIED (convention). **Status:** SETTLED. **Software mapping:** COMPUTABLE given penalty% + cost basis.

*Items remaining: Tier 2 inventory; state-lands items; double-fraction guide; coverage checklist; adjacent-out-of-scope appendix.*

---

# PART 6 — STATE LANDS (TIER 1), TIER 2 INVENTORY, GUIDES & CHECKLISTS

## 6A. Texas State Lands (Tier 1)

### TXM-050 — Relinquishment Act Lands (50/50)
- **Landman statement:** On mineral-classified land sold 9/1/1895–8/21/1931 with minerals reserved to the State, the surface owner ("owner of the soil") is the State's leasing agent and splits all bonus, royalty, delay rentals, and other consideration 50/50 with the State. Floor: not less than 1/16 royalty to the State + like 1/16 to the owner, plus ≥10¢/ac/yr rental to each.
- **Worked example:** Lease royalty 1/5 (0.200000000) on RA land. State 1/2 × 1/5 = 1/10 = 0.100000000; owner of soil 1/2 × 1/5 = 1/10 = 0.100000000. Bonus $300,000 → $150,000 each.
- **Authority:** Tex. Nat. Res. Code §§ 52.171–52.190 (esp. § 52.172); Greene v. Robison, 117 Tex. 516, 8 S.W.2d 655 (1928); Holt v. Giles (Tex. 1951). Leases not effective until certified copy filed with GLO (§§ 52.183–.184). VERIFIED. *Other (non-oil-gas) minerals: owner of soil 40% / State 60%, §§ 53.061–53.066.*
- **Status:** SETTLED. **Software mapping:** COMPUTABLE.

### TXM-051 — State Free Royalty (Post-1931 Sales)
- **Landman statement:** PSF land sold after 8/21/1931 carries a State free (non-participating, cost-free) royalty of not less than 1/16 of minerals (≥1/8 sulphur). Leasing handled by the executive-rights/surface holder as agent; lease not effective until a certified copy is filed with the GLO.
- **Worked example:** State free royalty 1/16 = 0.062500000, cost-free off the top.
- **Authority:** Tex. Nat. Res. Code § 51.054; Sales and Leasing Act of 1931. VERIFIED. *Caveat: some earlier-era sales reserved 1/8 (e.g., Shell Oil Co. v. Rudder, Tex. 1957) — verify per patent.* **Status:** SETTLED. **Software mapping:** COMPUTABLE; reserved fraction STOP-AND-ASK per tract.

### TXM-052 — PSF / GLO Lease Royalty
- **Landman statement:** Statutory minimum royalty on a PSF oil-and-gas lease is 1/8; the School Land Board sets the actual rate per sale, commonly 20–25% (25% standard in high-value plays).
- **Worked example:** SLB lease at 1/4 = 0.250000000 royalty to State funds; statutory floor 1/8 = 0.125000000.
- **Authority:** Tex. Nat. Res. Code § 52.022 (min 1/8); SLB rules 31 Tex. Admin. Code ch. 9. VERIFIED. *The seed-list citation "§ 52.0161" does not appear to exist — use § 52.022. [seed citation CORRECTED]* **Status:** SETTLED. **Software mapping:** COMPUTABLE per lease terms.

### TXM-053 — Riverbed / Channel Leases
- **Landman statement:** Navigable riverbeds/channels are State-owned and leased directly by the State; minimum royalty 1/8; royalty may not be reduced below an adjoining lease's rate held by the same lessee. No surface-owner split.
- **Worked example:** Riverbed royalty 1/8 = 0.125000000, 100% to State funds.
- **Authority:** Tex. Nat. Res. Code § 52.088 (min 1/8); § 32.067(e) (anti-reduction). VERIFIED. **Status:** SETTLED. **Software mapping:** COMPUTABLE.

### TXM-054 — Highway / County-Road ROW Minerals
- **Landman statement:** State highway ROW minerals are leased by the GLO/SLB (adjacent owner has a preferential right; lease extends to centerline). Royalty set per lease, floored at the adjoining-lease rate. For county-road leases entered on/after 9/1/2017, bonus and royalty are paid directly to the county.
- **Authority:** Tex. Nat. Res. Code §§ 32.201–32.207; § 32.067(f); § 32.201(j) (H.B. 2521, 84th Leg., eff. 9/1/2017); 31 Tex. Admin. Code § 9.22. VERIFIED. *Exact highway-ROW royalty fraction [UNVERIFIED — set per lease, tied to adjoining rate].* **Status:** SETTLED (framework). **Software mapping:** STOP-AND-ASK.

## 6B. Curative / Boundary / Title Items (Tier 1)

### TXM-060 — Correction Instruments (Prop. Code §§ 5.027–.031; Broadway/Yates)
- **Landman statement:** Non-material corrections (§ 5.028) can be made by one party; material corrections (§ 5.029) require all original parties (or, if applicable, their heirs/successors/assigns). Original parties may execute a material correction even after a third party acquired an interest (Broadway/Yates), subject to bona-fide-purchaser protection (§ 5.030). Corrections relate back to the original instrument date.
- **Math effect:** Can retroactively change conveyed fractions (e.g., fee → life estate), altering decimals back to the original effective date.
- **Authority:** Tex. Prop. Code §§ 5.027–5.031; Broadway Nat'l Bank v. Yates Energy Corp., 631 S.W.3d 16 (Tex. 2021). VERIFIED. **Status:** SETTLED. **Software mapping:** STOP-AND-ASK; examiners generally require current owners to join despite Broadway (Texas Title Examination Standards).

### TXM-061 — Strip-and-Gore / Centerline Presumption
- **Landman statement:** A conveyance of land abutting a road, strip, or narrow gore is presumed to carry title to the centerline of the road/strip unless expressly reserved — so small strips don't become orphaned in the grantor. Affects which minerals pass.
- **Authority:** Texas strip-and-gore doctrine / centerline presumption (common law). VERIFIED (doctrine; specific pin cites [UNVERIFIED]). **Status:** SETTLED (doctrine). **Software mapping:** STOP-AND-ASK.

### TXM-062 — Adverse Possession Effect on Fractions
- **Landman statement:** Adverse possession of the surface generally does NOT reach severed minerals (no possession of minerals without production); but AP can change surface/mineral ownership and, where minerals are unsevered, can mature title to the whole. Limitations titles change bookable fractions.
- **Authority:** Texas limitations statutes (Civ. Prac. & Rem. Code ch. 16); common-law severed-mineral rule. VERIFIED (doctrine). **Status:** FACT-SPECIFIC. **Software mapping:** STOP-AND-ASK.

### TXM-063 — Co-Tenancy / Disproportionate Leasing Accounting
- **Landman statement:** Any cotenant may lease its undivided share; a non-joining cotenant is unleased and entitled to its share of net production after the producing cotenant recoups reasonable/necessary costs. Decimals reflect each cotenant's MI × its own lease terms.
- **Worked example:** 1/2 cotenant leases at 1/5 royalty; 1/2 cotenant unleased. Leased side royalty: 1/2 × 1/5 = 1/10 = 0.100000000; unleased cotenant takes 1/2 of production net of costs.
- **Authority:** Texas cotenancy common law (Burnham v. Hardy Oil line). VERIFIED (doctrine). **Status:** SETTLED. **Software mapping:** COMPUTABLE; cost recoupment STOP-AND-ASK.

### TXM-064 — Community Lease
- **Landman statement:** When multiple separately owned tracts are covered by one lease (community lease), royalties are shared by all lessors in proportion to acreage — an exception to non-apportionment.
- **Worked example:** Tracts A (40 ac) and B (40 ac) in one 1/8 lease; well on A. Each owner shares 1/8 royalty by acreage: A 40/80 × 1/8 = 1/16 = 0.062500000; B same 0.062500000.
- **Authority:** Texas community-lease doctrine; cf. Japhet, 276 S.W. 669. VERIFIED (doctrine). **Status:** SETTLED. **Software mapping:** COMPUTABLE.

### TXM-065 — Depth / Substance Severances
- **Landman statement:** Mineral estates can be severed by depth (above/below a formation) or substance (oil & gas vs coal/lignite/uranium); each severed estate has its own owners and decimals.
- **Authority:** common-law severance; Moser v. U.S. Steel (Tex. 1984) (surface-destruction test for "other minerals"). VERIFIED (doctrine). **Status:** SETTLED. **Software mapping:** COMPUTABLE with depth/substance tags.

### TXM-066 — Partition (In Kind / By Sale)
- **Landman statement:** Cotenants may partition minerals in kind (each takes a divided tract) or by sale (proceeds split by fractions). In-kind partition converts undivided fractions into 100% ownership of separate tracts — changing who owns production from each tract.
- **Authority:** Tex. Prop. Code ch. 23; Tex. R. Civ. P. 756–771. VERIFIED (statutory framework). **Status:** SETTLED. **Software mapping:** COMPUTABLE post-partition; pre-partition reversal STOP-AND-ASK.

### TXM-067 — Vara / League Survey Conversions; Called-vs-Actual Acreage
- **Landman statement:** Old Texas surveys use varas (1 vara = 33⅓ inches) and leagues; "called" acreage in a deed may differ from actual surveyed acreage, changing per-acre participation factors and pooled decimals.
- **Math note:** 1 vara = 2.777777778 ft; 1 sq vara = 7.716049383 sq ft; 1 labor ≈ 177.1 ac; 1 league = 25 labores ≈ 4,428.4 ac.
- **Authority:** Texas survey system (GLO); common-law boundary construction. VERIFIED (system). **Status:** SETTLED. **Software mapping:** STOP-AND-ASK (called vs actual requires survey interpretation).

### TXM-068 — Mother Hubbard Clause
- **Landman statement:** A Mother Hubbard ("cover-all") clause sweeps small adjacent strips/unnamed parcels into the lease to catch gaps; can expand leased acreage beyond the described tract, affecting unit acreage and decimals.
- **Authority:** lease convention; construed narrowly by Texas courts. VERIFIED (convention). **Status:** SETTLED. **Software mapping:** STOP-AND-ASK.

### TXM-069 — Tax / Sheriff's Deeds; Stranger-to-Title; Record-Gap Conventions
- **Landman statement:** Tax-foreclosure and sheriff's deeds can convey or cloud mineral title (subject to redemption periods); a reservation in favor of a "stranger to title" is void (can't reserve to a non-party); record gaps in the chain are handled by curative (affidavits, quitclaims, stipulations) and title-standard presumptions — not by MERS-style electronic registries, which don't exist in mineral title.
- **Authority:** Tex. Tax Code ch. 34 (tax sales/redemption); stranger-to-title rule (common law); Texas Title Examination Standards. VERIFIED (frameworks); specific pin cites [UNVERIFIED]. **Status:** SETTLED. **Software mapping:** STOP-AND-ASK; book gap-affected interests as provisional pending curative.

## 6C. Tier 2 Inventory (name / math effect / source / trigger — no deep treatment)

- **Federal/BLM communitization:** A CA pools federal + fee tracts; royalty allocated by acreage in the CA. Source: 43 CFR 3105; BLM onshore orders. Trigger: federal lease in the unit. Math effect: federal owner's decimal = federal royalty × CA acreage factor. Federal preemption applies to federal-lease terms.
- **ONRR valuation:** Federal royalty value set by ONRR rules (30 CFR pt. 1206) — gross proceeds/index; changes the *value*, not the fraction. Trigger: federal lease production. Preemption: federal.
- **Federal unit participation:** Exploratory/secondary units allocate production by participation factors in the BLM-approved unit agreement. Trigger: federal unit. Math: participation factor × royalty.
- **New Mexico state & fee basics:** NM State Land Office leases (commonly 1/8–3/16–1/5 royalty); NM compulsory pooling (Oil Conservation Division) with statutory risk charge; NM late-payment interest (NMSA § 70-10-4). Trigger: NM tract. Math effect: NM forced-pooling risk charge differs from Texas MIPA; NM has true compulsory pooling unlike Texas.
- **Indian lands (out of product scope, one paragraph):** Minerals on tribal/allotted lands are leased under federal law (25 CFR pts. 211/212; Indian Mineral Development Act) with BIA approval; royalty rates and valuation are federally governed and often tribe-specific; communitization requires BIA consent. These are outside LANDroid's Texas/NM scope and should be hard-flagged as unsupported — do not compute decimals; route to specialized counsel.

## 6D. Double-Fraction Construction Guide

Modern construction outcome (post-Van Dyke/Hysaw) with worked numbers both ways:

| Pattern | Presumptive modern outcome | Worked (presumed) | Worked (literal/rebutted) |
|---|---|---|---|
| "1/2 of 1/8" (minerals) | 1/2 of whole estate | 1/2 = 0.500000000 | 1/16 = 0.062500000 |
| "1/2 of 1/8 royalty" | floating 1/2 of lease royalty | at 1/4 lease: 0.125000000 | fixed 1/16 = 0.062500000 |
| "1/8 of royalty" | floating 1/8 of lease royalty | at 1/5 lease: 1/8×1/5 = 0.025000000 | (same if literal) |
| "one-half interest in all oil royalty" | floating 1/2 of royalty | at 1/4: 0.125000000 | n/a (single fraction) |
| "1/3 of 1/8 royalty" (Hysaw) | floating 1/3 of royalty | at 1/5: 1/3×1/5 = 0.066666667 | fixed 1/24 = 0.041666667 |
| "1/16 of production" (single, restated) | fixed fractional royalty | 1/16 = 0.062500000 | (same) |

**Fixed vs floating indicators:** "of production"/"of all oil and gas produced" → fixed; "of royalty"/"of the royalty provided in any lease" → floating; a restated single fraction ("1/2 of 1/8, being 1/16") tends fixed; presence of 1/8 in a double fraction triggers the Van Dyke presumption toward floating/whole-estate. ALL antique double fractions = STOP-AND-ASK.

## 6E. Coverage Checklist (self-audit — each item cataloged or excluded)

- Adverse possession → TXM-062 ✓
- Co-tenancy / disproportionate leasing → TXM-063 ✓
- Community leases → TXM-064 ✓
- Entirety clauses → TXM-010 ✓
- Pooling ratification by NPRI/unleased owners → TXM-033 ✓
- Pugh clauses (vertical/horizontal) → TXM-043 ✓
- Retained-acreage clauses → TXM-044 ✓
- Depth & substance severances → TXM-065 ✓
- Term mineral/royalty & reversions → TXM-045 ✓
- Executive-right duties → TXM-042 ✓
- Washout of ORRIs / anti-washout → TXM-041 ✓
- Farmout/earned interests → TXM-046 ✓
- Carried interests & BIAPO → TXM-046 ✓
- Net profits interests → TXM-046 ✓
- Production payments → TXM-046 ✓
- JOA non-consent penalties → TXM-047 ✓
- Preferential rights → noted: pref-right to lease on State ROW (TXM-054); private prefs don't change a decimal until exercised — STOP-AND-ASK ✓
- Rule 37 exceptions (unit math only) → affects proration-unit size/allowable, hence retained-acreage (TXM-044) and tract factors (TXM-030) ✓
- Strip-and-gore / centerline → TXM-061 ✓
- Accretion/avulsion → changes riparian tract acreage and thus participation; STOP-AND-ASK (no standalone decimal rule) ✓
- Vara/league conversions; called vs actual → TXM-067 ✓
- Over-conveyance & estoppel beyond Duhig → TXM-001/002/003 ✓
- After-acquired title → TXM-003 ✓
- Mother Hubbard → TXM-068 ✓
- Correction deeds (5.027–.031) → TXM-060 ✓
- Record-gap conventions (MERS-style N/A) → TXM-069 ✓
- Stranger-to-title → TXM-069 ✓
- Tax foreclosure / sheriff's deeds → TXM-069 ✓
- Partition (in kind / by sale) → TXM-066 ✓

## 6F. Adjacent-but-Out-of-Scope Appendix (boundary made explicit)

These do NOT produce a mineral-title ownership decimal and are excluded from the engine's title math (handle in separate modules):
- **Severance tax computation** (Tex. Tax Code ch. 201 gas / 202 oil) — a tax on value, not an ownership fraction.
- **Ad valorem (property) tax** on mineral interests — appraisal-district valuation.
- **Accounting / COPAS** — joint-account cost allocation, overhead, audit; affects net cash, not title fractions.
- **Post-production cost *accounting*** — note: the *valuation point* that determines deductibility IS in scope (TXM-013), but the line-item cost computation is out of scope.
- **Severance-tax reimbursement / marketing-cost line items** on check stubs.

*Items remaining: none. Catalog complete (Parts 1–6).*

---

## Recommendations
1. **Stage 1 (build now — COMPUTABLE core):** implement TXM-001/003 (Duhig/after-acquired), TXM-009/010/011/064 (apportionment family), TXM-020–025 (intestacy by death date), TXM-030/034/040 (pooled-unit + DOI balancing + WI/NRI), TXM-050–053 (state-lands splits), TXM-043/045/047 (Pugh, term reversion, non-consent). These are deterministic given clean inputs.
2. **Stage 2 (guardrails — STOP-AND-ASK gating):** hard-flag every instrument that (a) predates ~1980 and contains a double fraction with /8 (TXM-004/005), (b) contains a "subject-to" clause (TXM-007), (c) is a state-lands tract (TXM-050–054), (d) derives an interest through an affidavit of heirship (TXM-026), or (e) involves an allocation/PSA well (TXM-032). Route to attorney; never auto-compute.
3. **Stage 3 (dual-computation outputs):** for SPLIT/FACT-SPECIFIC items (TXM-004, 005, 007, 008), emit BOTH candidate decimals with the authority and a review flag — never silently pick one.
4. **Benchmarks that change the plan:** if a 2025–2026 Texas Supreme Court decision adopts a bright-line double-fraction rule, downgrade TXM-004 from STOP-AND-ASK to COMPUTABLE; if SCOTX validates allocation-well attribution, do the same for TXM-032; pull the current NY Fed rate for § 91.403 interest (statutory rate = NY Fed rate + 2 points) and confirm the SLB standard royalty under § 52.022 at build time and annually.
5. **Verify before shipping:** the remaining [UNVERIFIED] items — the 2026 Eastland remand pin cite, the highway-ROW royalty fraction, and strip-and-gore/stranger-to-title pin cites.

## Caveats
- Several pin cites carry [UNVERIFIED] flags where a precise reporter page could not be confirmed in the research window; treat these as provisional. Note the seed-list "§ 52.0161" for PSF royalty was incorrect; the controlling provision is **§ 52.022** (minimum 1/8).
- The Van Dyke double-fraction presumption (now verified as **668 S.W.3d 353 (Tex. 2023)**) and the Wenske "subject-to" allocation are the highest-risk, most litigation-prone areas; the catalog deliberately routes them to human review.
- The § 91.403 late-payment interest rate is a single statutory figure — **2 percentage points above the NY Federal Reserve rate** charged on loans to depository institutions, unless a written agreement specifies otherwise (verbatim § 91.403(a)). Do not apply a 4-point margin to § 91.403.
- State-lands royalty rates (TXM-052/054) are partly set by School Land Board rule per lease sale, not fixed by statute; confirm current rates at build time.
- This catalog is a software specification, not legal advice; every STOP-AND-ASK flag means a licensed Texas oil-and-gas attorney must confirm before a number is booked. East Texas counties in the user's footprint (Walker, Montgomery, San Jacinto, Grimes, Trinity, Polk, Waller) include both fee minerals and potential PSF/RA and riverbed tracts (e.g., Trinity/San Jacinto river systems), so the state-lands flags (TXM-050–054) and the Sam Houston National Forest federal-surface overlay (which does not by itself change private mineral fractions) should be wired into the intake screen.
