# TXM Catalog — Round 3 (Federal/NM Supplement + Import Appendix), received 2026-06-10

Final external research deliverable (Parts 7-9) from the prompts at
`docs/title-math-research-prompt.md` + `docs/title-math-research-supplement.md`.
Reference, not authority — attorney check required before any formula lands.

> **COUNSEL APPROVAL — 2026-06-15.** The operator's attorney reviewed and
> APPROVED the rules behind the shipped (#180) attorney-nuanced math: the DA-H1
> excess-allocation rule (a fixed NPRI is satisfied from the burdened lessor's
> royalty first; the excess is charged to the WI) and the Van Dyke double-fraction
> **presumption reading** (an antique "1/2 of 1/8" is presumptively 1/2 of the
> estate; the engine captures the verbatim clause and never auto-multiplies).
> Those two formulas are now counsel-approved for payout reliance; the in-app
> warnings were softened from "pending sign-off" to "counsel-approved" accordingly.
> The remaining specific-citation `[UNVERIFIED]` flags below (e.g. the Eastland
> remand pin cite, the riverbed statute codification, PBEX II status, the
> highway-ROW fraction) are NOT yet resolved — they are independent
> source-verification items that gate no shipped feature and stay as STOP-AND-ASK
> per the Stage-4 directive until specifically confirmed.

**INTAKE NOTES:**
1. REDACTION: one acreage figure describing the operator's future project was
   redacted at intake per project confidentiality (marked `[scale redacted]`).
2. ID SCHEMES — now three. Round 3's new items (TXM-070..079) extend Round 2's
   sequence, BUT its "ADDITION 2" master index re-numbers the Texas items a
   THIRD way (e.g., Van Dyke: R1=TXM-002, R2=TXM-004, R3 index=TXM-007;
   Wenske: R1=005, R2=007, R3=011; Relinquishment Act: R1=008, R2=050,
   R3=061). The CSV blocks use ROUND 3's index ids. Items are unambiguous by
   NAME + authority; a canonical in-repo master index reconciling all three
   schemes is the planned fix (do not import the CSVs before it exists).
3. Round 3 carries BOTH Mar-2026 Van Dyke events (Clifton v. Johnson rebuttal,
   verified per researcher; Eastland remand affirmance, [UNVERIFIED]) — both
   post-2026-01, attorney/primary-source verification required.
Content below is verbatim as delivered, except the marked redaction.

---

# Texas / Federal-BLM / New Mexico Mineral-Title & Division-Order Rule Catalog — SUPPLEMENT & COMPLETION (Parts 7–9)
## TL;DR
- **The single highest-stakes change since the prior brief: federal onshore royalty is no longer a fixed 16.67%.** The Inflation Reduction Act (Pub. L. 117-169 §50262, effective Aug 16, 2022) raised the statutory minimum from 12.5% to 16⅔% (0.166666667); the One Big Beautiful Bill Act of 2025 (Pub. L. 119-21 §50101(a)(1), signed July 4, 2025) repealed that provision and "restored section 17(b)(1)(A) of the MLA 'as if [the IRA] had not been enacted into law,'" returning the minimum to 12.5% for leases ISSUED on or after July 4, 2025. The engine **must branch royalty by lease ISSUE date across three regimes** — and IRA-vintage (2022–2025) leases keep 16.67% by contract.
- Federal/BLM and New Mexico items are now full Tier-1 (TXM-070 through TXM-079). The operator's biggest unsettled math is **fed/fee horizontal allocation (TXM-074)**: BLM **requires** a communitization agreement (surface-acreage allocation) for any federal tract, while Texas's allocation-well line rests only on *Browning Oil Co. v. Luecke*, 38 S.W.3d 625, 647 (Tex. App.—Austin 2000, pet. denied) — an intermediate court, productive-lateral-length method with **no Texas Supreme Court holding** (*Opiela* settled Jan 2025). **New Mexico has true compulsory pooling** with a statutory risk charge capped at 200% of the nonconsenting owner's share of well cost (NMSA 70-2-17).
- Every item from all parts is covered in the IMPORT APPENDIX (three machine-importable CSV blocks). Dollar figures and rates are verified against the U.S. Code, 43 CFR, BLM IM 2026-018, and the Federal Register; remaining uncertainties are flagged [UNVERIFIED].
---
## Key Findings
1. **Three federal fiscal regimes, keyed to lease issue date.**
   - Pre-Aug 16, 2022: royalty 12.5%; rentals $1.50/ac (yrs 1–5), $2.00/ac thereafter; minimum bid $2/acre.
   - Aug 16, 2022 – July 3, 2025 (IRA): royalty 16⅔% (0.166666667); rentals $3/$5/$15; minimum bid $10/acre; $5/acre EOI fee; noncompetitive leasing eliminated; vented/flared methane royalty imposed. Per Mercer Capital, "Existing leases issued under the IRA remain subject to the higher 16.67% rate."
   - On/after July 4, 2025 (OBBB): royalty 12.5%; **rentals unchanged at $3/$5/$15**; **minimum bid unchanged at $10/acre**; EOI fee repealed ($0); noncompetitive leasing reinstated ($75 application fee); methane royalty repealed (OBBB §50103 "repealed the royalty on methane that the IRA imposed on federal onshore and offshore leases issued after August 16, 2022").
2. **OBBB left the IRA's rental and minimum-bid increases intact** — only the royalty rate, EOI fee, noncompetitive-leasing ban, and methane royalty were rolled back. OBBB also imposes new leasing mandates: at least four lease sales annually in each of nine producing states (Wyoming, New Mexico, Colorado, Utah, Montana, North Dakota, Oklahoma, Nevada, and Alaska).
3. **Communitization is the federal equivalent of pooling.** Surface-acreage allocation is the default; the CA is effective from the agreement date or onset of production from the communitized formation, whichever is earlier — except when a state pooling order issues after first sale, in which case the CA effective date is the order's effective date.
4. **Fed/fee horizontal allocation is genuinely unsettled and must not be auto-resolved.** Federal tracts require a CA (surface acreage); Texas fee-only allocation wells commonly use lateral length under *Browning*, but that is an intermediate-court ruling, *Opiela* settled before the Texas Supreme Court ruled, and the two methods produce materially different decimals.
5. **New Mexico diverges from Texas on two software-critical points:** it has true compulsory pooling (200% statutory risk-charge cap, NMSA 70-2-17 / 19.15.13.8 NMAC), and it construes double-fraction instruments contextually rather than via the Texas *Van Dyke* floating presumption.
---
## Details
### PART 7 — FEDERAL / BLM PACK (Tier-1)
> This is Part 7 of the supplement. Continues the existing ID sequence (prior catalog: TXM-001 through TXM-069). Texas law controls Tier-1 Texas items; federal preemption is flagged inline. Exact arithmetic: fractions first, then 9-decimal expansion.
#### TXM-070 — BLM Competitive Leasing Mechanics & Fiscal Terms by Lease Vintage
- context: Federal / BLM
- Landman statement: When the operator leases federal minerals from the United States, the royalty rate, rentals, minimum bid, and EOI fee are fixed by the lease's ISSUE date, not the date you do the math. Three fiscal regimes now exist (pre-IRA, IRA, OBBB) and the engine must pick the right one per lease.
- Deed/lease language that triggers it: Standard BLM Form 3100-11 oil and gas lease; "Royalty Rate: 16.67 percent" (IRA-era) vs. "not less than 12.5 percent" (pre-IRA and OBBB-era); rental schedule recited in the lease.
- The math rule: Royalty rate R = f(issue date). Rentals are per-acre per-year by lease-year band. US royalty share on a tract = tractParticipation × R.
- Worked example (three regimes, same 640-acre lease, lessee owns 100% WI):
  - Pre-Aug 16, 2022 lease: R = 1/8 = 0.125000000. Rentals $1.50/ac yrs 1–5, $2.00/ac thereafter. Minimum bid $2/acre.
  - Aug 16, 2022–July 3, 2025 (IRA) lease: R = 16⅔% = 0.166666667. Per U.S. DOI (Apr 2024), the IRA rental is "$3 per acre per year during the first two-year period … then $5 per acre per year for the subsequent 6 years, and then $15 per acre per year thereafter," and the minimum bid "increases to $10 per acre, up from $2 per acre." EOI fee $5/acre (IRA §50262 fee "must start at $5 per acre").
  - On/after July 4, 2025 (OBBB) lease: R = 1/8 = 0.125000000. Rentals UNCHANGED at $3/$5/$15. Minimum bid UNCHANGED at $10/acre. EOI fee REPEALED ($0). Noncompetitive leasing reinstated ($75 application fee).
- Authority: Mineral Leasing Act, 30 U.S.C. §226; Inflation Reduction Act of 2022, Pub. L. 117-169 §50262 (eff. Aug 16, 2022); BLM final rule "Fluid Mineral Leases and Leasing Process," 89 FR 30916 (Apr 23, 2024, eff. June 22, 2024) codifying 43 CFR pts 3100+; One Big Beautiful Bill Act of 2025, Pub. L. 119-21 §50101 (signed July 4, 2025) — per Davis Graham & Stubbs, "Section 50101(a)(1) of the Reconciliation Act repealed this IRA provision and restored section 17(b)(1)(A) of the MLA 'as if [the IRA] had not been enacted into law,'" where the IRA had raised 30 U.S.C. §226(b)(1)(A) "from a minimum of 12.5% to 16 2/3%"; BLM IM 2026-018. Fiscal-terms table at 43 CFR 3103.1(a).
- Temporal applicability: Royalty/rental/bid keyed to lease ISSUE date. Pre-8/16/2022 = 12.5%; 8/16/2022–7/3/2025 = 16.67% (those leases keep 16.67% by contract — OBBB did not lower them); ≥7/4/2025 = 12.5%. The IRA's vented/flared methane royalty (also added 8/16/2022) was repealed by OBBB §50103.
- Status: SETTLED (statutory). [UNVERIFIED] flag: the 43 CFR 3103.31(a) direct final rule restating "not less than 12.5%" was set effective June 29, 2026 — confirm not withdrawn; the statutory 12.5% governs regardless.
- Interactions: TXM-072, TXM-073, TXM-074, TXM-075.
- Division-order practice note: Analysts must capture lease issue date as a first-class field. A common error is booking all federal leases at one royalty; post-2022 checkerboards mix 12.5%, 16.67%, and (≥7/4/2025) 12.5% leases in one unit.
- Software mapping: Inputs: lease issue date, recited royalty rate, acreage, lease-year. COMPUTABLE.
#### TXM-071 — Federal Lease Anatomy for Math: Terms, Suspensions, Segregation, Acreage Limits
- context: Federal / BLM
- Landman statement: Federal leases run a 10-year primary term; suspensions (SOO/SOP) toll the term and may toll rentals/royalties; partial assignment or partial unit commitment segregates the lease into two leases. No decimal math expected here, but these events change what acreage is held and when.
- Deed/lease language that triggers it: "primary term of 10 years"; suspension orders; assignment instruments; unit/communitization commitment of part of a lease.
- The math rule: Segregation splits one lease into committed vs. uncommitted portions, each with its own term. Suspension extends the term by the suspension period.
- Worked example: A 2,560-acre lease commits 1,280 acres to a unit → segregates into a 1,280-acre committed lease and a 1,280-acre uncommitted lease; the uncommitted segregated lease continues for the lease term or 2 years from segregation, whichever is longer.
- Authority: 30 U.S.C. §226; 43 CFR 3107 (continuation/extension/segregation, e.g. 3107.3-2); 43 CFR subpart 3212 and 43 CFR 3103.4-4 / 3165.1 (suspensions); statewide acreage limit 246,080 acres per state (43 CFR 3101.20).
- Temporal applicability: Segregation rules apply to leases committed after July 29, 1954.
- Status: SETTLED.
- Interactions: TXM-070, TXM-072, TXM-073.
- Division-order practice note: A suspension of operations and production (Section 39-type) tolls rentals/royalties; a suspension of operations only does not toll rentals.
- Software mapping: Inputs: term dates, suspension dates, assignment/commitment events, acreage. COMPUTABLE for term/acreage tracking; no royalty decimal.
#### TXM-072 — Communitization Agreements (CAs): Tract Participation & Royalty Distribution
- context: Federal / BLM
- Landman statement: When a federal lease cannot independently fill a state spacing/proration unit, the operator combines it with adjacent (often fee) tracts via a communitization agreement — the federal equivalent of pooling. Production is allocated to each tract, by default on surface acreage, and royalties flow to each tract's owners at that tract's lease terms.
- Deed/lease language that triggers it: BLM model CA form (authority 30 U.S.C. §226(j)/(m)); "the apportionment of the production or royalties to the several parties"; Exhibit B tract/ownership table.
- The math rule: Tract Participation Factor TPF(tract) = tract acres in CA ÷ total CA acres. Royalty decimal for an owner = TPF × royaltyFraction × mineralInterestFraction.
- Worked example (mixed fed/fee 320-acre CA): Federal tract = 200 ac, Fee tract = 120 ac.
  - TPF(fed) = 200/320 = 0.625000000; TPF(fee) = 120/320 = 0.375000000.
  - Fee royalty owner (owns 100% minerals, leased 3/16): 0.375000000 × 0.187500000 × 1.0 = 0.070312500.
  - US royalty on federal tract, OBBB-vintage lease (12.5%): 0.625000000 × 0.125000000 = 0.078125000; WI net revenue on federal tract = 0.625000000 × 0.875000000 = 0.546875000.
  - US royalty on federal tract, IRA-vintage lease (16.67%): 0.625000000 × 0.166666667 = 0.104166667; WI net = 0.625000000 × 0.833333333 = 0.520833333.
- Authority: 30 U.S.C. §226(m); 43 CFR subpart 3105 (esp. 43 CFR 3105.2-3 requirements / current 3105.23); BLM Manual 3160-9 (Communitization).
- Temporal applicability: CA effective from the agreement date or onset of production from the communitized formation, whichever is earlier; EXCEPT where the spacing unit is subject to a state pooling order after first sale, the CA effective date is the order's effective date. File ≥90 days before first production for ONRR reporting.
- Status: SETTLED (mechanics); surface-acreage default may be varied by agreement (FACT-SPECIFIC).
- Interactions: TXM-070, TXM-073, TXM-074, TXM-078, TXM-075.
- Division-order practice note: A CA can be approved without joinder of royalty/ORRI/production-payment owners; payment then varies by where the producing well is completed. Furnish any state force-pooling order with the CA if an owner does not sign.
- Software mapping: Inputs: CA tract acres, total CA acres, each tract's lease royalty + mineral interest. COMPUTABLE.
#### TXM-073 — Federal Units (Exploratory/Secondary): Participating-Area Math & PA Revisions
- context: Federal / BLM
- Landman statement: A federal exploratory unit covers a large area; only the proven "participating area" (PA) shares production, allocated by tract acreage in the PA. PAs are revised as more area is proven, and every revision re-cuts the decimals.
- Deed/lease language that triggers it: BLM model unit agreement (43 CFR 3186.1, Appendix A to part 3180); "Each such tract shall have allocated to it such percentage of said production as the number of acres of such tract … bears to the total acres of unitized land … in said participating area."
- The math rule: Tract PA factor = tract acres in PA ÷ total acres in PA. On PA revision, recompute with the new denominator. Unleased federal land inside the PA triggers compensatory royalty.
- Worked example: Initial PA = 640 ac; Tract A = 400 ac, Tract B = 240 ac. A = 400/640 = 0.625000000; B = 240/640 = 0.375000000. PA revised to 800 ac (add 160 ac Tract C): A = 400/800 = 0.500000000; B = 240/800 = 0.300000000; C = 160/800 = 0.200000000.
- Authority: 43 CFR part 3180 (subpart 3180; 3180.0-5 definitions; 3183.5 PA approval/revision; 3186.1 model agreement); 30 U.S.C. §226(j)–(m).
- Temporal applicability: PA effective when productivity criteria met; revisions effective per BLM approval.
- Status: SETTLED.
- Interactions: TXM-072, TXM-074, TXM-070.
- Division-order practice note: Production is allocated equally on an acreage basis from all tracts in the PA; a tract outside the PA gets zero even if inside the unit boundary.
- Software mapping: Inputs: PA tract acres, PA total acres, PA effective/revision dates. COMPUTABLE.
#### TXM-074 — Fed/Fee Horizontal Allocation (HIGHEST-STAKES; competing methods)
- context: Federal / BLM
- Landman statement: A lateral crosses fee tracts to a bottom hole under federal land. There is no single settled rule. BLM requires a communitization agreement (surface-acreage allocation) to hold and pay the federal tract; Texas operators commonly use productive-lateral-length allocation (*Browning v. Luecke*) for fee-only allocation/PSA wells, but Texas has no Supreme Court holding endorsing it. The two methods produce DIFFERENT decimals; present both and label for attorney review.
- Deed/lease language that triggers it: Allocation-well permits (RRC Form W-1 / P-16 in Texas); PSA recitals; CA Exhibit B; no pooling clause or anti-pooling ("no pooling in any manner whatsoever") clause.
- The math rule (competing):
  - (A) Productive-lateral-length: tractFactor = productive lateral feet in tract ÷ total productive lateral feet.
  - (B) Surface-acreage CA: tractFactor = tract acres ÷ total unit acres.
  - (C) Take-point allocation: by perforations/production points per tract.
- Worked example: Total productive lateral = 10,000 ft (fee = 3,000 ft, federal = 7,000 ft); unit acreage 320 (fee = 120, federal = 200).
  - Method A (lateral length): fee = 3000/10000 = 0.300000000; federal = 7000/10000 = 0.700000000.
  - Method B (surface acreage): fee = 120/320 = 0.375000000; federal = 200/320 = 0.625000000.
  - Divergence on the fee tract: 0.300000000 vs 0.375000000 — a 0.075000000 swing that the engine must NOT resolve silently.
- Authority: *Browning Oil Co. v. Luecke*, 38 S.W.3d 625, 647 (Tex. App.—Austin 2000, pet. denied) — the Austin (intermediate) court held "[t]he better remedy is to allow the offended lessors to recover royalties as specified in the lease, compelling a determination of what production can be attributed to their tracts with reasonable probability," endorsing lateral-length allocation but not binding statewide; *Spartan Texas Six Capital Partners v. EOG* (settled, no holding); *Springer Ranch v. Jones* (San Antonio COA; contract-specific); *R.R. Comm'n v. Opiela*, 681 S.W.3d 387 (Tex. App.—Austin 2023), petition settled/remanded Jan 2025 (no SCOTX holding); for federal tracts, 30 U.S.C. §226(m) + 43 CFR subpart 3105 REQUIRE a CA.
- Temporal applicability: *Browning* governs allocation disputes from 2000 forward; federal CA requirement is continuous.
- Status: SPLIT AUTHORITY / FACT-SPECIFIC. Federal portion: a CA is REQUIRED (surface-acreage default). Fee-only portion: unsettled in Texas.
- Interactions: TXM-072, TXM-073, TXM-070; Texas allocation-well items in the Texas pack.
- Division-order practice note: For any tract that includes federal minerals, do NOT pay on lateral-length alone — BLM will require the CA decimal (surface acreage). For fee-only allocation wells most operators pay lateral-length, but flag the unratified owners and anti-pooling clauses (*Opiela* facts).
- Software mapping: Inputs: per-tract lateral feet, total lateral feet, per-tract acres, total acres, federal/fee flag. COMPUTABLE but STOP-AND-ASK when federal minerals present (must use CA) or when an anti-pooling/unratified owner is present.
#### TXM-075 — ONRR Royalty Valuation & Reporting (Phase 2 boundary — inventory only)
- context: Federal / BLM
- Landman statement: How the federal royalty VALUE (not the decimal) is computed — gross proceeds less allowable transportation/processing allowances, with "unbundling" of bundled fees — is governed by ONRR rules and is deliberately out of scope for Phase 1. Catalog the moving parts; do not build the deep valuation math yet.
- Deep math: Not built in Phase 1.
- Moving parts inventoried: marketable-condition rule (lessee bears cost to make product marketable; gathering not deductible, transportation is); transportation allowance (30 CFR 1206.152 / .156-.157); processing allowance (30 CFR 1206.158-.159); unbundling / Unbundling Cost Allocations (UCAs); arm's-length vs non-arm's-length valuation; Form ONRR-2014 reporting.
- Authority: 30 CFR part 1206 (subparts C Federal Oil, D Federal Gas); 30 U.S.C. §1701 et seq. (FOGRMA).
- Temporal applicability: 2017 valuation reform rule (eff. Jan 1, 2017) governs current valuation.
- Status: SETTLED (rules exist); flagged as PHASE 2 BOUNDARY.
- Interactions: TXM-070, TXM-072.
- Division-order practice note: The decimal (TXM-072/073) and the value (TXM-075) are separate computations; Phase 1 computes decimals only.
- Software mapping: STOP-AND-ASK (Phase 2).
> Part 7 items remaining: 0.
---
### PART 8 — NEW MEXICO PACK (Tier-1.5)
> This is Part 8. New Mexico essentials at Tier-1.5 depth — rules plus one worked example each.
#### TXM-076 — NMSLO State Trust Land Leases
- context: New Mexico
- Landman statement: New Mexico state trust (State Land Office) oil and gas leases use three statutory forms with royalty rates set by land class; the most productive ("restricted/premium") tracts carry the highest royalty. Assignments require NMSLO approval on the prescribed form and fee.
- Deed/lease language that triggers it: NMSLO lease series; exploratory/discovery/development lease forms; reduced-royalty stipulations.
- The math rule: Royalty decimal = NMSLO royalty fraction × tract participation × mineral interest, same structure as fee but with the statutory state rate.
- Worked example: 320-acre CA, NMSLO tract = 160 ac at a 20% (1/5) development-form royalty; state's royalty decimal = (160/320) × 0.200000000 = 0.500000000 × 0.200000000 = 0.100000000.
- Authority: NMSA 1978 §§19-10-4.1 (exploratory), 19-10-4.2 (discovery), 19-10-4.3 (development); 19.2.100 NMAC (esp. 19.2.100.13 term/form; royalty cap of three-sixteenths for development-form tracts scoring <90 points); statewide royalty range 12.5%–20%.
- Temporal applicability: Lease form/royalty fixed at issuance; older leases may be "stipulated" up to current terms.
- Status: SETTLED.
- Interactions: TXM-072, TXM-078.
- Division-order practice note: NMSLO views co-lessees as joint tenants each holding 100% undivided interest; assignments must be on form O-30-A with filing fee.
- Software mapping: Inputs: lease form/class, royalty rate, acreage, mineral interest. COMPUTABLE.
#### TXM-077 — NM Intestacy & Community-Property Descent
- context: New Mexico
- Landman statement: New Mexico is a community-property UPC state. A decedent's community-property half passes entirely to the surviving spouse; separate property splits 1/4 to spouse / 3/4 to issue when there are children. Death date matters for older estates.
- Deed/lease language that triggers it: Affidavits of heirship; probate inventories; intestacy in the chain.
- The math rule: Community property → 100% of decedent's half to spouse (post-July 1, 1973). Separate property with issue → spouse 1/4, issue 3/4 by representation.
- Worked example (separate-property mineral tract, spouse + 2 children): spouse = 1/4 = 0.250000000; each child = (3/4)/2 = 3/8 = 0.375000000. (Community-property tract, same survivors: spouse takes decedent's entire community half; children take 0 of community.)
- Authority: NMSA 1978 §45-2-102 (share of spouse), §45-2-103 (other heirs, by representation), §45-2-104 (120-hour survival), §45-2-105 (escheat). Pre-June 12, 1959 deaths: surviving spouse kept 1/2 + 1/4 of decedent's half = 5/8, children 3/8.
- Temporal applicability: Current rule from July 1, 1973; transition rules for deaths before June 12, 1959 and June 12, 1959–July 1, 1973.
- Status: SETTLED.
- Interactions: Texas probate pack analogs (community vs separate); TXM-076.
- Division-order practice note: Confirm character (community vs separate) of the mineral interest before applying the split; mischaracterization is the most common NM heirship error.
- Software mapping: Inputs: death date, property character, surviving spouse/issue. COMPUTABLE.
#### TXM-078 — NM OCD Spacing & Compulsory Pooling (Risk Charge)
- context: New Mexico
- Landman statement: Unlike Texas, New Mexico has true compulsory pooling. The OCD can force-pool a nonconsenting working-interest owner; the operator may recover that owner's share of well cost plus a risk charge capped at 200% of that share, recouped only out of the nonconsenting owner's production.
- Deed/lease language that triggers it: OCD pooling order; "200% charge for the risk involved in drilling and completing the well."
- The math rule: Nonconsent recoupment = (WI × wellCost) + riskCharge, where riskCharge ≤ 2.00 × (WI × wellCost). Max total withheld = 3 × (WI × wellCost).
- Worked example: Nonconsenting WIO owns 25% WI; well cost $8,000,000. Cost share = 0.250000000 × 8,000,000 = $2,000,000. Risk charge (max 200%) = 2.00 × 2,000,000 = $4,000,000. Maximum recouped from that owner's production before payout = 2,000,000 + 4,000,000 = $6,000,000 (i.e., 300% of cost share). After recoupment the owner reverts to a normal 25% WI / NRI.
- Authority: NMSA 1978 §70-2-17 (equitable allocation/pooling/spacing; risk charge "shall not exceed two hundred percent of the nonconsenting working interest owner's … prorata share of the cost of drilling and completing the well"); 19.15.13 NMAC (compulsory pooling), 19.15.13.8 NMAC (charge for risk; default 200% of well costs unless OCD orders otherwise).
- Temporal applicability: Statute current; orders effective per OCD order date.
- Status: SETTLED (statutory cap is 200%).
- Interactions: TXM-072 (state order can commit interest to a federal CA), TXM-076.
- Division-order practice note: During recoupment the nonconsenting owner is paid only a lease-burden (royalty) decimal; the WI/NRI flips at payout. Track the payout flip explicitly.
- Software mapping: Inputs: WI fraction, well cost, risk percentage (≤200%), payout status. COMPUTABLE.
#### TXM-079 — NM Double-Fraction / Fixed-vs-Floating
- context: New Mexico
- Landman statement: New Mexico construes double-fraction royalty/mineral instruments but takes a more contextual, extrinsic-evidence-friendly approach than Texas's four-corners + estate-misconception framework. Outcomes can diverge from Texas on identical language, so don't assume *Van Dyke* controls a New Mexico tract.
- Deed/lease language that triggers it: "one-half of one-eighth," "X/16 of the usual 1/8 royalty," and similar double fractions in NM-situs instruments.
- The math rule: Fixed = rote multiplication (e.g., 1/2 × 1/8 = 1/16 = 0.062500000). Floating = the double-fraction "1/8" is a placeholder for the lease royalty (e.g., 1/2 of the actual lease royalty). Compute BOTH and label.
- Worked example: "1/2 of 1/8" on a tract now leased at 3/16. Fixed: 1/2 × 1/8 = 0.062500000. Floating: 1/2 × 3/16 = 1/2 × 0.187500000 = 0.093750000.
- Authority: New Mexico applies a contextual/extrinsic-evidence approach (contrast Texas: *Van Dyke v. Navigator Group*, 668 S.W.3d 353 (Tex. 2023); *Hysaw v. Dawkins*, 483 S.W.3d 1 (Tex. 2016)). [UNVERIFIED] — a controlling NM Supreme Court double-fraction case directly on point was not confirmed; treat NM construction as fact-specific pending a named NM authority.
- Temporal applicability: Instrument-date dependent.
- Status: SPLIT AUTHORITY (Texas vs NM approach) / FACT-SPECIFIC.
- Interactions: Texas double-fraction items; TXM-076.
- Division-order practice note: For NM-situs instruments, do not auto-apply the Texas *Van Dyke* floating presumption; flag for attorney and present both decimals.
- Software mapping: STOP-AND-ASK; compute both fixed and floating.
> Part 8 items remaining: 0.
---
### ADDITION 2 — MASTER INDEX (all entries, two new columns)
The master index now carries `context` (Texas | Federal / BLM | New Mexico | General) and `authorityYears` (pipe-separated). The original Texas TXM-001 through TXM-069 are carried forward from Parts 1–6 unchanged except for these two columns; new federal/NM entries are TXM-070 through TXM-079. (A `0` in authorityYears denotes an industry-convention item with no controlling-year authority.)

[INTAKE NOTE: the claim "carried forward unchanged" is incorrect — this index
re-numbers the Texas items a third way. Kept verbatim below; reconcile via the
planned canonical master index before importing.]

| TXM | Name (abridged) | context | authorityYears |
|---|---|---|---|
| 001 | Duhig over-conveyance rule | Texas | 1940 |
| 002 | Greater-fraction / proportionate reduction | Texas | 1940 |
| 003 | Fixed vs floating NPRI (double fraction) | Texas | 1991\|2016\|2023\|2026 |
| 004 | Luckel four-corners harmonization | Texas | 1991 |
| 005 | Concord Oil grant/sub-to harmonization | Texas | 1998 |
| 006 | Hysaw double-fraction (will) | Texas | 2016 |
| 007 | Van Dyke double-fraction presumption | Texas | 2023 |
| 008 | Clifton v. Johnson (first Van Dyke rebuttal) | Texas | 2026 |
| 009 | Heritage v. NationsBank royalty valuation | Texas | 1996 |
| 010 | Chesapeake v. Hyder no-postproduction | Texas | 2015\|2016 |
| 011 | Wenske v. Ealy reservation burden | Texas | 2017 |
| 012 | Perryman v. Spartan estate misconception | Texas | 2018 |
| 013 | Piranha Partners v. Neuhoff ORRI conveyance scope | Texas | 2020 |
| 014 | After-acquired title / estoppel by deed | Texas | 1940 |
| 015 | Mother Hubbard / cover-all clause | General | 1940 |
| 016 | Correction instruments (material/nonmaterial) | Texas | 2011 |
| 017 | Strip-and-gore / centerline presumption | Texas | 1949 |
| 018 | Stranger-to-title rule | Texas | 1957 |
| 019 | Intestate descent by death date | Texas | 1993 |
| 020 | Community vs separate property | Texas | 1993 |
| 021 | Per stirpes / by representation trees | General | 1993 |
| 022 | Half-blood inheritance | Texas | 1993 |
| 023 | Adoption & inheritance | Texas | 1993 |
| 024 | 120-hour survival rule | Texas | 1993 |
| 025 | Life estate / remainder valuation | General | 1993 |
| 026 | Open-mine doctrine | Texas | 1934 |
| 027 | Affidavit-of-heirship limits | Texas | 1993 |
| 028 | Blended-family fractions | Texas | 1993 |
| 029 | Pooled-unit decimal (RI) | General | 1965 |
| 030 | Proportionate reduction clause | General | 1981 |
| 031 | NPRI ratification & pooling | Texas | 1968 |
| 032 | Unleased mineral owner in unit | Texas | 1965 |
| 033 | Mineral Interest Pooling Act unit math | Texas | 1965\|1977 |
| 034 | Rule 37 exception / allocation | Texas | 1943 |
| 035 | Anti-dilution / acreage limits in pooling | Texas | 2000 |
| 036 | Browning allocation-well (lateral length) | Texas | 2000 |
| 037 | Production Sharing Agreement well decimal | Texas | 2007 |
| 038 | Springer Ranch contract allocation | Texas | 2014 |
| 039 | DOI 8-decimal convention & deck balancing | General | 0 |
| 040 | Payout flip (BIAPO) | General | 0 |
| 041 | Top-lease / unleased-owner handling | Texas | 0 |
| 042 | Working interest → NRI conversion | General | 0 |
| 043 | ORRI computation | General | 0 |
| 044 | ORRI washout / anti-washout | Texas | 1957 |
| 045 | Net profits interest | General | 0 |
| 046 | Production payment | General | 0 |
| 047 | Carried interest / BIAPO | General | 0 |
| 048 | JOA non-consent penalty | General | 0 |
| 049 | Farmout / earned interest | General | 0 |
| 050 | Preferential right to purchase | General | 0 |
| 051 | Executive-right duty (Lesley/KCM) | Texas | 2011\|2015 |
| 052 | Montgomery v. Rittersbacher NPRI/executive | Texas | 1968 |
| 053 | Exxon v. Middleton market value at well | Texas | 1981 |
| 054 | Gavenda v. Strata over-conveyed royalty | Texas | 1986 |
| 055 | Natural Gas Pipeline v. Pool / limitations | Texas | 2003 |
| 056 | ConocoPhillips v. Koopmann (future interest) | Texas | 2018 |
| 057 | Burlington v. Texas Crude ORRI postproduction | Texas | 2019 |
| 058 | Broadway Nat'l Bank v. Yates trust/royalty | Texas | 2021 |
| 059 | Thomson v. Hoffman | Texas | 2023 |
| 060 | ConocoPhillips v. Hahn | Texas | 2024 |
| 061 | Relinquishment Act lands (1/16 + agency) | Texas | 1919\|1928 |
| 062 | Greene v. Robison (RA construction) | Texas | 1928 |
| 063 | Sales & Leasing Act 1931 (1/16 royalty) | Texas | 1931 |
| 064 | PSF / GLO lease royalty mechanics | Texas | 1931 |
| 065 | Riverbed / Small Bill lands | Texas | 1929 |
| 066 | Highway-strip / ROW royalty mechanics | Texas | 0 |
| 067 | Adverse possession & co-tenancy leasing | Texas | 0 |
| 068 | Partition / tax-foreclosure-sheriff's deed | Texas | 0 |
| 069 | Vara/league conversions, called vs actual acreage | Texas | 0 |
| 070 | BLM competitive leasing / fiscal terms by vintage | Federal / BLM | 1920\|2022\|2024\|2025 |
| 071 | Federal lease anatomy (terms/suspension/segregation) | Federal / BLM | 1954\|2024 |
| 072 | Communitization agreements | Federal / BLM | 1920\|2024 |
| 073 | Federal units / participating area | Federal / BLM | 2002\|2008 |
| 074 | Fed/fee horizontal allocation | Federal / BLM | 2000\|2023 |
| 075 | ONRR royalty valuation (Phase 2) | Federal / BLM | 2017 |
| 076 | NMSLO state trust land leases | New Mexico | 2016\|2019 |
| 077 | NM intestacy / community property | New Mexico | 1973\|2011 |
| 078 | NM OCD spacing / compulsory pooling | New Mexico | 1935\|1978 |
| 079 | NM double-fraction / fixed-floating | New Mexico | 2023 |
---
### TEMPORAL LAW LEDGER (additions for federal/NM; merge with prior ledger)
| Year/Date | Authority | What changed | Applies to | TXM ids |
|---|---|---|---|---|
| 1919 | Relinquishment Act | State retains 1/16 royalty; surface owner is leasing agent | PSF lands sold 1895–1931 | 061,062,063 |
| 1920 | Mineral Leasing Act (30 U.S.C. 181/226) | Federal onshore leasing framework; 12.5% royalty | Federal leases | 070,072 |
| 1935/1978 | NM Oil & Gas Act / NMSA 70-2-17 | Compulsory pooling; risk charge ≤200% | NM wells | 078 |
| 1973 (Jul 1) | NM community-property descent | Decedent's community half to surviving spouse | NM intestacy | 077 |
| 2000 | Browning Oil Co. v. Luecke (Tex. App.) | Lateral-length allocation (no SCOTX holding) | TX allocation wells | 036,074 |
| 2016 (Jan 1) | ONRR valuation reform | Current federal valuation/unbundling rules | Federal royalty value | 075 |
| Aug 16, 2022 | Inflation Reduction Act §50262 (Pub. L. 117-169) | Royalty 12.5%→16.67%; rentals $3/$5/$15; min bid $2→$10; $5/ac EOI fee; ended noncompetitive leasing; methane royalty | Federal leases issued 8/16/2022–7/3/2025 | 070 |
| June 22, 2024 | BLM final rule, 89 FR 30916 (43 CFR 3100+) | Codified IRA fiscal terms; raised bonding | Federal leases | 070,071 |
| 2023 (Feb 17) | Van Dyke v. Navigator (Tex.) | Double-fraction floating presumption | TX double-fraction instruments | 003,007 |
| Jan 2025 | Opiela settlement/remand | Allocation/PSA permit authority left unresolved | TX allocation wells | 074 |
| July 4, 2025 | One Big Beautiful Bill Act §50101 (Pub. L. 119-21) | Royalty 16.67%→12.5% (leases issued ≥7/4/2025); reinstated noncompetitive leasing ($75 fee); repealed $5/ac EOI fee (§50101(d)); repealed methane royalty (§50103); rentals & $10 min bid unchanged; ≥4 sales/yr in 9 states | Federal leases issued ≥7/4/2025 | 070 |
| Aug 1, 2025 | Fed. Reg. final rule, 90 FR 36118 | Removed EOI fee from 43 CFR 3120.31 | Federal EOIs | 070 |
| Mar 13, 2026 | Clifton v. Johnson (Tex.) | First rebuttal of Van Dyke presumption (1951 deed → fixed 1/128) | TX double-fraction instruments | 008 |
---
### DOUBLE-FRACTION CONSTRUCTION GUIDE (federal/NM addendum)
- **Texas:** start with the *Van Dyke* rebuttable presumption that "1/8" in a double fraction refers to the entire mineral estate (floating); rebut only with textual indicia (*Clifton v. Johnson*, Mar 13, 2026, rebutted via a granting clause stating the product "1/128" alongside "(1/16 of the usual 1/8 royalty)").
- **New Mexico:** more contextual/extrinsic-evidence approach; do not auto-apply the Texas presumption. Compute BOTH fixed and floating and flag.
- Worked both ways ("1/2 of 1/8," tract now leased at 3/16): Fixed = 0.062500000; Floating = 0.093750000.
---
## PART 9 — IMPORT APPENDIX
Three fenced CSV blocks below cover EVERY item from all parts. Use `|` to separate multiple values within a field; fields containing commas are quoted. Each block is complete and self-contained (no continuation across responses).
### CSV 1 — research_sources.csv
```
title,sourceType,context,status,citation,url,notes
Mineral Leasing Act of 1920,Statute,Federal / BLM,Verified,30 U.S.C. 181 et seq.; 30 U.S.C. 226,https://uscode.house.gov,Federal onshore oil and gas leasing; base 12.5% royalty; governs 1920-present
Inflation Reduction Act of 2022,Statute,Federal / BLM,Verified,"Pub. L. 117-169, sec. 50262 (Aug. 16, 2022)",https://www.congress.gov,"Raised onshore royalty to 16.67%, rentals 3/5/15, min bid 10, EOI fee 5/acre; governs leases issued 8/16/2022-7/3/2025"
One Big Beautiful Bill Act of 2025,Statute,Federal / BLM,Verified,"Pub. L. 119-21, sec. 50101 (July 4, 2025)",https://www.congress.gov,"Restored 12.5% min royalty for leases issued on/after 7/4/2025; reinstated noncompetitive leasing; repealed EOI fee and methane royalty"
BLM Fluid Mineral Leases and Leasing Process Rule,Agency Guidance,Federal / BLM,Verified,"89 FR 30916 (Apr. 23, 2024), eff. June 22, 2024; 43 CFR pts 3100+",https://www.federalregister.gov/documents/2024/04/23/2024-08138/fluid-mineral-leases-and-leasing-process,Codified IRA fiscal terms and raised bonding; governs 2024-present
BLM EOI Fee Removal Rule,Agency Guidance,Federal / BLM,Needs Review,90 FR 36118 (Aug. 1, 2025) [UNVERIFIED pinpoint 36120/3120.31(d)],https://www.federalregister.gov/documents/2025/08/01/2025-14621/revision-to-regulations-regarding-competitive-leases-expression-of-interest-process,Removed 5/acre EOI fee per OBBB; start page and date confirmed
43 CFR Part 3100,Agency Guidance,Federal / BLM,Verified,43 CFR Part 3100,https://www.ecfr.gov/current/title-43/subtitle-B/chapter-II/subchapter-C/part-3100,Onshore oil and gas leasing general; fiscal-terms table 3103.1(a)
Communitization regulations,Agency Guidance,Federal / BLM,Verified,30 U.S.C. 226(m); 43 CFR subpart 3105,https://www.ecfr.gov/current/title-43/subtitle-B/chapter-II/subchapter-C/part-3100/subpart-3105,Surface-acreage allocation default; CA effective from agreement or first production; governs federal/fee pooling
BLM Manual 3160-9 Communitization,Manual,Federal / BLM,Verified,BLM Manual 3160-9 (Rel. 3-215, 7/7/88),https://www.blm.gov/sites/blm.gov/files/uploads/mediacenter_blmpolicymanual3160-9.pdf,Model CA forms and approval/effective-date mechanics
43 CFR Part 3180 unit agreements,Agency Guidance,Federal / BLM,Verified,43 CFR part 3180; 43 CFR 3186.1,https://www.ecfr.gov/current/title-43/subtitle-B/chapter-II/subchapter-C/part-3180,Exploratory unit participating-area acreage allocation; model unit agreement
43 CFR subpart 3212 suspensions,Agency Guidance,Federal / BLM,Verified,43 CFR subpart 3212; 43 CFR 3103.4-4; 43 CFR 3165.1,https://www.ecfr.gov/current/title-43/subtitle-B/chapter-II/subchapter-C/part-3200/subpart-3212,SOO/SOP suspensions toll lease term; SOP also tolls rentals/royalties
43 CFR 3107 segregation/extension,Agency Guidance,Federal / BLM,Verified,43 CFR 3107.3-2,https://www.govregs.com,Partial unit commitment segregates lease; segregated lease continues 2 years or term
ONRR Product Valuation rule,Agency Guidance,Federal / BLM,Verified,30 CFR part 1206; eff. Jan. 1 2017,https://www.ecfr.gov/current/title-30/chapter-XII/subchapter-A/part-1206,"Federal royalty value = gross proceeds less transportation/processing allowances; unbundling; Phase 2"
NMSA 70-2-17 compulsory pooling,Statute,Other,Verified,NMSA 1978 sec. 70-2-17,https://law.justia.com/codes/new-mexico/chapter-70/article-2/section-70-2-17/,New Mexico: risk charge not to exceed 200% of nonconsenting owner's cost share; governs NM force pooling
19.15.13.8 NMAC charge for risk,Agency Guidance,Other,Verified,19.15.13.8 NMAC,https://www.law.cornell.edu/regulations/new-mexico/N-M-Admin-Code-SS-19.15.13.8,New Mexico: default risk charge 200% of well costs unless OCD orders otherwise
NMSA 45-2-102 share of spouse,Statute,Other,Verified,NMSA 1978 sec. 45-2-102,https://law.justia.com/codes/new-mexico/chapter-45/article-2/part-1/subpart-1/section-45-2-102/,New Mexico intestacy: community half to spouse; separate property 1/4 spouse if issue
NMSA 45-2-103 other heirs,Statute,Other,Verified,NMSA 1978 sec. 45-2-103,https://law.justia.com/codes/new-mexico/2018/chapter-45/article-2/section-45-2-103/,New Mexico: issue take by representation; governs heirs other than spouse
NMSLO oil and gas lease statutes,Statute,Other,Verified,NMSA 1978 secs. 19-10-4.1/4.2/4.3; 19.2.100 NMAC,https://www.srca.nm.gov/parts/title19/19.002.0100.html,New Mexico state trust land lease forms; royalty 12.5%-20%
Browning Oil Co. v. Luecke,Case,Texas,Verified,"38 S.W.3d 625 (Tex. App.-Austin 2000, pet. denied)",https://law.justia.com,Lateral-length allocation for horizontal wells; not binding statewide; governs 2000-present
R.R. Commission of Texas v. Opiela,Case,Texas,Verified,"681 S.W.3d 387 (Tex. App.-Austin 2023, pet. settled Jan. 2025)",https://www.energyandthelaw.com,Allocation/PSA permit authority; settled before SCOTX ruling; no binding holding
Van Dyke v. Navigator Group,Case,Texas,Verified,668 S.W.3d 353 (Tex. 2023),https://law.justia.com/cases/texas/supreme-court/2023/21-0146.html,Double-fraction rebuttable presumption that 1/8 means entire mineral estate; governs antique deeds
Hysaw v. Dawkins,Case,Texas,Verified,483 S.W.3d 1 (Tex. 2016),https://law.justia.com,Double-fraction in will = floating royalty; holistic harmonization; governs 2016-present
Clifton v. Johnson,Case,Texas,Verified,"(Tex. Mar. 13, 2026)",https://www.liskow.com,First rebuttal of Van Dyke presumption; 1951 deed read as fixed 1/128; governs 2026-present
Relinquishment Act of 1919,Statute,Texas,Verified,"Acts 1919, 36th Leg., 2nd C.S., ch. 81; Tex. Nat. Res. Code ch. 52",https://capitol.texas.gov,State retains 1/16 royalty; surface owner leasing agent; PSF lands sold 1895-1931
Greene v. Robison,Case,Texas,Verified,117 Tex. 516 (1928),https://law.justia.com,Construed Relinquishment Act: landowner is state's agent; governs RA lands
Texas Natural Resources Code 91.402,Statute,Texas,Verified,Tex. Nat. Res. Code sec. 91.402,https://codes.findlaw.com/tx/natural-resources-code/nat-res-sect-91-402/,Royalty payment timing and division-order rules; SB 1259 (2021) abrogated common-law claim
Texas SB 1259 (2021),Statute,Texas,Verified,"Tex. SB 1259, 87th Leg. (eff. May 24, 2021)",https://www.legis.state.tx.us/tlodocs/87R/billtext/html/SB01259F.HTM,Amended NRC 91.402; no common-law breach claim for withheld payments
Texas highway-ROW royalty statutes,Statute,Texas,Needs Review,Tex. Nat. Res. Code 32.201-.207 [UNVERIFIED],,Highway strip/ROW royalty mechanics; pin cite not independently confirmed
Small Bill riverbed statute,Statute,Texas,Needs Review,"Acts 1929 (Small Bill) [UNVERIFIED]",,Riverbed/streambed mineral ownership; exact codification not confirmed
PBEX II v. Dorchester,Case,Texas,Needs Review,[UNVERIFIED citation/status],,Status and citation not independently confirmed this pass
```
### CSV 2 — research_formulas.csv
```
title,category,status,formulaText,explanation,variables,example,notes
TXM-070 — BLM Competitive Leasing Fiscal Terms by Vintage,Federal Lease Math,Needs Review,R = f(leaseIssueDate); USroyalty = TPF * R,Federal royalty/rental/bid are fixed by lease issue date across three regimes,leaseIssueDate=issue date|R=royalty rate|TPF=tract participation factor,"OBBB lease (>=7/4/2025): R=0.125000000; IRA lease (8/16/2022-7/3/2025): R=0.166666667; pre-2022: R=0.125000000",Mineral Leasing Act of 1920|Inflation Reduction Act of 2022|One Big Beautiful Bill Act of 2025|BLM Fluid Mineral Leases and Leasing Process Rule; royalty by issue date; interacts 072/073/074
TXM-072 — Communitization Agreement Decimal,Unit / Pooling Math,Needs Review,TPF = tractAcres / totalCAacres; royaltyDecimal = TPF * royaltyFraction * mineralInterest,Federal lease combined with adjacent tracts to fill a state spacing unit; surface-acreage allocation default,tractAcres=tract acres in CA|totalCAacres=total CA acres|royaltyFraction=lease royalty|mineralInterest=owner MI,"320-ac CA, fee tract 120 ac, 3/16 royalty, 100% MI: 0.375000000 * 0.187500000 * 1.0 = 0.070312500",Communitization regulations|BLM Manual 3160-9 Communitization|Mineral Leasing Act of 1920; effective from agreement or first production; interacts 070/073/074/078
TXM-073 — Federal Unit Participating-Area Decimal,Unit / Pooling Math,Needs Review,PAfactor = tractAcresInPA / totalPAacres,Only proven participating area shares production; revisions recut decimals,tractAcresInPA=tract acres in PA|totalPAacres=total PA acres,"PA 640 ac, Tract A 400 ac: 400/640 = 0.625000000; after revision to 800 ac: 400/800 = 0.500000000",43 CFR Part 3180 unit agreements; effective when productivity criteria met; interacts 072/074
TXM-074 — Fed/Fee Horizontal Allocation (competing),Unit / Pooling Math,Needs Review,A: tractFactor = lateralFeetInTract / totalLateralFeet; B: tractFactor = tractAcres / totalUnitAcres,Lateral crosses fee to bottom hole under federal land; methods diverge; federal tract requires CA,lateralFeetInTract=productive lateral ft in tract|totalLateralFeet=total productive ft|tractAcres=tract acres|totalUnitAcres=unit acres,"Fee tract: lateral-length 3000/10000 = 0.300000000 vs surface-acreage 120/320 = 0.375000000 (0.075000000 swing)",Browning Oil Co. v. Luecke|R.R. Commission of Texas v. Opiela|Communitization regulations; no SCOTX holding; federal requires CA; interacts 072/073/070
TXM-076 — NMSLO State Trust Lease Decimal,Royalty Math,Needs Review,royaltyDecimal = NMroyaltyFraction * TPF * mineralInterest,New Mexico state trust land royalty by statutory lease form/class,NMroyaltyFraction=state royalty 0.125-0.20|TPF=tract participation|mineralInterest=MI,"160-ac NMSLO tract of 320-ac CA at 20%: 0.500000000 * 0.200000000 = 0.100000000",NMSLO oil and gas lease statutes; royalty 12.5%-20% by class; interacts 072/078
TXM-077 — NM Intestacy Decimal,Decimal Interest Calculations,Needs Review,separate w/ issue: spouse=1/4 issue=3/4 by rep; community: decedent half to spouse,New Mexico community-property UPC intestacy,deathDate=date of death|character=community or separate|issue=number of children,"Separate tract, spouse + 2 children: spouse 0.250000000; each child 3/8 = 0.375000000",NMSA 45-2-102 share of spouse|NMSA 45-2-103 other heirs; current rule from 7/1/1973; interacts 076
TXM-078 — NM Compulsory Pooling Risk Charge,Unit / Pooling Math,Needs Review,recoup = (WI * wellCost) + riskCharge; riskCharge <= 2.00 * (WI * wellCost),New Mexico force-pooled nonconsenting WIO recoupment before payout,WI=working interest fraction|wellCost=drill+complete cost|riskCharge=penalty <=200%,"25% WI, $8,000,000 cost: cost share $2,000,000; max risk $4,000,000; max recoup $6,000,000 (300% of share)",NMSA 70-2-17 compulsory pooling|19.15.13.8 NMAC charge for risk; statutory cap 200%; interacts 072/076
TXM-079 — NM Double-Fraction Fixed vs Floating,Royalty Math,Needs Review,fixed = f1 * f2; floating = f1 * actualLeaseRoyalty,New Mexico contextual construction; compute both,f1=first fraction|f2=second fraction (often 1/8)|actualLeaseRoyalty=current lease royalty,"1/2 of 1/8, leased at 3/16: fixed 0.062500000; floating 0.093750000",Van Dyke v. Navigator Group|Hysaw v. Dawkins; NM more contextual than TX; interacts 076
```
### CSV 3 — research_questions.csv
```
question,answer,status,notes
"For a fed/fee horizontal well, which allocation method governs the fee tract decimal?",Federal tracts must be communitized (surface-acreage allocation); fee-only allocation wells commonly use lateral-length (Browning) but Texas has no Supreme Court holding and Opiela settled before a ruling,Needs Review,Browning Oil Co. v. Luecke|R.R. Commission of Texas v. Opiela|Communitization regulations; TXM-074
Does the IRA 16.67% or OBBB 12.5% federal royalty apply to a given lease?,Keyed to lease ISSUE date: pre-8/16/2022 = 12.5%; 8/16/2022-7/3/2025 = 16.67% (kept by contract); on/after 7/4/2025 = 12.5%,Needs Review,One Big Beautiful Bill Act of 2025|Inflation Reduction Act of 2022|BLM Fluid Mineral Leases and Leasing Process Rule; TXM-070
Is the 43 CFR 3103.31(a) direct final rule restating 12.5% in effect?,Set effective June 29 2026; statutory 12.5% governs regardless of the regulatory text,Needs Review,One Big Beautiful Bill Act of 2025|BLM Fluid Mineral Leases and Leasing Process Rule; TXM-070
"For a New Mexico double-fraction instrument, is the royalty fixed or floating?",New Mexico uses a contextual/extrinsic approach and may diverge from the Texas Van Dyke floating presumption; compute both and flag,Needs Review,Van Dyke v. Navigator Group|Hysaw v. Dawkins; TXM-079
Is there a controlling New Mexico Supreme Court double-fraction case?,Not confirmed this pass; treat NM construction as fact-specific pending a named NM authority,Needs Review,[UNVERIFIED]; TXM-079
What is the exact citation for Texas highway-ROW royalty mechanics?,Believed Tex. Nat. Res. Code 32.201-.207 but pin cite not independently confirmed,Needs Review,Texas highway-ROW royalty statutes [UNVERIFIED]; TXM-066
What is the exact codification of the 1929 Small Bill riverbed statute?,Riverbed/streambed ownership statute not independently confirmed this pass,Needs Review,Small Bill riverbed statute [UNVERIFIED]; TXM-065
What is the citation and current status of PBEX II v. Dorchester?,Not independently confirmed this pass,Needs Review,PBEX II v. Dorchester [UNVERIFIED]
What is the Van Dyke remand pin cite at the Eastland court of appeals?,Not independently confirmed this pass,Needs Review,Van Dyke v. Navigator Group [UNVERIFIED]; TXM-007
Does the EOI fee removal rule pinpoint 90 FR 36120 and 43 CFR 3120.31(d)?,Start page 90 FR 36118 and Aug 1 2025 date and section 3120.31 confirmed; the (d) subsection and 36120 pinpoint unverified,Needs Review,BLM EOI Fee Removal Rule [UNVERIFIED pinpoint]; TXM-070
```
> Part 9 (IMPORT APPENDIX) items remaining: 0. All parts complete.
---
## Recommendations
**Stage 1 — Build the federal royalty branch by lease ISSUE date FIRST (P0).** Three regimes: pre-8/16/2022 = 12.5%; 8/16/2022–7/3/2025 = 16.67%; ≥7/4/2025 = 12.5%. A single wrong rate compounds across the entire federal checkerboard [scale redacted]. *Benchmark that changes this:* if BLM's 43 CFR 3103.31(a) direct final rule (effective June 29, 2026) is withdrawn, re-verify — but the statutory 12.5% governs regardless, so the branch logic stays.
**Stage 2 — Gate fed/fee allocation.** For any unit containing federal minerals, force the surface-acreage CA decimal path (TXM-072/074) and **block lateral-length allocation**. For fee-only allocation wells, default to lateral-length but raise a STOP-AND-ASK flag whenever an anti-pooling clause or unratified NPRI owner is present (the *Opiela* fact pattern). *Threshold to revisit:* a Texas Supreme Court holding on allocation-well royalty would let you harden the fee-only path.
**Stage 3 — Isolate New Mexico code paths.** Do not reuse the Texas *Van Dyke* presumption (compute both fixed and floating, flag) and do not assume "no compulsory pooling" — implement the NMSA 70-2-17 risk-charge model (≤200% cap, 300% max recoupment, payout flip) and the community-property descent rule. *Threshold to revisit:* a named, controlling NM Supreme Court double-fraction case would convert TXM-079 from STOP-AND-ASK to COMPUTABLE.
**Stage 4 — Carry every [UNVERIFIED] flag into the UI as a STOP-AND-ASK gate** rather than silently defaulting. Resolve the five flagged research questions (NM double-fraction authority; TX highway-ROW pin cite; Small Bill codification; PBEX II v. Dorchester; the EOI-fee regulatory pinpoint) before those entries drive a payment.
## Caveats
- **OBBB 2025 figures are verified** against the U.S. Code (30 U.S.C. §226 with Pub. L. 119-21 amendment notes), BLM IM 2026-018, Federal Register rules, and corroborating law-firm analyses (Davis Graham & Stubbs confirmed the §50101(a)(1) royalty restoration and §50103 methane-royalty repeal verbatim). Two regulatory pinpoints remain [UNVERIFIED]: the "(d)" subsection / "36120" page of the EOI-fee removal rule, and the effective-date status of the 43 CFR 3103.31(a) direct final rule (June 29, 2026).
- **IRA-vintage (2022–2025) leases keep 16.67% by contract** — OBBB did not lower them. Per Mercer Capital, "Existing leases issued under the IRA remain subject to the higher 16.67% rate." The engine must not retroactively reprice them to 12.5%.
- The Texas TXM-001–069 full entries are carried forward from Parts 1–6; only the two new index columns were added here. The `0` in authorityYears marks industry-convention items with no controlling-year authority.
- **No controlling New Mexico Supreme Court double-fraction case was confirmed**; NM construction is treated as fact-specific. The legislative-history note that NM reviews extrinsic evidence "at will" (vs. Texas's four-corners rule) comes from a practitioner CLE, not a holding.
- The CSV blocks use `Other` for New Mexico context per the import spec (with "New Mexico" stated in notes); `0`-year and convention items appear in the index but not necessarily as separate CSV-1 authority rows where no named authority exists.
- Federal preemption: for federal tracts, BLM/CFR requirements control over state allocation conventions; Texas and New Mexico law govern only the non-federal tracts and the underlying private-mineral chains of title.
