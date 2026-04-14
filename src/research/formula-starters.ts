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
