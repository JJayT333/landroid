/**
 * Seed test data — creates a realistic mineral title chain with PDF attachments.
 *
 * Builds ~18 nodes representing a Texas mineral title:
 *   Patent → Warranty Deeds → Mineral Deeds → Oil & Gas Leases
 *   with related docs (Death Certificates, Probate, Affidavits)
 *
 * Fetches PDFs from TORS_Documents/ (served by Vite dev server)
 * and stores them in IndexedDB alongside the workspace data.
 */
import { useWorkspaceStore } from '../store/workspace-store';
import { savePdf } from './pdf-store';
import type { DeskMap, OwnershipNode } from '../types/node';
import { createBlankNode } from '../types/node';

// ── Node factory ────────────────────────────────────────

let nodeCounter = 0;
function nodeId(): string {
  return `seed-${++nodeCounter}`;
}

function makeNode(
  id: string,
  parentId: string | null,
  overrides: Partial<OwnershipNode>,
): OwnershipNode {
  return {
    ...createBlankNode(id, parentId),
    ...overrides,
  };
}

// ── PDF attachment mapping ──────────────────────────────
// Maps nodeId → filename in TORS_Documents/
// We'll attach a handful of PDFs to specific nodes.

interface PdfMapping {
  nodeId: string;
  fileName: string;
}

// ── Build the title chain ───────────────────────────────

function buildTestNodes(): { nodes: OwnershipNode[]; pdfMappings: PdfMapping[] } {
  nodeCounter = 0;
  const nodes: OwnershipNode[] = [];
  const pdfMappings: PdfMapping[] = [];

  const landDesc = 'Section 12, Block A, T&P RR Co. Survey, Elmore County, Texas';

  // ─── ROOT: State Patent ───────────────────────────────
  const patent = nodeId();
  nodes.push(makeNode(patent, null, {
    instrument: 'Patent',
    date: '1905-03-15',
    fileDate: '1905-04-01',
    grantor: 'State of Texas',
    grantee: 'James T. Elmore',
    landDesc,
    initialFraction: '1.000000000',
    fraction: '0.000000000', // fully conveyed away
    vol: '1',
    page: '234',
    remarks: 'Original patent — all minerals and surface',
  }));

  // ─── GEN 1: James Elmore conveys to 3 children ───────
  const wd1 = nodeId(); // to Mary Elmore — 1/2
  nodes.push(makeNode(wd1, patent, {
    instrument: 'Warranty Deed',
    date: '1942-06-10',
    fileDate: '1942-06-15',
    grantor: 'James T. Elmore',
    grantee: 'Mary Elmore Harman',
    landDesc,
    initialFraction: '0.500000000',
    fraction: '0.250000000', // conveyed half away
    vol: '45',
    page: '112',
    docNo: '09-2054',
    conveyanceMode: 'fraction',
    splitBasis: 'initial',
    numerator: '1',
    denominator: '2',
  }));
  pdfMappings.push({ nodeId: wd1, fileName: '09-2054.pdf' });

  const wd2 = nodeId(); // to Robert Elmore — 1/4
  nodes.push(makeNode(wd2, patent, {
    instrument: 'Warranty Deed',
    date: '1942-06-10',
    fileDate: '1942-06-15',
    grantor: 'James T. Elmore',
    grantee: 'Robert C. Elmore',
    landDesc,
    initialFraction: '0.250000000',
    fraction: '0.250000000',
    vol: '45',
    page: '118',
    docNo: '09-3821',
    conveyanceMode: 'fraction',
    splitBasis: 'initial',
    numerator: '1',
    denominator: '4',
  }));
  pdfMappings.push({ nodeId: wd2, fileName: '09-3821.pdf' });

  const wd3 = nodeId(); // to William Elmore — 1/4
  nodes.push(makeNode(wd3, patent, {
    instrument: 'Warranty Deed',
    date: '1942-06-10',
    fileDate: '1942-06-15',
    grantor: 'James T. Elmore',
    grantee: 'William D. Elmore',
    landDesc,
    initialFraction: '0.250000000',
    fraction: '0.000000000', // fully conveyed
    vol: '45',
    page: '124',
    docNo: '09-3941',
  }));
  pdfMappings.push({ nodeId: wd3, fileName: '09-3941.pdf' });

  // ─── GEN 2: Mary Harman conveys 1/2 of her interest ──
  const md1 = nodeId(); // Mary → Claude Harman (mineral deed, 1/2 of 1/2 = 1/4)
  nodes.push(makeNode(md1, wd1, {
    instrument: 'Mineral Deed',
    date: '1968-09-22',
    fileDate: '1968-10-01',
    grantor: 'Mary Elmore Harman',
    grantee: 'Claude A. Harman',
    landDesc,
    initialFraction: '0.250000000',
    fraction: '0.125000000', // conveyed half away
    docNo: '09-4291',
    conveyanceMode: 'fraction',
    splitBasis: 'initial',
    numerator: '1',
    denominator: '2',
  }));
  pdfMappings.push({ nodeId: md1, fileName: '09-4291.pdf' });

  // ─── GEN 2: William fully conveys to two buyers ──────
  const wd4 = nodeId(); // William → Donald Harman — 1/8
  nodes.push(makeNode(wd4, wd3, {
    instrument: 'Warranty Deed',
    date: '1975-01-15',
    fileDate: '1975-01-20',
    grantor: 'William D. Elmore',
    grantee: 'Donald R. Harman',
    landDesc,
    initialFraction: '0.125000000',
    fraction: '0.125000000',
    docNo: '09-4769',
  }));
  pdfMappings.push({ nodeId: wd4, fileName: '09-4769.pdf' });

  const wd5 = nodeId(); // William → Kraft Family Trust — 1/8
  nodes.push(makeNode(wd5, wd3, {
    instrument: 'Warranty Deed',
    date: '1975-01-15',
    fileDate: '1975-01-20',
    grantor: 'William D. Elmore',
    grantee: 'Kraft Family Trust',
    landDesc,
    initialFraction: '0.125000000',
    fraction: '0.125000000',
    docNo: '09-4770',
  }));
  pdfMappings.push({ nodeId: wd5, fileName: '09-4770.pdf' });

  // ─── GEN 3: Claude Harman conveys half his interest ───
  const md2 = nodeId(); // Claude → Broussard — 1/8
  nodes.push(makeNode(md2, md1, {
    instrument: 'Mineral Deed',
    date: '1985-04-11',
    fileDate: '1985-04-15',
    grantor: 'Claude A. Harman',
    grantee: 'Luc Broussard',
    landDesc,
    initialFraction: '0.125000000',
    fraction: '0.125000000',
    docNo: '10-2493',
  }));
  pdfMappings.push({ nodeId: md2, fileName: '10-2493.pdf' });

  // ─── RELATED DOC: Robert Elmore deceased ──────────────
  const dc1 = nodeId();
  nodes.push(makeNode(dc1, wd2, {
    type: 'related',
    instrument: 'Death Certificate',
    date: '1998-11-03',
    fileDate: '1999-01-12',
    grantor: '',
    grantee: 'Robert C. Elmore',
    remarks: 'Died intestate. Survived by two children: Patricia Elmore Powell and Steven Elmore.',
    initialFraction: '0',
    fraction: '0',
    docNo: '2012006700',
  }));
  pdfMappings.push({ nodeId: dc1, fileName: '2012006700.pdf' });

  // Mark Robert as deceased on his node
  nodes.find(n => n.id === wd2)!.isDeceased = true;
  nodes.find(n => n.id === wd2)!.obituary = 'Died 11/03/1998, Elmore County, TX';

  // ─── GEN 2b: Robert's heirs via Probate ──────────────
  const prob = nodeId(); // Probate → splits Robert's 1/4 between 2 heirs
  nodes.push(makeNode(prob, wd2, {
    instrument: 'Probate',
    date: '1999-03-15',
    fileDate: '1999-04-01',
    grantor: 'Estate of Robert C. Elmore',
    grantee: 'Patricia Elmore Powell',
    landDesc,
    initialFraction: '0.125000000',
    fraction: '0.125000000',
    docNo: '2012006703',
    remarks: 'Cause No. P-1999-042',
  }));
  pdfMappings.push({ nodeId: prob, fileName: '2012006703.pdf' });

  const prob2 = nodeId();
  nodes.push(makeNode(prob2, wd2, {
    instrument: 'Probate',
    date: '1999-03-15',
    fileDate: '1999-04-01',
    grantor: 'Estate of Robert C. Elmore',
    grantee: 'Steven R. Elmore',
    landDesc,
    initialFraction: '0.125000000',
    fraction: '0.000000000', // Steven conveys everything
    docNo: '2012006704',
  }));
  pdfMappings.push({ nodeId: prob2, fileName: '2012006704.pdf' });

  // ─── GEN 3: Steven conveys all to an LLC ──────────────
  const md3 = nodeId();
  nodes.push(makeNode(md3, prob2, {
    instrument: 'Mineral Deed',
    date: '2013-02-28',
    fileDate: '2013-03-05',
    grantor: 'Steven R. Elmore',
    grantee: 'Elmore Family Partners, LLC',
    landDesc,
    initialFraction: '0.125000000',
    fraction: '0.125000000',
    docNo: '2013000065',
  }));
  pdfMappings.push({ nodeId: md3, fileName: '2013000065.pdf' });

  // ─── OIL & GAS LEASES ────────────────────────────────
  const lease1 = nodeId(); // Patricia leases
  nodes.push(makeNode(lease1, prob, {
    instrument: 'Oil & Gas Lease',
    date: '2020-06-01',
    fileDate: '2020-06-15',
    grantor: 'Patricia Elmore Powell',
    grantee: 'Permian Basin Operating, LLC',
    landDesc,
    initialFraction: '0.125000000',
    fraction: '0.125000000',
    docNo: '20200790',
    remarks: '3-year primary term, 1/4 royalty',
  }));
  pdfMappings.push({ nodeId: lease1, fileName: '20200790.pdf' });

  const lease2 = nodeId(); // Elmore Family Partners leases
  nodes.push(makeNode(lease2, md3, {
    instrument: 'Oil & Gas Lease',
    date: '2021-01-15',
    fileDate: '2021-02-01',
    grantor: 'Elmore Family Partners, LLC',
    grantee: 'Permian Basin Operating, LLC',
    landDesc,
    initialFraction: '0.125000000',
    fraction: '0.125000000',
    docNo: '20210747',
    remarks: '3-year primary term, 1/4 royalty',
  }));
  pdfMappings.push({ nodeId: lease2, fileName: '20210747.pdf' });

  // ─── RELATED: Affidavit of Heirship ───────────────────
  const aoh = nodeId();
  nodes.push(makeNode(aoh, wd2, {
    type: 'related',
    instrument: 'Affidavit of Heirship',
    date: '1999-02-10',
    fileDate: '1999-02-15',
    grantor: '',
    grantee: '',
    remarks: 'Establishes Patricia Powell and Steven Elmore as sole heirs of Robert C. Elmore.',
    initialFraction: '0',
    fraction: '0',
    docNo: '2013000191',
  }));
  pdfMappings.push({ nodeId: aoh, fileName: '2013000191.pdf' });

  // ─── RELATED: Surface agreement ───────────────────────
  const surfAgmt = nodeId();
  nodes.push(makeNode(surfAgmt, lease2, {
    type: 'related',
    instrument: 'Assignment',
    date: '2021-03-01',
    fileDate: '2021-03-10',
    grantor: '',
    grantee: '',
    remarks: 'Surface use agreement for well pad location — Quellhorst tract.',
    initialFraction: '0',
    fraction: '0',
    docNo: 'SurfAgmt',
  }));
  pdfMappings.push({ nodeId: surfAgmt, fileName: 'SurfAgmt_Quellhorst.pdf' });

  return { nodes, pdfMappings };
}

// ── Fetch a PDF from the dev server and store in IDB ────

async function attachPdf(nodeId: string, fileName: string): Promise<boolean> {
  try {
    const resp = await fetch(`/TORS_Documents/${fileName}`);
    if (!resp.ok) {
      console.warn(`[seed] Could not fetch ${fileName}: ${resp.status}`);
      return false;
    }
    const blob = await resp.blob();
    const file = new File([blob], fileName, { type: 'application/pdf' });
    await savePdf(nodeId, file);
    return true;
  } catch (err) {
    console.warn(`[seed] Failed to attach ${fileName}:`, err);
    return false;
  }
}

// ── Main entry point ────────────────────────────────────

export async function seedTestData(): Promise<{ nodeCount: number; pdfCount: number }> {
  const { nodes, pdfMappings } = buildTestNodes();

  // Mark nodes that will have PDFs
  for (const mapping of pdfMappings) {
    const node = nodes.find((n) => n.id === mapping.nodeId);
    if (node) node.hasDoc = true;
  }

  // Create desk map
  const dmId = `dm-seed-${Date.now()}`;
  const deskMap = {
    id: dmId,
    name: 'Elmore — Sec. 12, Blk A',
    code: 'SEC12',
    tractId: null,
    nodeIds: nodes.map((n) => n.id),
  };

  // Load into store
  useWorkspaceStore.getState().loadWorkspace({
    projectName: 'Elmore Title Examination',
    nodes,
    deskMaps: [deskMap],
    activeDeskMapId: dmId,
    instrumentTypes: [
      'Patent', 'Warranty Deed', 'Mineral Deed', 'Royalty Deed',
      'Oil & Gas Lease', 'Assignment', 'Probate', 'Affidavit of Heirship',
      'Death Certificate', 'Quitclaim Deed', 'Correction Deed', 'Release',
      'Will', 'Order',
    ],
  });

  // Attach PDFs
  let pdfCount = 0;
  for (const mapping of pdfMappings) {
    const ok = await attachPdf(mapping.nodeId, mapping.fileName);
    if (ok) pdfCount++;
  }

  // If any PDFs failed, update hasDoc flags
  if (pdfCount < pdfMappings.length) {
    const state = useWorkspaceStore.getState();
    for (const mapping of pdfMappings) {
      const node = state.nodes.find((n) => n.id === mapping.nodeId);
      if (node?.hasDoc) {
        // Verify the PDF was actually stored
        try {
          const resp = await fetch(`/TORS_Documents/${mapping.fileName}`, { method: 'HEAD' });
          if (!resp.ok) {
            useWorkspaceStore.getState().updateNode(mapping.nodeId, { hasDoc: false });
          }
        } catch {
          useWorkspaceStore.getState().updateNode(mapping.nodeId, { hasDoc: false });
        }
      }
    }
  }

  return { nodeCount: nodes.length, pdfCount };
}

// ═══════════════════════════════════════════════════════════
// Stress Test — ~200 nodes across 4 title chains
// ═══════════════════════════════════════════════════════════

const STRESS_PDFS = [
  '09-4292.pdf', '09-6968.pdf', '10-5146.pdf', '10-5147.pdf', '10-6043.pdf',
  '10-6044.pdf', '11-2474.pdf', '11-3054.pdf', '11-4768.pdf', '11-769.pdf',
  '20-519-CP4.pdf', '2013000463.pdf', '2013003629.pdf', '2014001940.pdf',
  '2014001941.pdf', '2014001942.pdf', '2014001943.pdf', '2014006917.pdf',
  '2014007129.pdf', '20150085.pdf', '20151095.pdf', '20156044.pdf',
  '20156045.pdf', '20162866.pdf', '20165198.pdf', '20171744.pdf',
  '20171745.pdf', '20171747.pdf', '20171749.pdf', '20172084.pdf',
  '20172674.pdf', '20172985.pdf', '20172986.pdf', '20174126.pdf',
  '20175815.pdf', '20176399.pdf', '20176874.pdf', '2018-CPC-00366.pdf',
  '20182352.pdf', '20185813.pdf', '20191765.pdf', '20193388.pdf',
  '20193637.pdf', '20194106.pdf', '20195281.pdf', '20195601.pdf',
  '20201299.pdf', '20201300.pdf', '20205047.pdf', '20207109.pdf',
  '20207968.pdf', '20212728.pdf', '20212816.pdf', '20212817.pdf',
  '20212918.pdf', '20214839.pdf', '20214840.pdf', '20216238.pdf',
  '20216239.pdf', '20216241.pdf', '20216713.pdf', '20216714.pdf',
  '20216715.pdf', '20216717.pdf', '20216762.pdf', '20216955.pdf',
  '20217983.pdf', '20219038.pdf', '20219040.pdf', '20220170.pdf',
  '20220171.pdf', '20220813.pdf', '20222292.pdf', '20222293.pdf',
  '20222294.pdf', '20222552.pdf', '20222653.pdf', '20222654.pdf',
  '20222685.pdf', '20222686.pdf', '20222781.pdf', '20222782.pdf',
  '20223159.pdf', '20223160.pdf', '20223281.pdf', '20226398.pdf',
  '20226399.pdf', '20226400.pdf', '20226422.pdf', '20226530.pdf',
  '20226564.pdf', '20230583.pdf', '20230584.pdf', '20230767.pdf',
  '20232936.pdf', '20234541.pdf', '20235164.pdf', '20236699.pdf',
  '20237192.pdf', '20240688.pdf', '20241988.pdf', '20242142.pdf',
  '20242292.pdf', '20242574.pdf', '20242846.pdf', '20246345.pdf',
  '20246347.pdf', '20246554.pdf', '20253156.pdf', '20253157.pdf',
  '20254367.pdf', '20255422.pdf', '20255881.pdf', '2195281.pdf',
  '24CPR0065_Probate.pdf', 'DOTO_ElmoreC-1_Unit.pdf', 'OGML_Broussard.pdf',
  'OGML_Deloach.pdf', 'OGML_Drapak.pdf', 'OGML_Edwards.pdf', 'OGML_Few.pdf',
  'OGML_Harman_Claude.pdf', 'OGML_Harman_Donald.pdf', 'OGML_Kraft.pdf',
  'OGML_Mayo-Henson.pdf', 'OGML_McClanahan.pdf', 'OGML_McRorie.pdf',
  'OGML_Powell.pdf', 'OGML_Tinabeth_Keasling.pdf', 'OGML_Trapp_Downey.pdf',
  'OGML_Trapp_Robt.pdf', 'OGML-ElmoreFamilyPartners.pdf', 'OGML-LCT-Trust.pdf',
  'OGML-Tyra_R.pdf', 'P2018-68.pdf', 'P2025-4.pdf',
];

const STRESS_INSTRUMENT_TYPES = [
  'Patent', 'Warranty Deed', 'Mineral Deed', 'Royalty Deed',
  'Oil & Gas Lease', 'Assignment', 'Probate', 'Affidavit of Heirship',
  'Death Certificate', 'Quitclaim Deed', 'Correction Deed', 'Release',
  'Will', 'Order',
];

const FIRST = [
  'James', 'Mary', 'Robert', 'Patricia', 'William', 'Elizabeth', 'John', 'Linda',
  'Thomas', 'Barbara', 'Charles', 'Susan', 'Daniel', 'Margaret', 'Michael', 'Dorothy',
  'Richard', 'Ruth', 'Joseph', 'Betty', 'George', 'Helen', 'Kenneth', 'Sandra',
  'Edward', 'Virginia', 'Frank', 'Katherine', 'Harold', 'Lucille',
  'Walter', 'Alice', 'Henry', 'Florence', 'Arthur', 'Ethel',
];

const DEEDS = ['Warranty Deed', 'Mineral Deed', 'Royalty Deed', 'Quitclaim Deed', 'Assignment'];

const OPERATORS = [
  'Permian Basin Operating, LLC',
  'West Texas Energy Corp.',
  'Desert Drilling Partners',
  'Lone Star Resources, LLC',
  'Eagle Ford Production Co.',
];

interface StressConfig {
  name: string;
  code: string;
  targetCardCount: number;
  landDesc: string;
  surnames: string[];
  patentYear: number;
  patentGrantee: string;
  maxDepth: number;
  rootSplit: 2 | 3;
}

const STRESS_CHAINS: StressConfig[] = [
  {
    name: 'Tract 1',
    code: 'T1',
    targetCardCount: 100,
    landDesc: 'Section 14, Block B, T&P RR Co. Survey, Henderson County, Texas',
    surnames: ['Henderson', 'Shaw', 'Pearson', 'Whitfield', 'Langley', 'Underwood', 'Calloway', 'Ashworth'],
    patentYear: 1895,
    patentGrantee: 'Thomas J. Henderson',
    maxDepth: 5,
    rootSplit: 2,
  },
  {
    name: 'Tract 2',
    code: 'T2',
    targetCardCount: 150,
    landDesc: 'Section 20, Block C, H&TC RR Co. Survey, Crockett County, Texas',
    surnames: ['Morales', 'Garza', 'Vega', 'Salazar', 'Fuentes', 'Cardenas', 'Delgado', 'Rios'],
    patentYear: 1901,
    patentGrantee: 'Alejandro Morales',
    maxDepth: 5,
    rootSplit: 3,
  },
  {
    name: 'Tract 3',
    code: 'T3',
    targetCardCount: 200,
    landDesc: 'Section 8, Block A, SP RR Co. Survey, Pecos County, Texas',
    surnames: ['Thompson', 'Mitchell', 'Crawford', 'Barnett', 'Hayes', 'Coleman', 'Weaver', 'Foster'],
    patentYear: 1898,
    patentGrantee: 'Samuel W. Thompson',
    maxDepth: 6,
    rootSplit: 2,
  },
];

// ── Stress builder ───────────────────────────────────────

class StressBuilder {
  nodes: OwnershipNode[] = [];
  pdfMappings: PdfMapping[] = [];
  private remaining = new Map<string, number>();
  private seq = 0;
  private pdfIdx = 0;
  private docSeq = 10000;

  nextId(): string { return `stress-${++this.seq}`; }
  nextDocNo(): string { return `ST-${++this.docSeq}`; }

  assignPdf(nodeId: string): void {
    if (this.pdfIdx >= STRESS_PDFS.length) return;
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.hasDoc = true;
      this.pdfMappings.push({ nodeId, fileName: STRESS_PDFS[this.pdfIdx++] });
    }
  }

  addRoot(landDesc: string, grantee: string, year: number): string {
    const id = this.nextId();
    this.nodes.push({
      ...createBlankNode(id, null),
      instrument: 'Patent',
      date: `${year}-03-15`,
      fileDate: `${year}-04-01`,
      grantor: 'State of Texas',
      grantee,
      landDesc,
      initialFraction: '1.000000000',
      fraction: '1.000000000',
      docNo: this.nextDocNo(),
      remarks: 'Original patent — all minerals and surface',
    });
    this.remaining.set(id, 1.0);
    this.assignPdf(id);
    return id;
  }

  addChild(parentId: string, share: number, overrides: Partial<OwnershipNode>): string {
    const id = this.nextId();
    const parent = this.nodes.find((n) => n.id === parentId)!;

    // Deduct from parent's remaining fraction
    const rem = (this.remaining.get(parentId) ?? 0) - share;
    this.remaining.set(parentId, rem);
    parent.fraction = Math.max(0, rem).toFixed(9);

    this.nodes.push({
      ...createBlankNode(id, parentId),
      landDesc: parent.landDesc,
      initialFraction: share.toFixed(9),
      fraction: share.toFixed(9),
      docNo: this.nextDocNo(),
      ...overrides,
    });
    this.remaining.set(id, share);
    return id;
  }

  addRelated(parentId: string, overrides: Partial<OwnershipNode>): string {
    const id = this.nextId();
    const parent = this.nodes.find((n) => n.id === parentId)!;
    this.nodes.push({
      ...createBlankNode(id, parentId),
      type: 'related',
      landDesc: parent.landDesc,
      initialFraction: '0',
      fraction: '0',
      docNo: this.nextDocNo(),
      ...overrides,
    });
    return id;
  }

  markDeceased(nodeId: string, obituary: string): void {
    const node = this.nodes.find((n) => n.id === nodeId)!;
    node.isDeceased = true;
    node.obituary = obituary;
  }
}

// ── Recursive tree expansion ─────────────────────────────

function expandStressBranch(
  b: StressBuilder,
  parentId: string,
  parentFrac: number,
  depth: number,
  idx: number,
  config: StressConfig,
): void {
  if (depth <= 0 || parentFrac < 0.002) return;

  const parent = b.nodes.find((n) => n.id === parentId)!;

  // First level uses rootSplit (2 or 3), all deeper levels use 2
  const numChildren = depth === config.maxDepth ? config.rootSplit : 2;

  // Split parent's fraction among children (power-of-2 for clean math)
  const shares =
    numChildren === 3
      ? [parentFrac * 0.5, parentFrac * 0.25, parentFrac * 0.25]
      : [parentFrac * 0.5, parentFrac * 0.5];

  // Dates progress forward through generations
  const yearOffset = (config.maxDepth + 1 - depth) * 18;
  const year = config.patentYear + 25 + yearOffset;

  for (let i = 0; i < shares.length; i++) {
    const firstIdx = (idx * 5 + i * 3 + depth * 2) % FIRST.length;
    const surnameIdx = (idx * 2 + i + depth) % config.surnames.length;
    const grantee = `${FIRST[firstIdx]} ${config.surnames[surnameIdx]}`;
    const instrument = DEEDS[(idx + i + depth) % DEEDS.length];
    const month = ((i * 3 + depth * 2) % 12) + 1;
    const day = ((idx * 7 + i * 5 + 1) % 28) + 1;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const fileDateStr = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day + 5, 28)).padStart(2, '0')}`;

    // Conveyance math for UI: record the fraction-of-parent
    const fracOfParent = shares[i] / parentFrac;
    const denom = Math.round(1 / fracOfParent);

    const childId = b.addChild(parentId, shares[i], {
      instrument,
      date: dateStr,
      fileDate: fileDateStr,
      grantor: parent.grantee,
      grantee,
      conveyanceMode: 'fraction',
      splitBasis: 'initial',
      numerator: '1',
      denominator: String(denom),
    });

    // Attach PDF to ~70% of conveyance nodes
    if ((idx + i + depth) % 3 !== 0) b.assignPdf(childId);

    // Deceased + related docs at depth 3 on alternating branches
    if (depth === 3 && i === 0 && idx % 2 === 0) {
      b.markDeceased(childId, `Died ${year + 8}, ${config.landDesc.split(',').slice(-2, -1)[0]?.trim() || 'Texas'}`);
      const dcId = b.addRelated(childId, {
        instrument: 'Death Certificate',
        date: `${year + 8}-11-03`,
        fileDate: `${year + 8}-12-01`,
        grantee,
        remarks: `Died intestate. Survived by heirs.`,
      });
      b.assignPdf(dcId);
      const aohId = b.addRelated(childId, {
        instrument: 'Affidavit of Heirship',
        date: `${year + 9}-01-15`,
        fileDate: `${year + 9}-02-01`,
        remarks: `Establishes heirs of ${grantee}.`,
      });
      b.assignPdf(aohId);
    }

    // Leaf level: add oil & gas lease; otherwise recurse deeper
    if (depth === 1) {
      const leaseId = b.addChild(childId, shares[i], {
        instrument: 'Oil & Gas Lease',
        date: `${2018 + (idx % 6)}-${String(((i * 4 + 1) % 12) + 1).padStart(2, '0')}-01`,
        fileDate: `${2018 + (idx % 6)}-${String(((i * 4 + 1) % 12) + 1).padStart(2, '0')}-15`,
        grantor: grantee,
        grantee: OPERATORS[idx % OPERATORS.length],
        remarks: '3-year primary term, 1/4 royalty',
        conveyanceMode: 'all',
        splitBasis: 'initial',
        numerator: '1',
        denominator: '1',
      });
      if (idx % 2 === 0) b.assignPdf(leaseId);
    } else {
      expandStressBranch(b, childId, shares[i], depth - 1, idx * numChildren + i, config);
    }
  }
}

const EXTRA_STRESS_ASSIGNMENT_GRANTEES = [
  'Blue Mesa Energy, LLC',
  'High Plains Operating Co.',
  'Lariat Minerals, LP',
  'Cimarron Royalty Partners',
] as const;

function getTractNodes(nodes: OwnershipNode[], landDesc: string): OwnershipNode[] {
  return nodes.filter((node) => node.landDesc === landDesc);
}

function getTractCardNodes(nodes: OwnershipNode[], landDesc: string): OwnershipNode[] {
  return getTractNodes(nodes, landDesc).filter((node) => node.type !== 'related');
}

function addSupplementalStressCards(builder: StressBuilder, config: StressConfig): void {
  const existingCards = getTractCardNodes(builder.nodes, config.landDesc);
  const extraNeeded = config.targetCardCount - existingCards.length;
  if (extraNeeded < 0) {
    throw new Error(`Stress tract ${config.name} exceeded target card count of ${config.targetCardCount}`);
  }
  if (extraNeeded === 0) return;

  const tractNodeIds = new Set(existingCards.map((node) => node.id));
  const parentIds = new Set(
    builder.nodes
      .filter((node) => node.type !== 'related' && node.parentId && tractNodeIds.has(node.parentId))
      .map((node) => node.parentId as string)
  );
  const leafTargets = existingCards.filter((node) => !parentIds.has(node.id));

  if (leafTargets.length < extraNeeded) {
    throw new Error(`Stress tract ${config.name} does not have enough leaf cards to reach ${config.targetCardCount}`);
  }

  for (let index = 0; index < extraNeeded; index += 1) {
    const target = leafTargets[index];
    const share = Number(target.fraction || target.initialFraction || '0');
    if (!Number.isFinite(share) || share <= 0) {
      throw new Error(`Stress tract ${config.name} has invalid supplemental share on ${target.id}`);
    }

    const year = config.patentYear + 120 + index;
    const month = ((index * 3) % 12) + 1;
    const day = ((index * 5) % 28) + 1;
    const assignmentId = builder.addChild(target.id, share, {
      instrument: 'Assignment',
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      fileDate: `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day + 7, 28)).padStart(2, '0')}`,
      grantor: target.grantee,
      grantee: EXTRA_STRESS_ASSIGNMENT_GRANTEES[index % EXTRA_STRESS_ASSIGNMENT_GRANTEES.length],
      remarks: `Supplemental assignment added for ${config.name} desk map stress coverage.`,
      conveyanceMode: 'all',
      splitBasis: 'initial',
      numerator: '1',
      denominator: '1',
    });
    if (index % 2 === 0) builder.assignPdf(assignmentId);
  }
}

export function buildStressWorkspaceData(): {
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  activeDeskMapId: string | null;
  instrumentTypes: string[];
  pdfMappings: PdfMapping[];
} {
  const builder = new StressBuilder();

  // Build 3 independent tract-sized title chains
  for (const chain of STRESS_CHAINS) {
    const rootId = builder.addRoot(chain.landDesc, chain.patentGrantee, chain.patentYear);
    expandStressBranch(builder, rootId, 1.0, chain.maxDepth, 0, chain);
  }

  // Post-process: children of deceased nodes get Probate instrument
  for (const node of builder.nodes) {
    if (node.isDeceased) {
      for (const child of builder.nodes) {
        if (child.parentId === node.id && child.type !== 'related') {
          child.instrument = 'Probate';
          child.grantor = `Estate of ${node.grantee}`;
        }
      }
    }
  }

  for (const chain of STRESS_CHAINS) {
    addSupplementalStressCards(builder, chain);
  }

  const { nodes, pdfMappings } = builder;
  const ts = Date.now();

  const deskMaps = STRESS_CHAINS.map((chain, index) => ({
    id: `dm-stress-${index + 1}-${ts}`,
    name: chain.name,
    code: chain.code,
    tractId: chain.code,
    nodeIds: getTractNodes(nodes, chain.landDesc).map((node) => node.id),
  }));

  return {
    projectName: `Stress Test — ${deskMaps.length} Tracts`,
    nodes,
    deskMaps,
    activeDeskMapId: deskMaps[0]?.id ?? null,
    instrumentTypes: [...STRESS_INSTRUMENT_TYPES],
    pdfMappings,
  };
}

// ── Stress test entry point ──────────────────────────────

export async function seedStressTestData(): Promise<{ nodeCount: number; pdfCount: number }> {
  const workspace = buildStressWorkspaceData();

  // Load into store
  useWorkspaceStore.getState().loadWorkspace({
    projectName: workspace.projectName,
    nodes: workspace.nodes,
    deskMaps: workspace.deskMaps,
    activeDeskMapId: workspace.activeDeskMapId,
    instrumentTypes: workspace.instrumentTypes,
  });

  // Attach PDFs from TORS_Documents/
  let pdfCount = 0;
  for (const mapping of workspace.pdfMappings) {
    const ok = await attachPdf(mapping.nodeId, mapping.fileName);
    if (ok) pdfCount++;
  }

  console.log(
    `[stress] Built ${workspace.nodes.length} nodes, attached ${pdfCount} PDFs, ${workspace.deskMaps.length} desk maps`
  );
  return { nodeCount: workspace.nodes.length, pdfCount };
}
