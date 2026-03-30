import {
  RRC_DATASETS_PAGE_URL,
  type RrcDatasetCatalogItem,
} from '../types/research';

export const RRC_DATASET_CATALOG: RrcDatasetCatalogItem[] = [
  {
    id: 'digital-map-data',
    title: 'Digital Map Data / API Data',
    category: 'GIS / Mapping',
    cadence: 'Current downloads',
    formats: ['ASCII', 'Shapefile/DBF'],
    decoderStatus: 'Structured Later',
    summary:
      'Base map, wells, surveys, pipelines, and associated API data for GIS workflows.',
    notes:
      'Official page notes that users are responsible for choosing an export format compatible with their GIS software. Shapefiles include a projection file.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'drilling-permit-master',
    title: 'Drilling Permit Master',
    category: 'Well / Permit',
    cadence: 'Monthly',
    formats: ['ASCII'],
    decoderStatus: 'Preview Ready',
    summary:
      'Permit information on drilling applications since 1976, including permit dates, lease names, and spacing/density exceptions.',
    notes:
      'LANDroid now decodes the core fixed-width status and permit records, with richer coordinate context available from the lat/long variants.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'drilling-permit-master-trailer',
    title: 'Drilling Permit Master and Trailer',
    category: 'Well / Permit',
    cadence: 'Monthly / Daily variants',
    formats: ['ASCII'],
    decoderStatus: 'Preview Ready',
    summary:
      'Expanded drilling permit data, including monthly and daily files with latitude/longitude variants.',
    notes:
      'LANDroid now decodes the core fixed-width permit records and joins in surface/bottom-hole coordinates when the lat/long records are present.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'drilling-permits-pending',
    title: 'Drilling Permits Pending Approval',
    category: 'Well / Permit',
    cadence: 'Current downloads',
    formats: ['ASCII'],
    decoderStatus: 'Preview Ready',
    summary:
      'Pending drilling applications that have not yet been approved by the RRC.',
    notes:
      'LANDroid now joins the core permit, wellbore, and lat/long text files for this family.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'w1-imaged-files',
    title: 'Drilling Permit (W-1) Imaged Files',
    category: 'Well / Permit',
    cadence: 'Daily',
    formats: ['ZIP', 'PDF', 'Image/TIFF'],
    decoderStatus: 'Preview Ready',
    summary:
      'Zipped W-1 permit images and plats by district, with PDFs for forms and TIFFs for plats.',
    notes:
      'This is highly demo-friendly because the files are visual even before deeper parsing exists.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'horizontal-drilling-permits',
    title: 'Horizontal Drilling Permits',
    category: 'Well / Permit',
    cadence: 'Current downloads',
    formats: ['ASCII'],
    decoderStatus: 'Preview Ready',
    summary:
      'Horizontal well permit sequences including permit number, API number, and permitted fields.',
    notes:
      'LANDroid now decodes the fixed-width row layout into a readable permit preview.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'full-wellbore',
    title: 'Full Wellbore',
    category: 'Well / Permit',
    cadence: 'Weekly',
    formats: ['ASCII', 'EBCDIC'],
    decoderStatus: 'Needs Decoder',
    summary:
      'Broad wellbore dataset updated weekly and positioned by the RRC as the replacement for older three-month wellbore data.',
    notes:
      'A strong long-term target, but the fixed-width legacy formats need decoder work.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'wellbore-query-data',
    title: 'Wellbore Query Data',
    category: 'Well / Permit',
    cadence: 'Monthly',
    formats: ['ASCII'],
    decoderStatus: 'Structured Later',
    summary:
      'Monthly wellbore query export intended for research and well-level lookup workflows.',
    notes:
      'Useful bridge dataset when full EBCDIC decoding is not yet available.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'completion-information',
    title: 'Completion Information in Data Format',
    category: 'Well / Permit',
    cadence: 'Nightly',
    formats: ['ASCII'],
    decoderStatus: 'Structured Later',
    summary:
      'Nightly completion information in data format.',
    notes:
      'Pairs naturally with the imaged completion file family.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'imaged-completion-files',
    title: 'Imaged Completion Files',
    category: 'Well / Permit',
    cadence: 'Nightly',
    formats: ['PDF'],
    decoderStatus: 'Preview Ready',
    summary:
      'Nightly imaged completion files that can already be stored and reviewed visually.',
    notes:
      'A strong early win for the Research tab because the documents are readable without a custom decoder.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'directional-survey-applications',
    title: 'Directional Survey Applications',
    category: 'Well / Permit',
    cadence: 'Nightly',
    formats: ['PDF'],
    decoderStatus: 'Preview Ready',
    summary:
      'Nightly PDF survey applications suitable for direct document review and attachment.',
    notes:
      'These can support map and permit storytelling immediately.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'production-data-query-dump',
    title: 'Production Data Query Dump',
    category: 'Production',
    cadence: 'Monthly',
    formats: ['CSV'],
    decoderStatus: 'Preview Ready',
    summary:
      'CSV production query dump published on the last Saturday of each month.',
    notes:
      'One of the best first structured RRC imports because CSV is easy to preview and parse later.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'production-report-pending-leases',
    title: 'Production Report for Pending Leases',
    category: 'Production',
    cadence: 'Monthly',
    formats: ['CSV'],
    decoderStatus: 'Preview Ready',
    summary:
      'Monthly CSV production report for pending leases.',
    notes:
      'Could become a useful follow-up queue once linked back to tracts or owners.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'statewide-production-oil',
    title: 'Statewide Production Data Oil',
    category: 'Production',
    cadence: 'Monthly',
    formats: ['EBCDIC'],
    decoderStatus: 'Needs Decoder',
    summary:
      'Statewide oil production data published in legacy EBCDIC format.',
    notes:
      'Great eventual target, but the immediate win is storing the raw file plus its PDF manual.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'statewide-production-gas',
    title: 'Statewide Production Data Gas',
    category: 'Production',
    cadence: 'Monthly',
    formats: ['EBCDIC'],
    decoderStatus: 'Needs Decoder',
    summary:
      'Statewide gas production data published in legacy EBCDIC format.',
    notes:
      'Same decode challenge as statewide oil production data.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'oil-ledger-districts',
    title: 'Oil Ledger Districts 1-10',
    category: 'Production',
    cadence: 'Monthly',
    formats: ['EBCDIC'],
    decoderStatus: 'Needs Decoder',
    summary:
      'District-based oil ledger files published in legacy EBCDIC format.',
    notes:
      'Treat this as a dataset family for now; individual district files can still be imported into LANDroid.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'pr-gas-disposition',
    title: 'PR (P1/P2) Gas Disposition',
    category: 'Production',
    cadence: 'Monthly',
    formats: ['ASCII', 'EBCDIC'],
    decoderStatus: 'Structured Later',
    summary:
      'Monthly gas disposition data extracted from Form PR production reporting.',
    notes:
      'The ASCII version is a better early target than the EBCDIC version.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'p18-skim-report',
    title: 'P-18 Skim Oil/Condensate Report',
    category: 'Production',
    cadence: 'Monthly',
    formats: ['JSON'],
    decoderStatus: 'Preview Ready',
    summary:
      'JSON report with location, operation, storage/run, and allocation information from Form P-18.',
    notes:
      'This is one of the cleanest modern RRC datasets for later structured import work.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'p4-database',
    title: 'Certificate of Authorization P-4 Database',
    category: 'Organization / Operator',
    cadence: 'Monthly',
    formats: ['EBCDIC'],
    decoderStatus: 'Needs Decoder',
    summary:
      'Operator authorization data for oil and gas organizations.',
    notes:
      'Potentially powerful for operator/entity research once decoded.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'p5-organization',
    title: 'P-5 Organization',
    category: 'Organization / Operator',
    cadence: 'Monthly',
    formats: ['ASCII', 'EBCDIC'],
    decoderStatus: 'Structured Later',
    summary:
      'Organization-level P-5 data available in both ASCII and EBCDIC families.',
    notes:
      'The ASCII version is the practical first target.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'oil-gas-docket',
    title: 'Oil and Gas Docket',
    category: 'Field / Regulatory',
    cadence: 'Monthly',
    formats: ['ASCII'],
    decoderStatus: 'Structured Later',
    summary:
      'Monthly oil and gas docket data for regulatory workflows.',
    notes:
      'Could later support hearing/deadline style research views.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'rrc-oil-ice',
    title: 'RRC Oil / ICE Data',
    category: 'Field / Regulatory',
    cadence: 'Weekly',
    formats: ['TXT'],
    decoderStatus: 'Preview Ready',
    summary:
      'Weekly TXT-format RRC oil / ICE data.',
    notes:
      'Easy to store and preview now, then parse later if it proves valuable.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'r3-gas-processing-plants',
    title: 'R3 Gas Processing Plants',
    category: 'Field / Regulatory',
    cadence: 'Monthly',
    formats: ['JSON', 'EBCDIC'],
    decoderStatus: 'Preview Ready',
    summary:
      'Gas processing plant data now available in JSON, with an older retired EBCDIC version also noted by the RRC.',
    notes:
      'Prefer the newer JSON version.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'statewide-field-data',
    title: 'Statewide Field Data',
    category: 'Field / Regulatory',
    cadence: 'Current downloads',
    formats: ['ASCII'],
    decoderStatus: 'Structured Later',
    summary:
      'Comprehensive field data including rules, remarks, allocation formulas, and production/allowable statistics.',
    notes:
      'A big future data source once record layouts are understood.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'field-name-numbers',
    title: 'Oil & Gas Field Name & Numbers',
    category: 'Field / Regulatory',
    cadence: 'Current downloads',
    formats: ['ASCII'],
    decoderStatus: 'Structured Later',
    summary:
      'Condensed field records including district, field number, county code, and field name.',
    notes:
      'A likely lookup-table import once ASCII parsing is added.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'annual-report-field-table',
    title: 'Oil or Gas Annual Report Field Table',
    category: 'Field / Regulatory',
    cadence: 'Current downloads',
    formats: ['ASCII'],
    decoderStatus: 'Structured Later',
    summary:
      'Field-level annual report information including production and well counts.',
    notes:
      'Pairs well with field name/number lookups.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'gas-masters',
    title: 'Gas Masters',
    category: 'Production',
    cadence: 'Current downloads',
    formats: ['ASCII'],
    decoderStatus: 'Structured Later',
    summary:
      'Gas masters data including recent production, allowable data, field formulas, gatherers, balancing status, and well information.',
    notes:
      'High-value eventually, but likely a larger parser project.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'oil-masters',
    title: 'Oil Masters',
    category: 'Production',
    cadence: 'Current downloads',
    formats: ['ASCII'],
    decoderStatus: 'Structured Later',
    summary:
      'Oil masters data including recent production, allowable data, lease info, gatherers, balancing, and well information.',
    notes:
      'Strong long-term target once field/lease crosswalks are in place.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'statewide-oil-well-database',
    title: 'Statewide Oil Well Database',
    category: 'Well / Permit',
    cadence: 'Monthly',
    formats: ['EBCDIC'],
    decoderStatus: 'Needs Decoder',
    summary:
      'Monthly statewide oil well database published in EBCDIC format.',
    notes:
      'Treat as raw-import capable now and decoder work later.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'statewide-gas-well-database',
    title: 'Statewide Gas Well Database',
    category: 'Well / Permit',
    cadence: 'Monthly',
    formats: ['EBCDIC'],
    decoderStatus: 'Needs Decoder',
    summary:
      'Monthly statewide gas well database published in EBCDIC format.',
    notes:
      'Same strategy as statewide oil well data.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'oil-detail-well',
    title: 'Oil Detail Well',
    category: 'Well / Permit',
    cadence: 'Monthly',
    formats: ['EBCDIC'],
    decoderStatus: 'Needs Decoder',
    summary:
      'Monthly oil detail well data in EBCDIC format.',
    notes:
      'Likely useful for deeper well-level analysis once decoded.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'oil-well-status',
    title: 'Oil Well Status (26 Month W-10)',
    category: 'Well / Permit',
    cadence: 'Monthly',
    formats: ['EBCDIC'],
    decoderStatus: 'Needs Decoder',
    summary:
      'Oil well status history in monthly EBCDIC format.',
    notes:
      'Consider raw archival import now, structured decoding later.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'gas-well-status',
    title: 'Gas Well Status (26 Month G-10)',
    category: 'Well / Permit',
    cadence: 'Monthly',
    formats: ['EBCDIC'],
    decoderStatus: 'Needs Decoder',
    summary:
      'Gas well status history in monthly EBCDIC format.',
    notes:
      'Same decode challenge as the oil well status family.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'high-cost-gas',
    title: 'High Cost Gas / Tight Sands / NGPA',
    category: 'Tax / Incentive',
    cadence: 'Monthly',
    formats: ['ASCII'],
    decoderStatus: 'Structured Later',
    summary:
      'Severance tax incentive families including High Cost Gas, Tight Sands Only, and Natural Gas Policy Act data.',
    notes:
      'Grouped as one family for now because the import flow is similar.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'st1-application-report',
    title: 'ST-1 Application Report',
    category: 'Tax / Incentive',
    cadence: 'Monthly',
    formats: ['CSV'],
    decoderStatus: 'Preview Ready',
    summary:
      'Monthly CSV application report in the severance tax incentive family.',
    notes:
      'One of the easiest tax-related datasets to support early.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
  {
    id: 'uic-database',
    title: 'UIC Database',
    category: 'Field / Regulatory',
    cadence: 'Monthly',
    formats: ['ASCII', 'EBCDIC'],
    decoderStatus: 'Structured Later',
    summary:
      'Underground Injection Control database with both ASCII and EBCDIC versions.',
    notes:
      'The ASCII version is the practical first target.',
    officialUrl: RRC_DATASETS_PAGE_URL,
  },
];
