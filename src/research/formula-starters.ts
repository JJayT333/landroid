import {
  createBlankResearchFormula,
  createBlankResearchSource,
  type ResearchFormula,
  type ResearchFormulaCategory,
  type ResearchSource,
} from '../types/research';

const LANDMAN_REFERENCE_TITLE = 'LANDMAN Math Reference';
const LANDMAN_REFERENCE_CITATION = 'LANDMAN-MATH-REFERENCE.md';

interface FormulaStarterDefinition {
  key: string;
  title: string;
  category: ResearchFormulaCategory;
  formulaText: string;
  explanation: string;
  variables: string;
  example: string;
  engineReference: string;
  referenceSection: string;
}

const FORMULA_STARTERS: FormulaStarterDefinition[] = [
  {
    key: 'net-mineral-acres',
    title: 'Net Mineral Acres (NMA)',
    category: 'Leasehold',
    formulaText: 'gross acres x undivided mineral fraction',
    explanation:
      'Calculates the owner mineral acreage in a tract before pooled-acre weighting.',
    variables: 'gross acres; undivided mineral fraction',
    example: '320 gross acres x 1/2 mineral interest = 160 NMA.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 6.1',
  },
  {
    key: 'net-pooled-acres',
    title: 'Net Pooled Acres',
    category: 'Leasehold',
    formulaText: 'pooled acres x undivided mineral fraction',
    explanation:
      'Shows the owner acreage participating in the current unit or pooled tract setup.',
    variables: 'pooled acres; undivided mineral fraction',
    example: '320 pooled acres x 1/2 mineral interest = 160 net pooled acres.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 6.2',
  },
  {
    key: 'lease-coverage-allocation',
    title: 'Lease Coverage Allocation',
    category: 'Leasehold',
    formulaText:
      'allocate min(requested lease fraction, remaining owner fraction), in effective-date order',
    explanation:
      'Allocates active owner leases deterministically while surfacing overlap clipping for review.',
    variables: 'active lease status; effective date; requested lease fraction; remaining owner fraction',
    example:
      'An earlier active lease for 1/2 allocates before a later overlapping lease on the same owner.',
    engineReference: 'src/components/deskmap/deskmap-coverage.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 5',
  },
  {
    key: 'owner-tract-royalty',
    title: 'Owner Tract Royalty',
    category: 'Leasehold',
    formulaText: 'leased fraction x lease royalty rate',
    explanation:
      'Calculates the owner royalty slice on the tract from active lease coverage.',
    variables: 'leased fraction; lease royalty rate',
    example: '1/2 leased at 1/8 royalty = 1/16 owner tract royalty.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 6.3',
  },
  {
    key: 'tract-participation-factor',
    title: 'Texas Unit Tract Participation Factor',
    category: 'Leasehold',
    formulaText: 'tract pooled acres / total unit pooled acres',
    explanation:
      'Weights a tract against the current Texas leasehold unit review acreage; this is not federal CA math.',
    variables: 'tract pooled acres; total unit pooled acres',
    example: '320 pooled tract acres / 640 pooled unit acres = 0.5 TPF.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 6.4',
  },
  {
    key: 'owner-unit-royalty-decimal',
    title: 'Owner Unit Royalty Decimal',
    category: 'Transfer Order',
    formulaText: 'tract participation factor x owner tract royalty',
    explanation:
      'Acreage-weights the owner tract royalty into the current unit decimal review.',
    variables: 'tract participation factor; owner tract royalty',
    example: '0.5 TPF x 1/16 owner tract royalty = 0.03125.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 6.5',
  },
  {
    key: 'weighted-royalty-rate',
    title: 'Weighted Royalty Rate',
    category: 'Leasehold',
    formulaText: 'sum(leased fraction x royalty rate)',
    explanation:
      'Aggregates each active lease royalty contribution on the tract instead of assuming one lease rate.',
    variables: 'leased fraction; royalty rate',
    example: 'One 1/2 owner leased at 1/8 contributes 0.0625 weighted royalty.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 6.7',
  },
  {
    key: 'nri-before-orri',
    title: 'NRI Before ORRI',
    category: 'Leasehold',
    formulaText: 'leased ownership - weighted royalty rate',
    explanation:
      'Shows the after-royalty net revenue before ORRI and WI assignment review.',
    variables: 'leased ownership; weighted royalty rate',
    example: '0.5 leased ownership - 0.0625 royalty = 0.4375 NRI before ORRI.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 6.8',
  },
  {
    key: 'gross-eight-eighths-orri',
    title: 'Gross 8/8 ORRI Burden',
    category: 'ORRI',
    formulaText: 'leased ownership x ORRI share',
    explanation:
      'Calculates a gross-basis overriding royalty burden against the leased 8/8.',
    variables: 'leased ownership; ORRI share',
    example: '0.5 leased ownership x 1/16 ORRI = 0.03125 burden.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 6.9.1',
  },
  {
    key: 'working-interest-orri',
    title: 'Working-Interest ORRI Burden',
    category: 'ORRI',
    formulaText: 'leased ownership x ORRI share',
    explanation:
      'Applies the LANDroid Texas convention for a working-interest-basis ORRI.',
    variables: 'leased ownership; ORRI share',
    example: '1.0 leased ownership x 1/80 ORRI = 0.0125 burden.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 6.9.2',
  },
  {
    key: 'nri-basis-orri-stack',
    title: 'NRI-Basis ORRI Stack',
    category: 'ORRI',
    formulaText: 'remaining NRI base x ORRI share, applied in effective-date order',
    explanation:
      'Calculates NRI-basis ORRIs one at a time after gross and working-interest ORRIs.',
    variables: 'remaining NRI base; ORRI share; effective date',
    example:
      'If remaining NRI is 0.4, a 1/64 NRI-basis ORRI burdens 0.00625.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 6.9.3',
  },
  {
    key: 'fixed-npri-payout',
    title: 'Fixed NPRI Payout',
    category: 'NPRI',
    formulaText:
      'branch basis: leased fraction x fixed share; whole-tract basis: leased fraction / burdened branch ownership x fixed share',
    explanation:
      'Documents fixed NPRI payout treatment for burdened-branch and whole-tract deed readings.',
    variables: 'leased fraction; fixed NPRI share; burdened branch ownership; fixed royalty basis',
    example:
      'A whole-tract fixed 1/16 NPRI stays whole-tract based when the full burdened branch is leased.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 7',
  },
  {
    key: 'floating-npri-payout',
    title: 'Floating NPRI Payout',
    category: 'NPRI',
    formulaText: 'leased fraction x lease royalty x floating NPRI share',
    explanation:
      'Documents floating NPRI treatment when deed language follows the lease royalty bucket.',
    variables: 'leased fraction; lease royalty; floating NPRI share',
    example:
      'A floating 1/2 NPRI on a branch leased at 1/8 royalty receives half of that royalty bucket.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 7',
  },
  {
    key: 'pre-working-interest-rate',
    title: 'Pre-Working-Interest Rate',
    category: 'Leasehold',
    formulaText: 'NRI before ORRI - total ORRI burden, clamped at zero',
    explanation:
      'Calculates the tract NRI remaining after ORRI burdens and before WI assignment splits.',
    variables: 'NRI before ORRI; total ORRI burden',
    example: '0.4375 NRI before ORRI - 0.04375 ORRI burden = 0.39375.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 6.10',
  },
  {
    key: 'assigned-working-interest',
    title: 'Assigned / Retained WI Decimal',
    category: 'Transfer Order',
    formulaText:
      'assigned WI decimal = pre-WI decimal x assignment shares; retained WI decimal = pre-WI decimal - assigned WI decimal',
    explanation:
      'Calculates assigned and retained working-interest rows from the same pre-WI decimal.',
    variables: 'pre-working-interest decimal; assignment shares',
    example: '0.196875 pre-WI decimal x 1/2 assignment = 0.0984375.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Sections 6.11-6.12',
  },
  {
    key: 'transfer-order-variance',
    title: 'Transfer-Order Review Variance',
    category: 'Transfer Order',
    formulaText: 'abs(total transfer-order decimals - expected leased coverage decimal)',
    explanation:
      'Flags variance between the derived transfer-order review rows and expected leased coverage.',
    variables: 'total transfer-order decimals; expected leased coverage decimal',
    example: 'abs(0.248 - 0.25) = 0.002 variance.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Section 6.13',
  },
  // ── Phase 6 foundational cards ─────────────────────────────
  // The 16 cards below document the underlying landman math that the 16
  // Texas-advanced cards above assume. Keys are prefixed `foundation-` so
  // they never collide with existing starter keys in pre-overhaul workspaces.

  // Royalty Math (5)
  {
    key: 'foundation-royalty-fraction-to-decimal',
    title: 'Royalty Fraction → Decimal',
    category: 'Royalty Math',
    formulaText: 'numerator / denominator',
    explanation:
      'Converts a royalty fraction (e.g., 1/8, 3/16, 1/5) into the decimal form used in every downstream calculation.',
    variables: 'numerator; denominator',
    example: '1/8 = 0.125; 3/16 = 0.1875; 1/5 = 0.200.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Foundations — royalty fractions',
  },
  {
    key: 'foundation-lessor-royalty',
    title: 'Lessor Royalty on Production',
    category: 'Royalty Math',
    formulaText: 'production volume x lease royalty',
    explanation:
      'Calculates the gross lessor royalty share of production for a leased mineral owner before deductions.',
    variables: 'production volume; lease royalty',
    example: '1,000 bbl x 1/8 = 125 bbl lessor royalty.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Foundations — royalty on production',
  },
  {
    key: 'foundation-lessee-working-interest',
    title: 'Lessee Working Interest Share',
    category: 'Royalty Math',
    formulaText: '1 - lease royalty',
    explanation:
      'The fraction of production the lessee (WI owner) is entitled to before cost deductions and override burdens.',
    variables: 'lease royalty',
    example: '1 - 1/8 = 7/8 lessee WI share.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Foundations — WI share',
  },
  {
    key: 'foundation-bonus-consideration',
    title: 'Lease Bonus Consideration',
    category: 'Royalty Math',
    formulaText: 'bonus per net mineral acre x net mineral acres',
    explanation:
      'Calculates the upfront cash bonus owed to a mineral owner when the lease is executed.',
    variables: 'bonus per net mineral acre; net mineral acres',
    example: '$500/NMA x 160 NMA = $80,000 bonus.',
    engineReference: 'n/a — reference only',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Foundations — bonus math',
  },
  {
    key: 'foundation-delay-rental',
    title: 'Delay Rental',
    category: 'Royalty Math',
    formulaText: 'rental per acre x leased gross acres',
    explanation:
      'Annual rental paid to keep an unheld lease alive during its primary term.',
    variables: 'rental per acre; leased gross acres',
    example: '$1.50/acre x 640 acres = $960 annual delay rental.',
    engineReference: 'n/a — reference only',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Foundations — rental math',
  },

  // Decimal Interest Calculations (3)
  {
    key: 'foundation-mineral-decimal-interest',
    title: 'Mineral Decimal Interest',
    category: 'Decimal Interest Calculations',
    formulaText: 'undivided mineral fraction x lease royalty',
    explanation:
      'Converts a mineral owner undivided fraction into the royalty decimal used on division orders.',
    variables: 'undivided mineral fraction; lease royalty',
    example: '1/2 mineral x 1/8 royalty = 1/16 = 0.0625 decimal.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Foundations — decimal interest',
  },
  {
    key: 'foundation-unit-decimal-interest',
    title: 'Unit Decimal Interest',
    category: 'Decimal Interest Calculations',
    formulaText: '(net mineral acres / unit acres) x lease royalty',
    explanation:
      'Acreage-weights a tract owner royalty into the pooled unit decimal.',
    variables: 'net mineral acres; unit acres; lease royalty',
    example: '(160 NMA / 640 unit acres) x 1/8 royalty = 0.03125 unit decimal.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Foundations — unit decimal',
  },
  {
    key: 'foundation-decimal-interest-sum-check',
    title: 'Decimal Interest Sum Check',
    category: 'Decimal Interest Calculations',
    formulaText: 'sum of all owner decimal interests',
    explanation:
      'On a fully-leased unit the sum of royalty + ORRI + WI decimals must equal 1.0 (8/8). Used as a balance check before releasing a division order deck.',
    variables: 'owner decimal interests',
    example: 'A unit with 0.125 total royalty + 0.03125 ORRI + 0.84375 WI = 1.000.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Foundations — 8/8 balance',
  },

  // Unit / Pooling Math (3)
  {
    key: 'foundation-tract-factor',
    title: 'Tract Factor (Pooling Weight)',
    category: 'Unit / Pooling Math',
    formulaText: 'tract pooled acres / total unit acres',
    explanation:
      'Dimensionless weight each tract carries in a pooled unit. Every owner decimal in that tract multiplies by this factor.',
    variables: 'tract pooled acres; total unit acres',
    example: '320 tract acres / 640 unit acres = 0.500 tract factor.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Foundations — tract factor',
  },
  {
    key: 'foundation-pooling-contribution',
    title: 'Owner Pooling Contribution',
    category: 'Unit / Pooling Math',
    formulaText: 'owner net mineral acres / total unit acres',
    explanation:
      'The fraction of the pooled unit represented by a single owner before royalty is applied.',
    variables: 'owner net mineral acres; total unit acres',
    example: '80 NMA / 640 unit acres = 0.125 pooling contribution.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Foundations — pooling contribution',
  },
  {
    key: 'foundation-fully-pooled-check',
    title: 'Fully-Pooled Acreage Check',
    category: 'Unit / Pooling Math',
    formulaText: 'sum of tract pooled acres = declared unit acres',
    explanation:
      'Balance check that every tract brings the pooled acreage declared in the unit designation. Missing or over-contributed acres cause downstream decimals to drift.',
    variables: 'tract pooled acres; declared unit acres',
    example: '320 + 320 = 640 declared unit acres → balanced.',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Foundations — pooling balance',
  },

  // Federal Lease Math (3)
  {
    key: 'foundation-federal-lease-rental',
    title: 'Federal Lease Annual Rental',
    category: 'Federal Lease Math',
    formulaText: 'rental per acre x gross leased acres',
    explanation:
      'BLM form 3100-11 standard rental math — applied annually during the primary term. Reference-only for LANDroid (Texas math engine is not federal).',
    variables: 'rental per acre; gross leased acres',
    example: '$1.50/acre x 640 acres = $960/year.',
    engineReference: 'n/a — reference only (federal leases are inventory)',
    referenceSection: 'BLM Form 3100-11 — rental schedule',
  },
  {
    key: 'foundation-federal-royalty-rate',
    title: 'Federal Lease Royalty Rate',
    category: 'Federal Lease Math',
    formulaText: 'lease royalty fraction (typically 1/8 or 3/16)',
    explanation:
      'Federal onshore oil & gas leases issued today carry either a 1/8 (12.5%) or 3/16 (18.75%) royalty depending on acquisition method. BLM lease schedules list the rate explicitly.',
    variables: 'federal lease royalty rate',
    example: 'Raven Forest Unit A leases carry 1/8 federal royalty; Unit B carries 3/16.',
    engineReference: 'n/a — reference only',
    referenceSection: 'BLM Form 3100-11 — royalty section',
  },
  {
    key: 'foundation-federal-bonus-bid',
    title: 'Federal Bonus Bid',
    category: 'Federal Lease Math',
    formulaText: 'winning bid per acre x parcel acres',
    explanation:
      'Bonus consideration paid to the BLM at lease issuance. Separate from annual rental and from production royalty.',
    variables: 'winning bid per acre; parcel acres',
    example: '$2/acre minimum x 640 acres = $1,280 minimum bid.',
    engineReference: 'n/a — reference only',
    referenceSection: 'BLM — competitive onshore lease sale',
  },

  // Title Math Checks (2)
  {
    key: 'foundation-conveyance-sum-check',
    title: 'Conveyance Sum Check',
    category: 'Title Math Checks',
    formulaText: 'sum of conveyed fractions from a parent ≤ parent fraction',
    explanation:
      'Across every child conveyance from a single grantor, the total conveyed fraction cannot exceed what the grantor owned. Violations trigger the over-conveyance warning on Desk Map.',
    variables: 'parent fraction; child conveyance fractions',
    example: 'A grantor with 1/2 interest cannot convey 3/8 + 1/4 = 5/8 to two grantees.',
    engineReference: 'src/engine/fraction-math.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Foundations — conveyance budget',
  },
  {
    key: 'foundation-npri-reservation-check',
    title: 'NPRI Reservation Sanity Check',
    category: 'Title Math Checks',
    formulaText: 'sum of whole-tract-basis NPRIs ≤ 1',
    explanation:
      'Multiple whole-tract fixed NPRIs are carved sibling-style from the whole production stream. Their sum cannot exceed 1.0 or the tract would over-pay royalty on 8/8.',
    variables: 'whole-tract-basis NPRI fractions',
    example: 'A 1/16 + 1/32 whole-tract NPRI pair sums to 3/32 — safe.',
    engineReference: 'src/components/deskmap/deskmap-coverage.ts',
    referenceSection: 'LANDMAN-MATH-REFERENCE.md Foundations — NPRI budget',
  },
];

function idPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
}

function sourceIdForWorkspace(workspaceId: string): string {
  return `source-${idPart(workspaceId)}-landman-math-reference`;
}

function formulaIdForWorkspace(workspaceId: string, key: string): string {
  return `formula-${idPart(workspaceId)}-${key}`;
}

function findReferenceSource(sources: ResearchSource[], sourceId: string) {
  return sources.find(
    (source) =>
      source.id === sourceId ||
      source.title.trim().toLowerCase() === LANDMAN_REFERENCE_TITLE.toLowerCase() ||
      source.citation.trim().toLowerCase() === LANDMAN_REFERENCE_CITATION.toLowerCase()
  );
}

export function buildResearchFormulaStarterRecords(
  workspaceId: string,
  existingSources: ResearchSource[],
  existingFormulas: ResearchFormula[]
): {
  source: ResearchSource | null;
  formulas: ResearchFormula[];
  skippedFormulaCount: number;
  supportingSourceId: string;
} {
  const sourceId = sourceIdForWorkspace(workspaceId);
  const existingSource = findReferenceSource(existingSources, sourceId);
  const supportingSourceId = existingSource?.id ?? sourceId;
  const existingFormulaKeys = new Set(
    existingFormulas.flatMap((formula) => [
      formula.id,
      formula.title.trim().toLowerCase(),
    ])
  );

  const formulas = FORMULA_STARTERS.flatMap((starter) => {
    const id = formulaIdForWorkspace(workspaceId, starter.key);
    if (
      existingFormulaKeys.has(id) ||
      existingFormulaKeys.has(starter.title.toLowerCase())
    ) {
      return [];
    }

    return [
      createBlankResearchFormula(workspaceId, {
        id,
        title: starter.title,
        category: starter.category,
        status: 'Needs Review',
        formulaText: starter.formulaText,
        explanation: starter.explanation,
        variables: starter.variables,
        example: starter.example,
        engineReference: starter.engineReference,
        sourceIds: [supportingSourceId],
        notes:
          `Starter card scaffolded from ${starter.referenceSection}. Confirm company convention before treating it as final.`,
      }),
    ];
  });

  return {
    source: existingSource
      ? null
      : createBlankResearchSource(workspaceId, {
          id: sourceId,
          title: LANDMAN_REFERENCE_TITLE,
          sourceType: 'Manual',
          context: 'Texas',
          status: 'Needs Review',
          citation: LANDMAN_REFERENCE_CITATION,
          notes:
            'Reviewer-facing Texas baseline math reference. These cards document current LANDroid behavior and do not activate federal/private math.',
        }),
    formulas,
    skippedFormulaCount: FORMULA_STARTERS.length - formulas.length,
    supportingSourceId,
  };
}
