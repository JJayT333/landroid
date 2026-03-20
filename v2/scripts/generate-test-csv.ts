/**
 * Generate test CSV fixtures with realistic NM mineral title chains.
 *
 * Key properties:
 *   - Root always splits into 3 heirs (1/2, 1/4, 1/4)
 *   - Not every grantee conveys — many keep their interest (realistic leaves)
 *   - Fractions are VARIED (not all 1/8) — easy to eyeball-verify
 *   - Power-of-2 fractions only, smallest = 1/512 (exact in 9dp)
 *   - Every tree sums to exactly 1.000000000
 *
 * Produces:
 *   test-200a, test-200b  — two 200-node trees with different structures
 *   test-500a, test-500b  — two 500-node trees with different structures
 *
 * Usage: npx tsx scripts/generate-test-csv.ts
 */
import Decimal from 'decimal.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

const D = (v: string | number | Decimal) => new Decimal(v);
const ZERO = D(0);
const ONE = D(1);
const FLOOR = D('0.001953125'); // 1/512

// ── Data pools ──────────────────────────────────────────────

const SURNAMES = [
  'Strickland', 'Thornton', 'McAllister', 'Baca', 'Gonzales', 'Romero',
  'Chavez', 'Martinez', 'Lucero', 'Sandoval', 'Gallegos', 'Montoya',
  'Trujillo', 'Vigil', 'Archuleta', 'Padilla', 'Jaramillo', 'Cordova',
  'Valdez', 'Herrera', 'Salazar', 'Gutierrez', 'Ortiz', 'Duran',
  'Medina', 'Roybal', 'Sena', 'Tapia', 'Esquibel', 'Maestas',
  'Apodaca', 'Benavidez', 'Casados', 'Dominguez', 'Espinoza', 'Fresquez',
  'Griego', 'Holguin', 'Jimenez', 'Leyba', 'Maldonado', 'Naranjo',
  'Olivas', 'Pacheco', 'Quintana', 'Rivera', 'Sisneros', 'Torres',
  'Ulibarri', 'Velarde', 'Warren', 'Yazzie', 'Zamora', 'Abeyta',
  'Barrett', 'Crawford', 'Davis', 'Ellis', 'Foster', 'Gibson',
  'Hamilton', 'Irving', 'Jenkins', 'Kennedy', 'Lambert', 'Mitchell',
  'Nelson', 'Owens', 'Peterson', 'Quinn', 'Richards', 'Sullivan',
  'Tucker', 'Underwood', 'Vasquez', 'Whitfield', 'Young', 'Zimmerman',
];

const FIRST_NAMES = [
  'Albert', 'Maria', 'Juan', 'Rosa', 'Pedro', 'Elena', 'Carlos', 'Ana',
  'Roberto', 'Teresa', 'Francisco', 'Dolores', 'Manuel', 'Guadalupe',
  'Antonio', 'Josefa', 'Miguel', 'Carmen', 'Luis', 'Isabel',
  'Rafael', 'Luz', 'Jose', 'Pilar', 'Andres', 'Soledad',
  'Tomas', 'Patricia', 'Enrique', 'Beatriz', 'Felix', 'Consuelo',
  'James', 'Sarah', 'William', 'Elizabeth', 'Thomas', 'Margaret',
  'John', 'Mary', 'Robert', 'Martha', 'George', 'Catherine',
  'Henry', 'Virginia', 'Charles', 'Helen', 'Edward', 'Ruth',
  'Daniel', 'Gloria', 'Richard', 'Linda', 'Joseph', 'Barbara',
  'Samuel', 'Dorothy', 'Benjamin', 'Nancy', 'David', 'Alice',
];

const INSTRUMENTS = [
  'Warranty Deed', 'Mineral Deed', 'Quit Claim Deed', 'Special Warranty Deed',
  'Royalty Deed', 'Assignment', 'Affidavit of Heirship', 'Probate Order',
];

const RELATED_INSTRUMENTS = [
  'Affidavit of Heirship', 'Probate Order', 'Death Certificate',
  'Correction Deed', 'Ratification', 'Release of Lien',
];

const LAND_DESC = 'NE/4 of Section 16, Township 10 South, Range 26 East, NMPM, Lea County, New Mexico';

// ── Helpers ─────────────────────────────────────────────────

let nameIndex = 0;
function nextName(): string {
  const first = FIRST_NAMES[nameIndex % FIRST_NAMES.length];
  const last = SURNAMES[Math.floor(nameIndex / FIRST_NAMES.length) % SURNAMES.length];
  nameIndex++;
  return `${first} ${last}`;
}

let dateCounter = 0;
function nextDate(): string {
  const year = Math.min(1920 + Math.floor(dateCounter / 4), 2025);
  const month = 1 + (dateCounter * 3) % 12;
  const day = 1 + (dateCounter * 7) % 28;
  dateCounter++;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function pad(n: number): string { return String(n).padStart(6, '0'); }
function ser(v: Decimal): string { return v.toFixed(9); }

// ── Node type ───────────────────────────────────────────────

interface Node {
  id: string;
  parentId: string | null;
  type: 'conveyance' | 'related';
  instrument: string;
  grantor: string;
  grantee: string;
  vol: string;
  page: string;
  docNo: string;
  fileDate: string;
  date: string;
  landDesc: string;
  remarks: string;
  initialFraction: Decimal;
  fraction: Decimal;
  isDeceased: boolean;
  obituary: string;
}

// ── Split definitions ───────────────────────────────────────
// Each split says: divide parent's fraction into these shares.
// Shares are fractions of the PARENT's interest.
// If shares sum to 1: parent conveys everything.
// If shares sum to < 1: parent keeps the remainder.

type Split = Decimal[];

// ALL splits use powers of 2 only (1/2, 1/4, 1/8) — never 3/4 or other
// non-power-of-2 values, because those fail 9dp round-trip at depth.
const SPLIT_3_HQQ: Split = [D('0.5'), D('0.25'), D('0.25')];       // 3 heirs: 1/2 + 1/4 + 1/4
const SPLIT_2_EQUAL: Split = [D('0.5'), D('0.5')];                  // 2 equal halves
const SPLIT_4_EQUAL: Split = [D('0.25'), D('0.25'), D('0.25'), D('0.25')]; // 4 quarters
const SPLIT_3_QHQ: Split = [D('0.25'), D('0.5'), D('0.25')];       // 3 heirs reordered
const SPLIT_HALF_KEEP: Split = [D('0.5')];                          // convey half, keep half
const SPLIT_EIGHTH_EACH: Split = [D('0.125'), D('0.125'), D('0.125'), D('0.125'),
                                  D('0.125'), D('0.125'), D('0.125'), D('0.125')]; // 8 heirs
const SPLIT_2_QTR: Split = [D('0.25'), D('0.25')];                  // 2 kids get 1/4 each, keep 1/2

// ── Tree generator ──────────────────────────────────────────

interface TreeConfig {
  targetSize: number;
  rootSplit: Split;
  /** Ordered list of splits to cycle through. null = KEEP (don't split). */
  pattern: (Split | null)[];
  relatedFreq: number;
}

function generateTree(cfg: TreeConfig): Node[] {
  const nodes: Node[] = [];
  let nodeCount = 0;

  const rootGrantee = nextName();
  const root: Node = {
    id: 'root', parentId: null, type: 'conveyance',
    instrument: 'Patent', grantor: 'State of New Mexico', grantee: rootGrantee,
    vol: '1', page: '1', docNo: 'PAT-000001',
    fileDate: '1920-03-15', date: '1920-03-15', landDesc: LAND_DESC,
    remarks: 'Original patent — 160 NMA total mineral estate',
    initialFraction: ONE, fraction: ONE,
    isDeceased: true, obituary: 'Died circa 1955. Original patentee.',
  };
  nodes.push(root);
  nodeCount++;

  // Apply root split first
  const rootChildren = applySplit(root, cfg.rootSplit, nodes, nodeCount);
  nodeCount += rootChildren.length;

  // BFS queue: nodes that MIGHT be split further
  const queue = [...rootChildren];
  let patIdx = 0;

  while (nodeCount < cfg.targetSize && queue.length > 0) {
    const parent = queue.shift()!;

    // Pick action from pattern
    const action = cfg.pattern[patIdx % cfg.pattern.length];
    patIdx++;

    if (action === null) {
      // KEEP — this node stays as a leaf (current holder)
      continue;
    }

    // Check if split is feasible (smallest child must be ≥ FLOOR)
    const minShare = Decimal.min(...action);
    const smallestChild = parent.fraction.mul(minShare);
    if (smallestChild.lessThan(FLOOR)) {
      // Can't split — try a simple 2-way if possible
      if (parent.fraction.div(2).greaterThanOrEqualTo(FLOOR) && nodeCount < cfg.targetSize) {
        const children = applySplit(parent, SPLIT_2_EQUAL, nodes, nodeCount);
        nodeCount += children.length;
        queue.push(...children);
      }
      continue;
    }

    if (nodeCount >= cfg.targetSize) break;

    const children = applySplit(parent, action, nodes, nodeCount);
    nodeCount += children.length;

    // Add related docs
    for (const child of children) {
      if (nodeCount < cfg.targetSize && nodeCount % cfg.relatedFreq === 0) {
        nodes.push(makeRelated(child, nodeCount));
        nodeCount++;
      }
    }

    // Children go to queue for potential further splitting
    queue.push(...children);

    // If parent kept some interest and it's splittable, re-queue
    if (parent.fraction.greaterThanOrEqualTo(FLOOR) && parent.fraction.div(2).greaterThanOrEqualTo(FLOOR)) {
      queue.push(parent);
    }
  }

  return nodes;
}

function applySplit(parent: Node, shares: Split, nodes: Node[], startIdx: number): Node[] {
  const children: Node[] = [];
  let conveyed = ZERO;

  for (const shareFrac of shares) {
    const share = parent.fraction.mul(shareFrac);
    if (share.lessThan(FLOOR)) continue;

    const idx = startIdx + children.length;
    const grantee = nextName();
    const date = nextDate();
    const instrument = INSTRUMENTS[idx % INSTRUMENTS.length];

    const child: Node = {
      id: `cv-${pad(idx)}`,
      parentId: parent.id,
      type: 'conveyance',
      instrument,
      grantor: parent.grantee,
      grantee,
      vol: String(1 + Math.floor(idx / 15)),
      page: String(1 + (idx % 100)),
      docNo: `DOC-${pad(idx)}`,
      fileDate: date, date,
      landDesc: LAND_DESC,
      remarks: `${instrument} — interest conveyed`,
      initialFraction: share,
      fraction: share, // starts as leaf, may be reduced later
      isDeceased: idx < 60,
      obituary: idx < 60 ? `Died circa ${1950 + Math.floor(idx / 8) * 5}.` : '',
    };

    nodes.push(child);
    children.push(child);
    conveyed = conveyed.plus(share);
  }

  parent.fraction = parent.fraction.minus(conveyed);
  if (parent.fraction.lessThan(ZERO)) parent.fraction = ZERO;

  return children;
}

function makeRelated(parent: Node, index: number): Node {
  return {
    id: `rel-${pad(index)}`,
    parentId: parent.id,
    type: 'related',
    instrument: RELATED_INSTRUMENTS[index % RELATED_INSTRUMENTS.length],
    grantor: '', grantee: parent.grantee,
    vol: String(1 + Math.floor(index / 15)),
    page: String(1 + (index % 100)),
    docNo: `REL-${pad(index)}`,
    fileDate: nextDate(), date: nextDate(),
    landDesc: '', remarks: 'Supporting document',
    initialFraction: ZERO, fraction: ZERO,
    isDeceased: false, obituary: '',
  };
}

// ── Validation ──────────────────────────────────────────────

function validate(nodes: Node[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const node of nodes) {
    if (node.type !== 'conveyance') continue;
    // Round-trip
    if (!D(ser(node.initialFraction)).equals(node.initialFraction))
      errors.push(`${node.id}: initialFraction round-trip fail`);
    if (!D(ser(node.fraction)).equals(node.fraction))
      errors.push(`${node.id}: fraction round-trip fail`);
    // Invariant
    const children = nodes.filter(c => c.parentId === node.id && c.type === 'conveyance');
    const childSum = children.reduce((s, c) => s.plus(c.initialFraction), ZERO);
    const total = node.fraction.plus(childSum);
    if (total.minus(node.initialFraction).abs().greaterThan('0.0000000001'))
      errors.push(`${node.id}: invariant fail: ${ser(node.fraction)} + ${ser(childSum)} != ${ser(node.initialFraction)}`);
    // Floor
    if (node.initialFraction.greaterThan(0) && node.initialFraction.lessThan(FLOOR))
      errors.push(`${node.id}: below floor`);
  }
  return { valid: errors.length === 0, errors };
}

// ── CSV serialization ───────────────────────────────────────

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n'))
    return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function generateCSV(nodes: Node[], mapId: string): string {
  const header = [
    'Documents Hyperlinked', 'Instrument', 'Order by Date', 'Image Path',
    'Vol', 'Page', 'Inst No.', 'File Date', 'Inst Date',
    'Grantor / Assignor', 'Grantee / Assignee', 'Land Desc.', 'Remarks',
    'INTERNAL_REMAINING_FRACTION', 'INTERNAL_INITIAL_FRACTION',
    'INTERNAL_ID', 'INTERNAL_PID', 'INTERNAL_DOC', 'INTERNAL_TYPE',
    'INTERNAL_DECEASED', 'INTERNAL_OBITUARY', 'INTERNAL_GRAVEYARD_LINK',
    'INTERNAL_TRACTS', 'INTERNAL_CONTACTS', 'INTERNAL_INTERESTS',
    'INTERNAL_CONTACT_LOGS', 'INTERNAL_DESKMAPS', 'INTERNAL_ACTIVE_DESKMAP_ID',
  ].join(',');

  const activeMapId = `map-${mapId}`;
  const rows = nodes.map((node, i) => {
    const cols: string[] = [
      String(i + 1), node.instrument, String(i + 1),
      `TORS_Documents\\${node.docNo}.pdf`,
      node.vol, node.page, node.docNo, node.fileDate, node.date,
      node.grantor, node.grantee, node.landDesc, node.remarks,
      ser(node.fraction), ser(node.initialFraction),
      node.id, node.parentId === null ? 'NULL' : node.parentId,
      '', node.type, String(node.isDeceased), node.obituary, '',
    ];

    if (i === 0) {
      cols.push(JSON.stringify([{
        id: `tract-${mapId}`, code: mapId.toUpperCase(),
        name: `Test — ${nodes.length} Nodes`, acres: 160.0, mapId: activeMapId,
      }]));
      const convs = nodes.filter(n => n.type === 'conveyance').slice(0, 20);
      const contacts = convs.map((n, j) => ({
        id: `c-${j}`, name: n.grantee,
        role: j === 0 ? 'Original Patentee' : 'Mineral Owner', phone: '', email: '',
      }));
      cols.push(JSON.stringify(contacts));
      cols.push(JSON.stringify(contacts.map((c, j) => ({
        id: `i-${j}`, contactId: c.id, tractId: `tract-${mapId}`,
        interestType: 'MI', interestValue: ser(convs[j].initialFraction), status: 'confirmed',
      }))));
      cols.push(JSON.stringify([{
        id: 'l-0', contactId: 'c-0', tractId: `tract-${mapId}`,
        contactAt: '2026-01-15', outcome: 'Test fixture generated.',
      }]));
      cols.push(JSON.stringify([{
        id: activeMapId, name: `Test — ${nodes.length} Nodes`,
        code: mapId.toUpperCase(), tractId: `tract-${mapId}`,
        nodes: nodes.map(n => ({
          id: n.id, parentId: n.parentId, type: n.type,
          fraction: Number(ser(n.fraction)),
          initialFraction: Number(ser(n.initialFraction)),
          instrument: n.instrument, grantor: n.grantor, grantee: n.grantee,
          vol: n.vol, page: n.page, docNo: n.docNo,
          fileDate: n.fileDate, date: n.date,
          landDesc: n.landDesc, remarks: n.remarks, docData: '',
          isDeceased: n.isDeceased, obituary: n.obituary, graveyardLink: '',
        })),
        pz: { x: 0, y: 0, scale: 1 },
      }]));
      cols.push(activeMapId);
    } else {
      cols.push('', '', '', '', '', '');
    }
    return cols.map(escapeCSV).join(',');
  });

  return '\uFEFF' + header + '\n' + rows.join('\n') + '\n';
}

// ── Tree configs ────────────────────────────────────────────

// 200a: Root → 3 heirs. Aggressive splits with occasional keeps.
const config200a: TreeConfig = {
  targetSize: 200,
  rootSplit: SPLIT_3_HQQ,
  pattern: [
    SPLIT_2_EQUAL,    SPLIT_3_QHQ,     SPLIT_2_EQUAL,    SPLIT_HALF_KEEP,
    SPLIT_2_EQUAL,    null,            SPLIT_2_EQUAL,    SPLIT_3_HQQ,
    null,             SPLIT_2_EQUAL,   SPLIT_4_EQUAL,    null,
    SPLIT_2_EQUAL,    SPLIT_HALF_KEEP, SPLIT_2_EQUAL,    null,
  ],
  relatedFreq: 15,
};

// 200b: Root → 3 heirs. More 4-way splits, wider tree.
const config200b: TreeConfig = {
  targetSize: 200,
  rootSplit: SPLIT_3_HQQ,
  pattern: [
    SPLIT_4_EQUAL,    SPLIT_2_EQUAL,   SPLIT_2_QTR,     SPLIT_2_EQUAL,
    null,             SPLIT_4_EQUAL,   SPLIT_2_EQUAL,    null,
    SPLIT_3_QHQ,      SPLIT_2_EQUAL,   null,            SPLIT_2_EQUAL,
    SPLIT_4_EQUAL,    null,            SPLIT_HALF_KEEP,  SPLIT_2_EQUAL,
  ],
  relatedFreq: 12,
};

// 500a: Root → 3 heirs. Aggressive deep + wide.
const config500a: TreeConfig = {
  targetSize: 500,
  rootSplit: SPLIT_3_HQQ,
  pattern: [
    SPLIT_2_EQUAL,    SPLIT_3_QHQ,     SPLIT_2_EQUAL,    SPLIT_4_EQUAL,
    SPLIT_2_EQUAL,    SPLIT_HALF_KEEP, null,             SPLIT_2_EQUAL,
    SPLIT_3_HQQ,      SPLIT_2_EQUAL,   SPLIT_2_EQUAL,    null,
    SPLIT_4_EQUAL,    SPLIT_2_QTR,     SPLIT_2_EQUAL,    null,
    SPLIT_2_EQUAL,    SPLIT_HALF_KEEP, SPLIT_2_EQUAL,    SPLIT_3_QHQ,
  ],
  relatedFreq: 10,
};

// 500b: Root → 3 heirs. Partial conveyances throughout.
const config500b: TreeConfig = {
  targetSize: 500,
  rootSplit: SPLIT_3_HQQ,
  pattern: [
    SPLIT_HALF_KEEP,  SPLIT_2_EQUAL,   SPLIT_EIGHTH_EACH,   SPLIT_2_EQUAL,
    SPLIT_2_EQUAL,    SPLIT_2_QTR,     null,             SPLIT_HALF_KEEP,
    SPLIT_4_EQUAL,    SPLIT_2_EQUAL,   SPLIT_HALF_KEEP,  null,
    SPLIT_2_EQUAL,    SPLIT_3_HQQ,     SPLIT_2_EQUAL,    SPLIT_EIGHTH_EACH,
    null,             SPLIT_2_EQUAL,   SPLIT_HALF_KEEP,  SPLIT_2_EQUAL,
  ],
  relatedFreq: 9,
};

// ── Main ────────────────────────────────────────────────────

const allConfigs = [
  { cfg: config200a, id: 'nm-200a', label: '200a — realistic, mixed splits' },
  { cfg: config200b, id: 'nm-200b', label: '200b — wider, 4-way splits' },
  { cfg: config500a, id: 'nm-500a', label: '500a — deep + wide mix' },
  { cfg: config500b, id: 'nm-500b', label: '500b — many partial conveyances' },
];

for (const { cfg, id, label } of allConfigs) {
  nameIndex = 0;
  dateCounter = 0;

  const nodes = generateTree(cfg);
  const validation = validate(nodes);

  if (!validation.valid) {
    console.error(`✗ ${label} FAILED:`);
    for (const err of validation.errors.slice(0, 10)) console.error(`  ${err}`);
    process.exit(1);
  }

  const csv = generateCSV(nodes, id);
  const filename = `test-${id.replace('nm-', '')}-v2.import.csv`;
  const path = resolve(process.cwd(), '..', filename);
  writeFileSync(path, csv, 'utf-8');

  // Stats
  const conveyances = nodes.filter(n => n.type === 'conveyance');
  const related = nodes.filter(n => n.type === 'related');
  const leaves = conveyances.filter(n =>
    n.fraction.greaterThan(0) && !nodes.some(c => c.parentId === n.id && c.type === 'conveyance')
  );
  const holders = conveyances.filter(n => n.fraction.greaterThan(0));
  const leafSum = leaves.reduce((s, n) => s.plus(n.fraction), ZERO);
  const holderSum = holders.reduce((s, n) => s.plus(n.fraction), ZERO);
  const activeFracs = conveyances.filter(n => n.initialFraction.greaterThan(0));
  const minFrac = activeFracs.reduce((m, n) => Decimal.min(m, n.initialFraction), ONE);
  const rootChildren = nodes.filter(n => n.parentId === 'root' && n.type === 'conveyance');

  const byId = new Map(nodes.map(n => [n.id, n]));
  let maxDepth = 0;
  for (const n of nodes) {
    let depth = 0; let cur: Node | undefined = n;
    while (cur?.parentId) { cur = byId.get(cur.parentId); depth++; }
    maxDepth = Math.max(maxDepth, depth);
  }

  console.log(`✓ ${filename}  [${label}]`);
  console.log(`  ${nodes.length} nodes (${conveyances.length} conveyances, ${related.length} related)`);
  console.log(`  root children: ${rootChildren.length} (fractions: ${rootChildren.map(n => ser(n.initialFraction)).join(', ')})`);
  console.log(`  depth: ${maxDepth}, smallest: ${ser(minFrac)}`);
  console.log(`  current holders: ${holders.length} (sum: ${ser(holderSum)})`);
  console.log(`  leaf holders: ${leaves.length} (sum: ${ser(leafSum)})`);
  console.log('');
}
