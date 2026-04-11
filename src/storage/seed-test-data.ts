/**
 * Seed test data — creates a realistic mineral title chain with PDF attachments.
 *
 * Builds ~18 nodes representing a Texas mineral title:
 *   Patent → Warranty Deeds → Mineral Deeds → lease overlays
 *   with related docs (Death Certificates, Probate, Affidavits)
 *
 * Reuses a small bundled sample pulled from TORS_Documents/
 * and stores those PDFs in IndexedDB alongside the workspace data.
 */
import { useWorkspaceStore } from '../store/workspace-store';
import { useMapStore } from '../store/map-store';
import { useOwnerStore } from '../store/owner-store';
import { buildLeaseNode, isLeaseNode } from '../components/deskmap/deskmap-lease-node';
import type { OwnerWorkspaceData } from './owner-persistence';
import { createBundledDeskMapPdfFile } from './bundled-deskmap-pdfs';
import { savePdf } from './pdf-store';
import type { DeskMap, OwnershipNode } from '../types/node';
import { createBlankNode } from '../types/node';
import { createBlankLease, createBlankOwner } from '../types/owner';
import type {
  LeaseholdAssignment,
  LeaseholdOrri,
  LeaseholdTransferOrderEntry,
  LeaseholdUnit,
} from '../types/leasehold';
import { createWorkspaceId } from '../utils/workspace-id';

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

function countyFromLandDesc(landDesc: string): string {
  const match = landDesc.match(/([A-Za-z .'-]+?)\s+County\b/i);
  return match?.[1]?.trim() ?? 'Unknown';
}

function addDaysToIso(dateValue: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue || '1900-01-01';
  }
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function inferFractionPair(value: string): { numerator: string; denominator: string } {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { numerator: '0', denominator: '1' };
  }

  for (let denominator = 1; denominator <= 1024; denominator *= 2) {
    const numerator = Math.round(numeric * denominator);
    if (Math.abs(numerator / denominator - numeric) < 1e-9) {
      return {
        numerator: String(numerator),
        denominator: String(denominator),
      };
    }
  }

  return {
    numerator: String(Math.round(numeric * 1_000_000)),
    denominator: '1000000',
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function toIsoTimestamp(dateValue: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return '2026-01-01T12:00:00.000Z';
  }

  return `${dateValue}T12:00:00.000Z`;
}

function hasPositiveFraction(node: OwnershipNode): boolean {
  return node.type !== 'related' && Number(node.fraction) > 0;
}

function buildSeedOwnerWorkspaceData(
  workspaceId: string,
  nodes: OwnershipNode[],
  projectName: string,
  options: {
    leaseOverridesByNodeId?: Map<string, Partial<OwnerWorkspaceData['leases'][number]>>;
  } = {}
): {
  nodes: OwnershipNode[];
  ownerData: OwnerWorkspaceData;
} {
  const nodesWithOwners = nodes.map((node, index) => {
    if (!hasPositiveFraction(node)) {
      return node;
    }

    const ownerId = `owner-${slugify(node.grantee || node.id)}-${index + 1}`;
    return {
      ...node,
      linkedOwnerId: ownerId,
    };
  });

  const owners = nodesWithOwners.flatMap((node, index) => {
    if (!hasPositiveFraction(node) || !node.linkedOwnerId) {
      return [];
    }

    return [
      createBlankOwner(workspaceId, {
        id: node.linkedOwnerId,
        name: node.grantee || `Owner ${index + 1}`,
        county: countyFromLandDesc(node.landDesc),
        prospect: projectName,
        notes: [
          node.instrument ? `Source Instrument: ${node.instrument}` : '',
          node.docNo ? `Doc #: ${node.docNo}` : '',
          node.landDesc ? `Land: ${node.landDesc}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        createdAt: toIsoTimestamp(node.fileDate || node.date),
        updatedAt: toIsoTimestamp(node.fileDate || node.date),
      }),
    ];
  });

  const nodeById = new Map(nodesWithOwners.map((node) => [node.id, node]));
  const leases = [] as OwnerWorkspaceData['leases'];
  const nodesWithLeases = nodesWithOwners.map((node) => {
    if (!isLeaseNode(node) || !node.parentId) {
      return node;
    }

    const parentNode = nodeById.get(node.parentId) ?? null;
    if (!parentNode?.linkedOwnerId) {
      return node;
    }

    const leaseId = `lease-${node.id}`;
    const leaseOverrides = options.leaseOverridesByNodeId?.get(node.id) ?? {};
    const lease = createBlankLease(workspaceId, parentNode.linkedOwnerId, {
      id: leaseId,
      leaseName: `${parentNode.grantee || 'Unnamed Owner'} Lease`,
      lessee: node.grantee || PRIMARY_TEST_LESSEE,
      royaltyRate: '1/4',
      leasedInterest: parentNode.fraction,
      effectiveDate: node.date,
      expirationDate: addDaysToIso(node.date, 1095),
      status: 'Active',
      docNo: node.docNo,
      notes: node.remarks,
      createdAt: toIsoTimestamp(node.fileDate || node.date),
      updatedAt: toIsoTimestamp(node.fileDate || node.date),
      ...leaseOverrides,
    });
    leases.push(lease);

    return buildLeaseNode({
      id: node.id,
      parentNode,
      lease,
      existingNode: node,
    });
  });

  return {
    nodes: nodesWithLeases,
    ownerData: {
      owners,
      leases,
      contacts: [],
      docs: [],
    },
  };
}

const HUMOROUS_CAUSES_OF_DEATH = [
  'lost a dispute with a runaway pie wagon at the county fair',
  'was bucked into legend by a horse named Pancake',
  'challenged a windmill during a dust storm and lost on points',
  'took a fatal tumble while retrieving a hat from a pecan tree',
  'was flattened by a church potluck table collapse of unusual enthusiasm',
  'never recovered from a fireworks-and-jackrabbit misunderstanding',
  'was outmaneuvered by a hay bale rolling downhill with purpose',
  'met an untimely end in a feed-store parrot incident that was avoidable in hindsight',
  'was launched off a sorghum wagon during an argument about proper biscuit thickness',
  'mistook a rattlesnake in a boot for a prank and committed too hard to the bit',
  'tried to lasso a weather vane to prove a point to cousins and physics',
  'suffered catastrophic consequences in a goat-cart exhibition race behind the VFW hall',
  'entered a ceremonial leaf-blower duel at Founders Day and was betrayed by traction',
  'attempted to ride a parade float shaped like a brisket directly into a drainage ditch',
  'accepted an ill-advised challenge to out-yodel a tornado siren from the courthouse roof',
  'got too ambitious during a moonlight crawfish-boil trebuchet demonstration',
  'was defeated by an overcaffeinated emu at the county livestock annex',
  'misjudged the stopping distance of a lawn-chair pulled by a prize hog named Democracy',
  'attempted to inaugurate a fog machine inside a deer blind and immediately learned about oxygen',
  'was dragged into folklore after testing a homemade catfish hoverboard on an irrigation ditch',
  'sustained terminal consequences during a ceremonial gravy-cannon salute behind the volunteer fire hall',
  'insisted on racing a solar-powered donkey cart called The Gospel Missile and sadly set a personal record',
] as const;

const HUMOROUS_EPITAPHS = [
  'Witnesses agreed the hat survived.',
  'The mule was acquitted for lack of motive.',
  'The accordion player kept going for another two songs.',
  'County gossip remained active for three fiscal quarters.',
  'The casserole was declared innocent.',
  'The preacher called it memorable and moved on.',
  'Nobody could explain the rooster.',
  'A commemorative pie social followed shortly thereafter.',
  'The sheriff wrote "honestly kind of impressive" in the margin.',
  'Three eyewitnesses disagreed on the color of the goat but not the outcome.',
  'The town band reused the story for years without improving the rhythm section.',
  'A cousin swore this had been predictable since 1938.',
  'The mayor briefly considered banning pageantry, then remembered tourism.',
  'Someone sold commemorative koozies before sunset.',
  'A bass boat was named in their honor by people who misunderstood the event entirely.',
  'The local paper called it "regrettable, but visually committed."',
] as const;

const HUMOROUS_OBITUARY_OPENERS = [
  'According to local memory,',
  'As recounted by two cousins, a barber, and one unreliable deputy,',
  'The official version, which improves with every retelling, says',
  'Courthouse lore maintains that',
] as const;

const HUMOROUS_WITNESSES = [
  'a justice of the peace',
  'three church ladies',
  'the man who sold boiled peanuts outside the stock show',
  'one highly opinionated feed-store clerk',
  'two nephews and a suspiciously calm mule',
  'the accordion player from the VFW dance',
  'a woman selling rhinestone Bible covers from the trunk of a Cadillac',
  'one teenager live-commenting from the Sonic parking lot',
  'the assistant manager of a fireworks tent shaped like Texas',
  'a retired rodeo announcer who refused to lower his voice',
  'a beekeeper dressed as Davy Crockett for reasons never fully explained',
  'one substitute teacher who should have left thirty minutes earlier',
] as const;

const PRIMARY_TEST_LESSEE = 'Permian Basin Operating, LLC';

function buildHumorousObituary(
  grantee: string,
  dateValue: string,
  landDesc: string,
  index: number
): string {
  const county = countyFromLandDesc(landDesc);
  const opener = HUMOROUS_OBITUARY_OPENERS[index % HUMOROUS_OBITUARY_OPENERS.length];
  const cause = HUMOROUS_CAUSES_OF_DEATH[index % HUMOROUS_CAUSES_OF_DEATH.length];
  const epitaph = HUMOROUS_EPITAPHS[index % HUMOROUS_EPITAPHS.length];
  const witness = HUMOROUS_WITNESSES[index % HUMOROUS_WITNESSES.length];
  const when = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? dateValue : 'an uncertain Tuesday';
  const variant = index % 4;

  if (variant === 0) {
    return `${opener} ${grantee} departed this mortal leasehold on ${when} in ${county} County after ${cause}. ${epitaph}`;
  }

  if (variant === 1) {
    return `${grantee} met their final curtain call on ${when} in ${county} County after ${cause}. ${witness} later insisted it was "more educational than tragic." ${epitaph}`;
  }

  if (variant === 2) {
    return `On ${when}, ${county} County lost ${grantee} to an incident in which they ${cause}. ${witness} provided testimony nobody asked for. ${epitaph}`;
  }

  return `${opener} on ${when}, ${grantee} left the chain of title behind after ${cause}. ${witness} claimed the whole thing happened "faster than a deed correction." ${epitaph}`;
}

function buildGeneratedRemark(
  node: OwnershipNode,
  parent: OwnershipNode | null,
  index: number
): string {
  const county = countyFromLandDesc(node.landDesc);

  if (node.type === 'related') {
    if (isLeaseNode(node) || node.instrument === 'Oil & Gas Lease') {
      return `${node.grantor || parent?.grantee || 'Lessor'} leased to ${node.grantee || PRIMARY_TEST_LESSEE} in ${county} County.`;
    }
    if (node.instrument === 'Death Certificate') {
      return `Filed in ${county} County to explain why ${parent?.grantee || node.grantee} stopped signing things.`;
    }
    if (node.instrument === 'Affidavit of Heirship') {
      return `Neighbors, cousins, and at least one confident barber swore this is who inherited ${parent?.grantee || 'the interest'}.`;
    }
    return `Related filing for ${parent?.grantee || node.grantee} recorded in ${county} County after a long morning at the clerk's office.`;
  }

  if (!node.parentId) {
    return 'Original patent covering the whole tract before anybody sliced it into courthouse spaghetti.';
  }

  if (node.instrument === 'Oil & Gas Lease') {
    return `${node.grantee} picked up a lease on ${node.initialFraction} of the whole tract in ${county} County after a negotiation fueled by coffee and stubbornness.`;
  }

  if (node.instrument === 'Probate') {
    return `Estate papers moved ${node.initialFraction} of the tract from ${node.grantor} to ${node.grantee} without anyone flipping a folding table.`;
  }

  if (node.instrument === 'Royalty Deed') {
    return `${node.grantor} carved out a royalty burden in ${county} County and sent it to ${node.grantee} after everybody pretended the fractions were obvious.`;
  }

  const punchline = index % 2 === 0
    ? 'The ink dried faster than the family drama.'
    : 'Everybody left convinced they got the better end of the bargain.';
  return `${node.grantor} conveyed ${node.initialFraction} of the whole tract to ${node.grantee} in ${county} County. ${punchline}`;
}

function finalizeGeneratedNodes(
  nodes: OwnershipNode[],
  { humorousDeaths }: { humorousDeaths: boolean }
): OwnershipNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  return nodes.map((node, index) => {
    const parent = node.parentId ? byId.get(node.parentId) ?? null : null;
    const date = node.date || parent?.fileDate || '1900-01-01';
    const fileDate = node.fileDate || addDaysToIso(date, 5);
    const landDesc = node.landDesc || parent?.landDesc || 'Unspecified tract, Texas';
    const county = countyFromLandDesc(landDesc);
    const instrument =
      node.instrument || (node.type === 'related' ? 'Related Document' : 'Mineral Deed');
    const grantor =
      node.grantor ||
      (node.type === 'related'
        ? `County Clerk of ${county} County`
        : parent?.grantee || 'State of Texas');
    const grantee =
      node.grantee ||
      (node.type === 'related'
        ? `${instrument} concerning ${parent?.grantee || 'Unknown Party'}`
        : `Mystery Mineral Buyer ${index + 1}`);
    const docNo = node.docNo || `SEED-${String(index + 1).padStart(5, '0')}`;
    const vol = node.vol || String(100 + Math.floor(index / 3));
    const page = node.page || String(10 + ((index * 17) % 290));
    const remarks =
      node.remarks ||
      buildGeneratedRemark(
        { ...node, instrument, grantor, grantee, landDesc, date, fileDate, docNo, vol, page },
        parent,
        index
      );

    let numerator = node.numerator;
    let denominator = node.denominator;
    let conveyanceMode = node.conveyanceMode;
    let splitBasis = node.splitBasis;

    if (node.type === 'related') {
      conveyanceMode = 'all';
      splitBasis = 'whole';
      numerator = '0';
      denominator = '1';
    } else if (!node.parentId) {
      conveyanceMode = 'all';
      splitBasis = 'whole';
      numerator = '1';
      denominator = '1';
    } else if (numerator === '0' || !numerator) {
      const inferred = inferFractionPair(node.initialFraction);
      numerator = inferred.numerator;
      denominator = inferred.denominator;
    }

    const manualAmount =
      node.manualAmount && node.manualAmount !== '0'
        ? node.manualAmount
        : node.type === 'related'
          ? '0.000000000'
          : node.initialFraction;

    const obituary =
      node.isDeceased && humorousDeaths
        ? buildHumorousObituary(
            grantee,
            addDaysToIso(fileDate, 3200 + index),
            landDesc,
            index
          )
        : node.obituary;
    const graveyardLink =
      node.isDeceased
        ? node.graveyardLink ||
          `https://example.com/memorials/${slugify(grantee)}-${String(index + 1).padStart(3, '0')}`
        : node.graveyardLink;

    return {
      ...node,
      instrument,
      vol,
      page,
      docNo,
      fileDate,
      date,
      grantor,
      grantee,
      landDesc,
      remarks,
      conveyanceMode,
      splitBasis,
      numerator,
      denominator,
      manualAmount,
      obituary,
      graveyardLink,
    };
  });
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
    fraction: '0.000000000',
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
    relatedKind: 'document',
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
    type: 'related',
    relatedKind: 'lease',
    instrument: 'Oil & Gas Lease',
    date: '2020-06-01',
    fileDate: '2020-06-15',
    grantor: 'Patricia Elmore Powell',
    grantee: PRIMARY_TEST_LESSEE,
    landDesc,
    initialFraction: '0',
    fraction: '0',
    docNo: '20200790',
    remarks: '3-year primary term, 1/4 royalty',
  }));
  pdfMappings.push({ nodeId: lease1, fileName: '20200790.pdf' });

  const lease2 = nodeId(); // Elmore Family Partners leases
  nodes.push(makeNode(lease2, md3, {
    type: 'related',
    relatedKind: 'lease',
    instrument: 'Oil & Gas Lease',
    date: '2021-01-15',
    fileDate: '2021-02-01',
    grantor: 'Elmore Family Partners, LLC',
    grantee: PRIMARY_TEST_LESSEE,
    landDesc,
    initialFraction: '0',
    fraction: '0',
    docNo: '20210747',
    remarks: '3-year primary term, 1/4 royalty',
  }));
  pdfMappings.push({ nodeId: lease2, fileName: '20210747.pdf' });

  // ─── RELATED: Affidavit of Heirship ───────────────────
  const aoh = nodeId();
  nodes.push(makeNode(aoh, wd2, {
    type: 'related',
    relatedKind: 'document',
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
  nodes.push(makeNode(surfAgmt, md3, {
    type: 'related',
    relatedKind: 'document',
    instrument: 'Surface Use Agreement',
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

// ── Store a bundled PDF sample in IDB ───────────────────

async function attachPdf(nodeId: string, fileName: string): Promise<boolean> {
  try {
    const node = useWorkspaceStore.getState().nodes.find((candidate) => candidate.id === nodeId);
    const fileNameHint = node?.docNo ? `${node.docNo}.pdf` : fileName;
    const file = await createBundledDeskMapPdfFile(
      `${nodeId}:${fileName}`,
      fileNameHint
    );
    await savePdf(nodeId, file);
    return true;
  } catch (err) {
    console.warn(`[seed] Failed to attach ${fileName}:`, err);
    return false;
  }
}

// ── Main entry point ────────────────────────────────────

export async function seedTestData(): Promise<{ nodeCount: number; pdfCount: number }> {
  const { nodes: rawNodes, pdfMappings } = buildTestNodes();
  const workspaceId = createWorkspaceId();
  const finalizedNodes = finalizeGeneratedNodes(rawNodes, { humorousDeaths: false });
  const { nodes, ownerData } = buildSeedOwnerWorkspaceData(
    workspaceId,
    finalizedNodes,
    'Elmore Title Examination'
  );

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
    grossAcres: '',
    pooledAcres: '',
    description: '',
    nodeIds: nodes.map((n) => n.id),
  };

  // Load into store
  useWorkspaceStore.getState().loadWorkspace({
    workspaceId,
    projectName: 'Elmore Title Examination',
    nodes,
    deskMaps: [deskMap],
    activeDeskMapId: dmId,
    instrumentTypes: [
      'Patent', 'Warranty Deed', 'Mineral Deed', 'Royalty Deed',
      'Special Warranty Deed', 'Oil & Gas Lease', 'Probate', 'Affidavit of Heirship',
      'Surface Use Agreement',
      'Death Certificate', 'Quitclaim Deed', 'Correction Deed', 'Release',
      'Will', 'Order',
    ],
  });
  await Promise.all([
    useOwnerStore.getState().replaceWorkspaceData(workspaceId, ownerData),
    useMapStore.getState().setWorkspace(workspaceId),
  ]);

  // Attach PDFs
  let pdfCount = 0;
  const failedPdfNodeIds: string[] = [];
  for (const mapping of pdfMappings) {
    const ok = await attachPdf(mapping.nodeId, mapping.fileName);
    if (ok) {
      pdfCount++;
    } else {
      failedPdfNodeIds.push(mapping.nodeId);
    }
  }

  if (failedPdfNodeIds.length > 0) {
    for (const failedNodeId of failedPdfNodeIds) {
      useWorkspaceStore.getState().updateNode(failedNodeId, { hasDoc: false });
    }
  }

  return { nodeCount: nodes.length, pdfCount };
}

// ═══════════════════════════════════════════════════════════
// Stress Test — tract-sized desk maps including a true 500-card workload
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
  'Special Warranty Deed', 'Oil & Gas Lease', 'Probate', 'Affidavit of Heirship',
  'Surface Use Agreement',
  'Death Certificate', 'Quitclaim Deed', 'Correction Deed', 'Release',
  'Will', 'Order',
];

const FIRST = [
  'Buckshot Jubilee', 'Dottie Sputnik', 'Skeeter Deluxe', 'Mavis Moonpie',
  'Buford Possum', 'Peaches Carburetor', 'Cactus Karaoke', 'Loretta Cinderblock',
  'Otis Banjo', 'Velma Chainsaw', 'Bubba Meteor', 'Opal Barbecue',
  'Waylon Turnip', 'Birdie Pickle', 'Tex Spackle', 'Tallulah Rattlesnake',
  'Earlene Thunderpocket', 'Rufus Sidewinder', 'June Bug Jetpack', 'Bonnie Sue Moonshine',
  'Clem Cornbread', 'Myrtle Gizmo', 'Zeke Pepperjack', 'Darla Mae Tornado',
  'Hank Whistlepig', 'Trixie Casserole', 'Gomer Firecracker', 'Lula Belle Gravel',
  'Moxie Hoedown', 'Pearl Pogo', 'Jedediah DuctTape', 'Nellie Loophole',
  'Roy Dean Catfish', 'Wanda June Lasso', 'Leroy Pickax', 'Bitsy Comet',
  'Biscuit Ray', 'Cricket Static', 'Minnie Pearl Turbo', 'Tumbleweed Annie',
  'Jasper Lee Sidequest', 'Soda Pop Avalanche', 'Coy LaserPossum', 'Reba Faye Moonwhistle',
  'Dusty Mae Chains', 'Banjo Earl', 'Clovis Firefly', 'Puddin Catastrophe',
  'Fern Pocketknife', 'Stubby Telescope', 'Queenie Jo Greasepaint', 'Velcro June',
  'Moonbeam Taxidermy', 'Panhandle Disco', 'Cicada Biscuit', 'Gravy Rocket',
  'Marmalade Ruckus', 'Bocephus Airhorn', 'Luanne Tumbletron', 'Jericho Moonboots',
  'Tater Astronaut', 'Nebula Jean Bucket', 'Grits Houdini', 'Dixie Wobblecopter',
];

const DEEDS = ['Warranty Deed', 'Mineral Deed', 'Royalty Deed', 'Quitclaim Deed', 'Special Warranty Deed'];

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

interface LeaseholdDemoTractPlan {
  name: string;
  code: string;
  grossAcres: string;
  pooledAcres: string;
  description: string;
  landDesc: string;
  patentYear: number;
  patentGrantee: string;
  pattern: 'half-quarter-quarter' | 'half-quarter-eighth-eighth';
  currentOwners: string[];
  branchHolders: string[];
}

const STRESS_CHAINS: StressConfig[] = [
  {
    name: 'Tract 1',
    code: 'T1',
    targetCardCount: 100,
    landDesc: 'Section 14, Block B, T&P RR Co. Survey, Henderson County, Texas',
    surnames: ['Moonwhistle', 'Picklebarrel', 'Crowbait', 'Fizzlewick', 'Mopbucket', 'Velvetanvil', 'Brisketstorm', 'Tumblegizzard'],
    patentYear: 1895,
    patentGrantee: 'Buckshot Jubilee Henderson',
    maxDepth: 5,
    rootSplit: 2,
  },
  {
    name: 'Tract 2',
    code: 'T2',
    targetCardCount: 150,
    landDesc: 'Section 20, Block C, H&TC RR Co. Survey, Crockett County, Texas',
    surnames: ['Peppermill', 'Goosefiddle', 'Taterpatch', 'Sodbuster', 'Thunderplume', 'Crankshaft', 'Wobbletax', 'Snackthunder'],
    patentYear: 1901,
    patentGrantee: 'Marfa Moonbeam Peppermill',
    maxDepth: 5,
    rootSplit: 3,
  },
  {
    name: 'Tract 3',
    code: 'T3',
    targetCardCount: 500,
    landDesc: 'Section 8, Block A, SP RR Co. Survey, Pecos County, Texas',
    surnames: ['Moonquilt', 'Dustbucket', 'Turnipseed', 'Whistlegrit', 'Spurpickle', 'Hucklepenny', 'Cactusholler', 'Brakecheck', 'Goatstatic', 'Marshmallowfax'],
    patentYear: 1898,
    patentGrantee: 'Cicada Biscuit Moonquilt',
    maxDepth: 7,
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
      relatedKind: 'document',
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
  options: {
    includeLeafLeases?: boolean;
  } = {}
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
      const shouldLease =
        (options.includeLeafLeases ?? true) && (idx + i + config.maxDepth) % 6 === 0;
      if (shouldLease) {
        const leaseYear = 2018 + (idx % 6);
        const leaseMonth = String(((i * 4 + 1) % 12) + 1).padStart(2, '0');
        const leaseId = b.addRelated(childId, {
          relatedKind: 'lease',
          instrument: 'Oil & Gas Lease',
          date: `${leaseYear}-${leaseMonth}-01`,
          fileDate: `${leaseYear}-${leaseMonth}-15`,
          grantor: grantee,
          grantee: PRIMARY_TEST_LESSEE,
          remarks: `3-year primary term, 1/4 royalty for ${config.name}`,
        });
        if (idx % 2 === 0) b.assignPdf(leaseId);
      }
    } else {
      expandStressBranch(
        b,
        childId,
        shares[i],
        depth - 1,
        idx * numChildren + i,
        config,
        options
      );
    }
  }
}

const EXTRA_STRESS_SUPPLEMENTAL_GRANTEES = [
  'Blue Mesa Moon Unit, LLC',
  'High Plains Goose Patrol Minerals',
  'Lariat & Leftovers Royalty, LP',
  'Cimarron Unscheduled Operating Partners',
  'Prairie Biscuit Acquisition Co.',
  'Dusty Boots Override Holdings',
  'Department of Unfinished Minerals, Ltd.',
  'Moonpie Catastrophe Override Co.',
  'Velcro Cattle Royalty Syndicate',
  'Panhandle Hovercraft Acquisition Group',
  'Galactic Pecan Override Authority, LP',
  'Southeast Rattlesnack Participation Trust',
  'Brisket Eclipse Acquisition Cabinet, LLC',
  'Committee for Strategic Turnips and Minerals',
] as const;

const SUPPLEMENTAL_STRESS_INSTRUMENTS = [
  'Mineral Deed',
  'Royalty Deed',
  'Quitclaim Deed',
  'Special Warranty Deed',
] as const;

function getTractNodes(nodes: OwnershipNode[], landDesc: string): OwnershipNode[] {
  return nodes.filter((node) => node.landDesc === landDesc);
}

function getTractCardNodes(nodes: OwnershipNode[], landDesc: string): OwnershipNode[] {
  return getTractNodes(nodes, landDesc).filter((node) => node.type !== 'related');
}

function addSupplementalStressCards(
  builder: StressBuilder,
  config: StressConfig,
  options: {
    includeLeaseVariation?: boolean;
  } = {}
): void {
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
  const leasedParentIds = new Set(
    builder.nodes.flatMap((node) =>
      isLeaseNode(node) && node.parentId ? [node.parentId] : []
    )
  );
  const leafTargets = existingCards.filter(
    (node) => !parentIds.has(node.id) && !leasedParentIds.has(node.id)
  );

  for (let index = 0; index < extraNeeded; index += 1) {
    const target = leafTargets[index];
    if (!target) {
      throw new Error(
        `Stress tract ${config.name} could not reach target card count of ${config.targetCardCount}`
      );
    }
    const share = Number(target.fraction || target.initialFraction || '0');
    if (!Number.isFinite(share) || share <= 0) {
      throw new Error(`Stress tract ${config.name} has invalid supplemental share on ${target.id}`);
    }

    const year = config.patentYear + 120 + index;
    const month = ((index * 3) % 12) + 1;
    const day = ((index * 5) % 28) + 1;
    const instrument =
      SUPPLEMENTAL_STRESS_INSTRUMENTS[index % SUPPLEMENTAL_STRESS_INSTRUMENTS.length];
    const conveyanceId = builder.addChild(target.id, share, {
      instrument,
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      fileDate: `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day + 7, 28)).padStart(2, '0')}`,
      grantor: target.grantee,
      grantee: EXTRA_STRESS_SUPPLEMENTAL_GRANTEES[index % EXTRA_STRESS_SUPPLEMENTAL_GRANTEES.length],
      remarks: `Supplemental ${instrument.toLowerCase()} added for ${config.name} desk map stress coverage after a conference-room prophet in mirrored sunglasses said "cowards stop at normal."`,
      conveyanceMode: 'all',
      splitBasis: 'initial',
      numerator: '1',
      denominator: '1',
    });
    if (index % 2 === 0) builder.assignPdf(conveyanceId);

    let createdLease = false;
    if ((options.includeLeaseVariation ?? true) && index % 4 === 1) {
      const leaseId = builder.addRelated(conveyanceId, {
        relatedKind: 'lease',
        instrument: 'Oil & Gas Lease',
        date: `${year + 1}-${String(month).padStart(2, '0')}-01`,
        fileDate: `${year + 1}-${String(month).padStart(2, '0')}-15`,
        grantor: EXTRA_STRESS_SUPPLEMENTAL_GRANTEES[index % EXTRA_STRESS_SUPPLEMENTAL_GRANTEES.length],
        grantee: PRIMARY_TEST_LESSEE,
        remarks: `Supplemental lease variation for ${config.name} with 1/4 royalty and a stubborn landman.`,
      });
      if (index % 8 === 1) builder.assignPdf(leaseId);
      createdLease = true;
    }

    const conveyanceNode = builder.nodes.find((node) => node.id === conveyanceId);
    if (conveyanceNode && !createdLease) {
      leafTargets.push(conveyanceNode);
    }
  }
}

export function buildStressWorkspaceData(): {
  workspaceId: string;
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  activeDeskMapId: string | null;
  instrumentTypes: string[];
  pdfMappings: PdfMapping[];
  ownerData: OwnerWorkspaceData;
} {
  const workspaceId = createWorkspaceId();
  const builder = new StressBuilder();

  // Build 3 independent tract-sized title chains
  for (const chain of STRESS_CHAINS) {
    const rootId = builder.addRoot(chain.landDesc, chain.patentGrantee, chain.patentYear);
    expandStressBranch(builder, rootId, 1.0, chain.maxDepth, 0, chain, {
      includeLeafLeases: true,
    });
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
    addSupplementalStressCards(builder, chain, { includeLeaseVariation: true });
  }

  const finalizedNodes = finalizeGeneratedNodes(builder.nodes, { humorousDeaths: true });
  const { nodes, ownerData } = buildSeedOwnerWorkspaceData(
    workspaceId,
    finalizedNodes,
    `Stress Test - ${STRESS_CHAINS.length} Tracts`
  );
  const pdfMappings = builder.pdfMappings;
  const ts = Date.now();

  const deskMaps = STRESS_CHAINS.map((chain, index) => ({
    id: `dm-stress-${index + 1}-${ts}`,
    name: chain.name,
    code: chain.code,
    tractId: chain.code,
    grossAcres: '',
    pooledAcres: '',
    description: '',
    nodeIds: getTractNodes(nodes, chain.landDesc).map((node) => node.id),
  }));

  return {
    workspaceId,
    projectName: `Stress Test — ${deskMaps.length} Tracts`,
    nodes,
    deskMaps,
    activeDeskMapId: deskMaps[0]?.id ?? null,
    instrumentTypes: [...STRESS_INSTRUMENT_TYPES],
    pdfMappings,
    ownerData,
  };
}

const LEASEHOLD_DEMO_UNIT = {
  name: 'Raven Bend Unit',
  description:
    'Eight-tract pooled unit template with clean acreage, clean fractions, and full lease coverage for leasehold review.',
  operator: PRIMARY_TEST_LESSEE,
  effectiveDate: '2024-01-01',
  jurisdiction: 'tx_fee',
} as const;

const LEASEHOLD_DEMO_ORRIS = [
  {
    id: 'leasehold-demo-orri-1',
    payee: 'Raven Bend Override, LP',
    scope: 'unit',
    deskMapId: null,
    burdenFraction: '1/16',
    burdenBasis: 'gross_8_8',
    effectiveDate: '2024-02-01',
    sourceDocNo: 'LHD-ORRI-1',
    notes: 'Starter unit-wide ORRI for gross-burden review.',
  },
] as const;

const LEASEHOLD_DEMO_ASSIGNMENT_TEMPLATES = [
  {
    id: 'leasehold-demo-assignment-1',
    assignor: PRIMARY_TEST_LESSEE,
    assignee: 'Raven Bend Partners, LLC',
    scope: 'unit',
    deskMapCode: null,
    workingInterestFraction: '1/2',
    effectiveDate: '2024-03-01',
    sourceDocNo: 'LHD-ASG-1',
    notes: 'Starter unit-wide half-WI assignment for easy leasehold deck math.',
  },
  {
    id: 'leasehold-demo-assignment-2',
    assignor: PRIMARY_TEST_LESSEE,
    assignee: 'Cedar Draw Operating, LLC',
    scope: 'tract',
    deskMapCode: 'T4',
    workingInterestFraction: '1/4',
    effectiveDate: '2024-03-15',
    sourceDocNo: 'LHD-ASG-2',
    notes: 'Starter tract-specific quarter-WI assignment on Tract 4.',
  },
] as const;

const LEASEHOLD_DEMO_TRACTS: LeaseholdDemoTractPlan[] = [
  {
    name: 'Tract 1',
    code: 'T1',
    grossAcres: '80',
    pooledAcres: '80',
    description: '80-acre north tract with present owners split 40 / 20 / 20 net mineral acres.',
    landDesc: 'North Half of Section 6, Block 12, H&GN RR Co. Survey, Reagan County, Texas',
    patentYear: 1902,
    patentGrantee: 'Della June Moonwhistle',
    pattern: 'half-quarter-quarter',
    currentOwners: ['Ava Moonwhistle', 'Barton Sodbuster', 'Clara Goosefiddle'],
    branchHolders: ['Moonwhistle Family Holdings, LLC'],
  },
  {
    name: 'Tract 2',
    code: 'T2',
    grossAcres: '160',
    pooledAcres: '160',
    description: '160-acre east tract with present owners split 80 / 40 / 40 net mineral acres.',
    landDesc: 'East Half of Section 11, Block 44, T-5-S, T&P RR Co. Survey, Upton County, Texas',
    patentYear: 1897,
    patentGrantee: 'Otis Ray Peppermill',
    pattern: 'half-quarter-quarter',
    currentOwners: ['Eli Peppermill', 'Flora Thunderplume', 'Gus Crankshaft'],
    branchHolders: ['Peppermill Family Trust'],
  },
  {
    name: 'Tract 3',
    code: 'T3',
    grossAcres: '240',
    pooledAcres: '240',
    description: '240-acre central tract with present owners split 120 / 60 / 30 / 30 net mineral acres.',
    landDesc: 'Section 3, Block 7, GC&SF RR Co. Survey, Midland County, Texas',
    patentYear: 1905,
    patentGrantee: 'Velma Jean Dustbucket',
    pattern: 'half-quarter-eighth-eighth',
    currentOwners: ['Hattie Dustbucket', 'Ike Turnipseed', 'June Brakecheck', 'Kirk Goatstatic'],
    branchHolders: ['Dustbucket Mineral Partners, LP', 'Brakecheck Legacy Minerals, LLC'],
  },
  {
    name: 'Tract 4',
    code: 'T4',
    grossAcres: '320',
    pooledAcres: '320',
    description: '320-acre west tract with present owners split 160 / 80 / 80 net mineral acres.',
    landDesc: 'West Half of Section 19, Block 32, T-2-S, T&P RR Co. Survey, Reeves County, Texas',
    patentYear: 1899,
    patentGrantee: 'Buckshot Ray Velvetanvil',
    pattern: 'half-quarter-quarter',
    currentOwners: ['Lena Velvetanvil', 'Morris Crowbait', 'Nora Picklebarrel'],
    branchHolders: ['Velvetanvil Mineral Management, LLC'],
  },
  {
    name: 'Tract 5',
    code: 'T5',
    grossAcres: '400',
    pooledAcres: '400',
    description: '400-acre south tract with present owners split 200 / 100 / 50 / 50 net mineral acres.',
    landDesc: 'South Half of Section 27, Block C-23, PSL Survey, Loving County, Texas',
    patentYear: 1908,
    patentGrantee: 'Cicada Belle Moonquilt',
    pattern: 'half-quarter-eighth-eighth',
    currentOwners: ['Opal Moonquilt', 'Perry Spurpickle', 'Quinn Whistlegrit', 'Ruth Biscuit'],
    branchHolders: ['Moonquilt Ranch Minerals, LP', 'Whistlegrit Legacy Holdings, LLC'],
  },
  {
    name: 'Tract 6',
    code: 'T6',
    grossAcres: '480',
    pooledAcres: '480',
    description: '480-acre northwest tract with present owners split 240 / 120 / 60 / 60 net mineral acres.',
    landDesc: 'Northwest Half of Section 15, Block 6, I&GN RR Co. Survey, Martin County, Texas',
    patentYear: 1906,
    patentGrantee: 'Rosie Mae Cactusholler',
    pattern: 'half-quarter-eighth-eighth',
    currentOwners: ['Sable Cactusholler', 'Theo Brisketstorm', 'Una Pepperjack', 'Vern Saddlewire'],
    branchHolders: ['Cactusholler Minerals, LLC', 'Pepperjack Legacy Minerals, LLC'],
  },
  {
    name: 'Tract 7',
    code: 'T7',
    grossAcres: '560',
    pooledAcres: '560',
    description: '560-acre southeast tract with present owners split 280 / 140 / 140 net mineral acres.',
    landDesc: 'Southeast Half of Section 21, Block 14, H&TC RR Co. Survey, Glasscock County, Texas',
    patentYear: 1904,
    patentGrantee: 'Jericho Moonboots',
    pattern: 'half-quarter-quarter',
    currentOwners: ['Willa Moonboots', 'Xavier Chuckwagon', 'Yara Tinstar'],
    branchHolders: ['Moonboots Title Holdings, LLC'],
  },
  {
    name: 'Tract 8',
    code: 'T8',
    grossAcres: '640',
    pooledAcres: '640',
    description: '640-acre river tract with present owners split 320 / 160 / 80 / 80 net mineral acres.',
    landDesc: 'Section 9, Block 2, GH&H RR Co. Survey, Howard County, Texas',
    patentYear: 1910,
    patentGrantee: 'Mabel Quicksprocket',
    pattern: 'half-quarter-eighth-eighth',
    currentOwners: ['Zane Quicksprocket', 'Ada Lonespur', 'Beau Tumblegizzard', 'Cora Snakeroot'],
    branchHolders: ['Quicksprocket Minerals, LP', 'Snakeroot River Holdings, LLC'],
  },
];

interface LeaseholdDemoBuilderState {
  nodes: OwnershipNode[];
  pdfMappings: PdfMapping[];
  leaseOverridesByNodeId: Map<string, Partial<OwnerWorkspaceData['leases'][number]>>;
  seq: number;
  docSeq: number;
}

function nextLeaseholdDemoNodeId(state: LeaseholdDemoBuilderState) {
  state.seq += 1;
  return `leasehold-demo-${state.seq}`;
}

function nextLeaseholdDemoDocNo(state: LeaseholdDemoBuilderState) {
  state.docSeq += 1;
  return `LHD-${state.docSeq}`;
}

function markLeaseholdDemoPdf(
  state: LeaseholdDemoBuilderState,
  nodeId: string,
  fileName: string
) {
  const node = state.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return;
  node.hasDoc = true;
  state.pdfMappings.push({ nodeId, fileName });
}

function addLeaseholdDemoConveyance(
  state: LeaseholdDemoBuilderState,
  {
    parentId,
    instrument,
    date,
    fileDate,
    grantor,
    grantee,
    landDesc,
    initialFraction,
    remainingFraction,
    remarks,
  }: {
    parentId: string | null;
    instrument: string;
    date: string;
    fileDate: string;
    grantor: string;
    grantee: string;
    landDesc: string;
    initialFraction: string;
    remainingFraction: string;
    remarks: string;
  }
) {
  const id = nextLeaseholdDemoNodeId(state);
  const inferred = inferFractionPair(initialFraction);
  state.nodes.push(
    makeNode(id, parentId, {
      instrument,
      date,
      fileDate,
      grantor,
      grantee,
      landDesc,
      initialFraction,
      fraction: remainingFraction,
      docNo: nextLeaseholdDemoDocNo(state),
      remarks,
      numerator: inferred.numerator,
      denominator: inferred.denominator,
      conveyanceMode: 'fraction',
      splitBasis: parentId ? 'initial' : 'whole',
    })
  );
  return id;
}

function addLeaseholdDemoDocument(
  state: LeaseholdDemoBuilderState,
  {
    parentId,
    instrument,
    date,
    fileDate,
    grantee,
    landDesc,
    remarks,
  }: {
    parentId: string;
    instrument: string;
    date: string;
    fileDate: string;
    grantee: string;
    landDesc: string;
    remarks: string;
  }
) {
  const id = nextLeaseholdDemoNodeId(state);
  state.nodes.push(
    makeNode(id, parentId, {
      type: 'related',
      relatedKind: 'document',
      instrument,
      date,
      fileDate,
      grantor: '',
      grantee,
      landDesc,
      initialFraction: '0',
      fraction: '0',
      docNo: nextLeaseholdDemoDocNo(state),
      remarks,
    })
  );
  return id;
}

function addLeaseholdDemoLease(
  state: LeaseholdDemoBuilderState,
  tract: LeaseholdDemoTractPlan,
  currentOwnerNodeId: string,
  currentOwnerName: string,
  currentOwnerFraction: string,
  leaseIndex: number
) {
  const id = nextLeaseholdDemoNodeId(state);
  const leaseMonth = String(((leaseIndex * 2) % 12) + 1).padStart(2, '0');
  state.nodes.push(
    makeNode(id, currentOwnerNodeId, {
      type: 'related',
      relatedKind: 'lease',
      instrument: 'Oil & Gas Lease',
      date: `2024-${leaseMonth}-01`,
      fileDate: `2024-${leaseMonth}-12`,
      grantor: currentOwnerName,
      grantee: PRIMARY_TEST_LESSEE,
      landDesc: tract.landDesc,
      initialFraction: '0',
      fraction: '0',
      docNo: nextLeaseholdDemoDocNo(state),
      remarks: `${tract.name} lease covering 100% of ${currentOwnerName}'s present mineral interest at 1/8 royalty.`,
    })
  );
  state.leaseOverridesByNodeId.set(id, {
    royaltyRate: '1/8',
    leasedInterest: currentOwnerFraction,
    leaseName: `${tract.name} — ${currentOwnerName} Lease`,
    notes: `${tract.description} Same lessee across the unit for the initial framework.`,
  });
  if (leaseIndex === 0) {
    markLeaseholdDemoPdf(state, id, `${tract.code}-lease.pdf`);
  }
}

function buildLeaseholdDemoTract(
  state: LeaseholdDemoBuilderState,
  tract: LeaseholdDemoTractPlan
) {
  const patentId = addLeaseholdDemoConveyance(state, {
    parentId: null,
    instrument: 'Patent',
    date: `${tract.patentYear}-03-15`,
    fileDate: `${tract.patentYear}-04-01`,
    grantor: 'State of Texas',
    grantee: tract.patentGrantee,
    landDesc: tract.landDesc,
    initialFraction: '1.000000000',
    remainingFraction: '0.000000000',
    remarks: `${tract.name} patent for the full tract mineral estate.`,
  });
  markLeaseholdDemoPdf(state, patentId, `${tract.code}-patent.pdf`);

  if (tract.pattern === 'half-quarter-quarter') {
    const [ownerA, ownerB, ownerC] = tract.currentOwners;
    const [branchHolder] = tract.branchHolders;

    const ownerAId = addLeaseholdDemoConveyance(state, {
      parentId: patentId,
      instrument: 'Warranty Deed',
      date: `${tract.patentYear + 35}-05-10`,
      fileDate: `${tract.patentYear + 35}-05-20`,
      grantor: tract.patentGrantee,
      grantee: ownerA,
      landDesc: tract.landDesc,
      initialFraction: '0.500000000',
      remainingFraction: '0.500000000',
      remarks: `${tract.name} conveyance creating the first one-half present owner block.`,
    });
    const branchId = addLeaseholdDemoConveyance(state, {
      parentId: patentId,
      instrument: 'Mineral Deed',
      date: `${tract.patentYear + 35}-05-10`,
      fileDate: `${tract.patentYear + 35}-05-20`,
      grantor: tract.patentGrantee,
      grantee: branchHolder,
      landDesc: tract.landDesc,
      initialFraction: '0.500000000',
      remainingFraction: '0.000000000',
      remarks: `${tract.name} branch holder set up for the remaining one-half mineral block.`,
    });
    addLeaseholdDemoDocument(state, {
      parentId: branchId,
      instrument: 'Affidavit of Heirship',
      date: `${tract.patentYear + 36}-01-15`,
      fileDate: `${tract.patentYear + 36}-01-22`,
      grantee: branchHolder,
      landDesc: tract.landDesc,
      remarks: `${tract.name} heirship affidavit confirming the split to two equal successors.`,
    });
    const ownerBId = addLeaseholdDemoConveyance(state, {
      parentId: branchId,
      instrument: 'Special Warranty Deed',
      date: `${tract.patentYear + 52}-08-01`,
      fileDate: `${tract.patentYear + 52}-08-12`,
      grantor: branchHolder,
      grantee: ownerB,
      landDesc: tract.landDesc,
      initialFraction: '0.250000000',
      remainingFraction: '0.250000000',
      remarks: `${tract.name} present owner block yielding one quarter of the tract.`,
    });
    const ownerCId = addLeaseholdDemoConveyance(state, {
      parentId: branchId,
      instrument: 'Quitclaim Deed',
      date: `${tract.patentYear + 52}-08-01`,
      fileDate: `${tract.patentYear + 52}-08-12`,
      grantor: branchHolder,
      grantee: ownerC,
      landDesc: tract.landDesc,
      initialFraction: '0.250000000',
      remainingFraction: '0.250000000',
      remarks: `${tract.name} final quarter-interest conveyance completing the fully leased setup.`,
    });

    const currentOwnerNodeIds = [
      ownerAId,
      ownerBId,
      ownerCId,
    ].filter((nodeId): nodeId is string => Boolean(nodeId));
    const currentOwnerFractions = ['0.500000000', '0.250000000', '0.250000000'];
    currentOwnerNodeIds.forEach((nodeId, index) => {
      addLeaseholdDemoLease(
        state,
        tract,
        nodeId,
        tract.currentOwners[index] ?? `Owner ${index + 1}`,
        currentOwnerFractions[index] ?? '0',
        index
      );
    });
    return;
  }

  const [ownerA, ownerB, ownerC, ownerD] = tract.currentOwners;
  const [branchA, branchB] = tract.branchHolders;
  addLeaseholdDemoConveyance(state, {
    parentId: patentId,
    instrument: 'Warranty Deed',
    date: `${tract.patentYear + 30}-04-05`,
    fileDate: `${tract.patentYear + 30}-04-15`,
    grantor: tract.patentGrantee,
    grantee: ownerA,
    landDesc: tract.landDesc,
    initialFraction: '0.500000000',
    remainingFraction: '0.500000000',
    remarks: `${tract.name} first present owner block yielding one half of the tract.`,
  });
  const firstBranchId = addLeaseholdDemoConveyance(state, {
    parentId: patentId,
    instrument: 'Mineral Deed',
    date: `${tract.patentYear + 30}-04-05`,
    fileDate: `${tract.patentYear + 30}-04-15`,
    grantor: tract.patentGrantee,
    grantee: branchA,
    landDesc: tract.landDesc,
    initialFraction: '0.500000000',
    remainingFraction: '0.000000000',
    remarks: `${tract.name} branch holder for the remaining one-half mineral block.`,
  });
  addLeaseholdDemoDocument(state, {
    parentId: firstBranchId,
    instrument: 'Probate',
    date: `${tract.patentYear + 31}-01-09`,
    fileDate: `${tract.patentYear + 31}-01-21`,
    grantee: branchA,
    landDesc: tract.landDesc,
    remarks: `${tract.name} probate record confirming the quarter-interest split of the remaining branch.`,
  });
  const ownerBId = addLeaseholdDemoConveyance(state, {
    parentId: firstBranchId,
    instrument: 'Special Warranty Deed',
    date: `${tract.patentYear + 46}-07-14`,
    fileDate: `${tract.patentYear + 46}-07-25`,
    grantor: branchA,
    grantee: ownerB,
    landDesc: tract.landDesc,
    initialFraction: '0.250000000',
    remainingFraction: '0.250000000',
    remarks: `${tract.name} second present owner block yielding one quarter of the tract.`,
  });
  const secondBranchId = addLeaseholdDemoConveyance(state, {
    parentId: firstBranchId,
    instrument: 'Correction Deed',
    date: `${tract.patentYear + 46}-07-14`,
    fileDate: `${tract.patentYear + 46}-07-25`,
    grantor: branchA,
    grantee: branchB,
    landDesc: tract.landDesc,
    initialFraction: '0.250000000',
    remainingFraction: '0.000000000',
    remarks: `${tract.name} branch correction setting up the final one-eighth owner blocks.`,
  });
  const ownerCId = addLeaseholdDemoConveyance(state, {
    parentId: secondBranchId,
    instrument: 'Mineral Deed',
    date: `${tract.patentYear + 60}-11-03`,
    fileDate: `${tract.patentYear + 60}-11-12`,
    grantor: branchB,
    grantee: ownerC,
    landDesc: tract.landDesc,
    initialFraction: '0.125000000',
    remainingFraction: '0.125000000',
    remarks: `${tract.name} third present owner block yielding one eighth of the tract.`,
  });
  const ownerDId = addLeaseholdDemoConveyance(state, {
    parentId: secondBranchId,
    instrument: 'Quitclaim Deed',
    date: `${tract.patentYear + 60}-11-03`,
    fileDate: `${tract.patentYear + 60}-11-12`,
    grantor: branchB,
    grantee: ownerD,
    landDesc: tract.landDesc,
    initialFraction: '0.125000000',
    remainingFraction: '0.125000000',
    remarks: `${tract.name} final present owner block yielding one eighth of the tract.`,
  });

  const currentOwnerNodeIds = [
    state.nodes.find((node) => node.parentId === patentId && node.grantee === ownerA)?.id,
    ownerBId,
    ownerCId,
    ownerDId,
  ].filter((nodeId): nodeId is string => Boolean(nodeId));
  const currentOwnerFractions = ['0.500000000', '0.250000000', '0.125000000', '0.125000000'];

  currentOwnerNodeIds.forEach((nodeId, index) => {
    addLeaseholdDemoLease(
      state,
      tract,
      nodeId,
      tract.currentOwners[index] ?? `Owner ${index + 1}`,
      currentOwnerFractions[index] ?? '0',
      index
    );
  });
}

export function buildLeaseholdDemoWorkspaceData(): {
  workspaceId: string;
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  leaseholdUnit: typeof LEASEHOLD_DEMO_UNIT;
  leaseholdAssignments: LeaseholdAssignment[];
  leaseholdOrris: LeaseholdOrri[];
  leaseholdTransferOrderEntries: LeaseholdTransferOrderEntry[];
  activeDeskMapId: string | null;
  instrumentTypes: string[];
  pdfMappings: PdfMapping[];
  ownerData: OwnerWorkspaceData;
} {
  const workspaceId = createWorkspaceId();
  const builder: LeaseholdDemoBuilderState = {
    nodes: [],
    pdfMappings: [],
    leaseOverridesByNodeId: new Map(),
    seq: 0,
    docSeq: 20000,
  };

  LEASEHOLD_DEMO_TRACTS.forEach((tract) => {
    buildLeaseholdDemoTract(builder, tract);
  });

  const finalizedNodes = finalizeGeneratedNodes(builder.nodes, { humorousDeaths: false });
  const { nodes, ownerData } = buildSeedOwnerWorkspaceData(
    workspaceId,
    finalizedNodes,
    `Leasehold Demo - ${LEASEHOLD_DEMO_TRACTS.length} Tracts`,
    { leaseOverridesByNodeId: builder.leaseOverridesByNodeId }
  );
  const ts = Date.now();

  const deskMaps = LEASEHOLD_DEMO_TRACTS.map((tract, index) => ({
    id: `dm-leasehold-${index + 1}-${ts}`,
    name: tract.name,
    code: tract.code,
    tractId: tract.code,
    grossAcres: tract.grossAcres,
    pooledAcres: tract.pooledAcres,
    description: tract.description,
    nodeIds: getTractNodes(nodes, tract.landDesc).map((node) => node.id),
  }));
  const deskMapIdByCode = new Map(deskMaps.map((deskMap) => [deskMap.code, deskMap.id]));
  const leaseholdAssignments = LEASEHOLD_DEMO_ASSIGNMENT_TEMPLATES.map((assignment) => ({
    id: assignment.id,
    assignor: assignment.assignor,
    assignee: assignment.assignee,
    scope: assignment.scope,
    deskMapId:
      assignment.scope === 'tract'
        ? deskMapIdByCode.get(assignment.deskMapCode ?? '') ?? null
        : null,
    workingInterestFraction: assignment.workingInterestFraction,
    effectiveDate: assignment.effectiveDate,
    sourceDocNo: assignment.sourceDocNo,
    notes: assignment.notes,
  }));

  return {
    workspaceId,
    projectName: `Leasehold Demo — ${deskMaps.length} Tracts`,
    nodes,
    deskMaps,
    leaseholdUnit: LEASEHOLD_DEMO_UNIT,
    leaseholdAssignments,
    leaseholdOrris: LEASEHOLD_DEMO_ORRIS.map((orri) => ({ ...orri })),
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: deskMaps[0]?.id ?? null,
    instrumentTypes: [...STRESS_INSTRUMENT_TYPES],
    pdfMappings: builder.pdfMappings,
    ownerData,
  };
}

// ── Stress test entry point ──────────────────────────────

export async function seedStressTestData(): Promise<{ nodeCount: number; pdfCount: number }> {
  const workspace = buildStressWorkspaceData();

  // Load into store
  useWorkspaceStore.getState().loadWorkspace({
    workspaceId: workspace.workspaceId,
    projectName: workspace.projectName,
    nodes: workspace.nodes,
    deskMaps: workspace.deskMaps,
    activeDeskMapId: workspace.activeDeskMapId,
    instrumentTypes: workspace.instrumentTypes,
  });
  await Promise.all([
    useOwnerStore.getState().replaceWorkspaceData(
      workspace.workspaceId,
      workspace.ownerData
    ),
    useMapStore.getState().setWorkspace(workspace.workspaceId),
  ]);

  // Attach bundled PDFs sourced from TORS_Documents/
  let pdfCount = 0;
  const failedPdfNodeIds: string[] = [];
  for (const mapping of workspace.pdfMappings) {
    const ok = await attachPdf(mapping.nodeId, mapping.fileName);
    if (ok) {
      pdfCount++;
    } else {
      failedPdfNodeIds.push(mapping.nodeId);
    }
  }

  if (failedPdfNodeIds.length > 0) {
    for (const failedNodeId of failedPdfNodeIds) {
      useWorkspaceStore.getState().updateNode(failedNodeId, { hasDoc: false });
    }
  }

  console.log(
    `[stress] Built ${workspace.nodes.length} nodes, attached ${pdfCount} PDFs, ${workspace.deskMaps.length} desk maps`
  );
  return { nodeCount: workspace.nodes.length, pdfCount };
}

export async function seedLeaseholdDemoData(): Promise<{
  nodeCount: number;
  pdfCount: number;
}> {
  const workspace = buildLeaseholdDemoWorkspaceData();

  useWorkspaceStore.getState().loadWorkspace({
    workspaceId: workspace.workspaceId,
    projectName: workspace.projectName,
    nodes: workspace.nodes,
    deskMaps: workspace.deskMaps,
    leaseholdUnit: workspace.leaseholdUnit,
    leaseholdAssignments: workspace.leaseholdAssignments,
    leaseholdOrris: workspace.leaseholdOrris,
    leaseholdTransferOrderEntries: workspace.leaseholdTransferOrderEntries,
    activeDeskMapId: workspace.activeDeskMapId,
    instrumentTypes: workspace.instrumentTypes,
  });
  await Promise.all([
    useOwnerStore.getState().replaceWorkspaceData(
      workspace.workspaceId,
      workspace.ownerData
    ),
    useMapStore.getState().setWorkspace(workspace.workspaceId),
  ]);

  let pdfCount = 0;
  const failedPdfNodeIds: string[] = [];
  for (const mapping of workspace.pdfMappings) {
    const ok = await attachPdf(mapping.nodeId, mapping.fileName);
    if (ok) {
      pdfCount++;
    } else {
      failedPdfNodeIds.push(mapping.nodeId);
    }
  }

  if (failedPdfNodeIds.length > 0) {
    for (const failedNodeId of failedPdfNodeIds) {
      useWorkspaceStore.getState().updateNode(failedNodeId, { hasDoc: false });
    }
  }

  console.log(
    `[leasehold] Built ${workspace.nodes.length} nodes, attached ${pdfCount} PDFs, ${workspace.deskMaps.length} desk maps`
  );
  return { nodeCount: workspace.nodes.length, pdfCount };
}

// ═══════════════════════════════════════════════════════════
// Combinatorial fixture — 8 tracts × ~100 nodes, every scenario
// a Texas landman regularly encounters (simple power-of-2 fractions).
// ═══════════════════════════════════════════════════════════

interface CombinatorialTractPlan {
  name: string;
  code: string;
  grossAcres: string;
  pooledAcres: string;
  description: string;
  landDesc: string;
  patentYear: number;
  patentGrantee: string;
  /** Leading royalty rate used for this tract's primary leases. */
  primaryRoyalty: string;
  /** Surname pool used to name branch grantees deterministically. */
  surnames: string[];
  /**
   * The combinatorial flavor — every tract covers the basics, but the
   * designated flavor is represented more densely so the user can flip
   * between tracts to audit one scenario family at a time.
   */
  flavor:
    | 'baseline_splits'
    | 'probate_heirship'
    | 'fixed_npri'
    | 'floating_npri'
    | 'correction_release'
    | 'royalty_deeds'
    | 'lease_overlap'
    | 'kitchen_sink';
}

const COMBINATORIAL_TRACTS: CombinatorialTractPlan[] = [
  {
    name: 'Tract 1 — Baseline Splits',
    code: 'C1',
    grossAcres: '160',
    pooledAcres: '160',
    description:
      'Clean 1/2, 1/4, 1/8 warranty-deed chain of title with simple power-of-2 splits and leases at 1/8 royalty.',
    landDesc: 'Section 4, Block 18, T&P RR Co. Survey, Howard County, Texas',
    patentYear: 1898,
    patentGrantee: 'Harold Whitaker',
    primaryRoyalty: '1/8',
    surnames: ['Whitaker', 'Bennett', 'Parker', 'Collins', 'Hayes', 'Foster', 'Mercer', 'Lawson'],
    flavor: 'baseline_splits',
  },
  {
    name: 'Tract 2 — Probate & Heirship',
    code: 'C2',
    grossAcres: '240',
    pooledAcres: '240',
    description:
      'Multi-generation death certificate, affidavit of heirship, will, and probate chains feeding the present owners.',
    landDesc: 'Section 9, Block 22, H&GN RR Co. Survey, Reagan County, Texas',
    patentYear: 1895,
    patentGrantee: 'Eleanor Sutton',
    primaryRoyalty: '3/16',
    surnames: ['Sutton', 'Baker', 'Fletcher', 'Morgan', 'Russell', 'Snyder', 'Keller', 'Preston'],
    flavor: 'probate_heirship',
  },
  {
    name: 'Tract 3 — Fixed NPRI Carves',
    code: 'C3',
    grossAcres: '320',
    pooledAcres: '320',
    description:
      'Fixed NPRIs at 1/16 and 1/32 of the whole, stacked under a clean mineral chain so the deck shows the classic Hahn-style setup.',
    landDesc: 'Section 15, Block 6, I&GN RR Co. Survey, Upton County, Texas',
    patentYear: 1901,
    patentGrantee: 'Leonard Carlisle',
    primaryRoyalty: '1/4',
    surnames: ['Carlisle', 'Bishop', 'Kendall', 'Porter', 'Maddox', 'Dalton', 'Barrett', 'Holland'],
    flavor: 'fixed_npri',
  },
  {
    name: 'Tract 4 — Floating NPRI Carves',
    code: 'C4',
    grossAcres: '400',
    pooledAcres: '400',
    description:
      'Floating NPRIs at 1/2 and 1/4 of lease royalty, with sibling fixed NPRIs for contrast and mixed lease royalty rates.',
    landDesc: 'Section 21, Block 14, H&TC RR Co. Survey, Reeves County, Texas',
    patentYear: 1906,
    patentGrantee: 'Dorothy Langley',
    primaryRoyalty: '1/5',
    surnames: ['Langley', 'Whitman', 'Turner', 'Griffin', 'Hawkins', 'Brady', 'Sawyer', 'Monroe'],
    flavor: 'floating_npri',
  },
  {
    name: 'Tract 5 — Corrections & Releases',
    code: 'C5',
    grossAcres: '480',
    pooledAcres: '480',
    description:
      'Quitclaims, correction deeds, and release instruments layered on top of a working warranty-deed chain.',
    landDesc: 'Section 27, Block C-23, PSL Survey, Loving County, Texas',
    patentYear: 1904,
    patentGrantee: 'Stanley Rutledge',
    primaryRoyalty: '1/8',
    surnames: ['Rutledge', 'Donovan', 'Wheeler', 'Harrison', 'Farley', 'Patterson', 'Granger', 'Baxter'],
    flavor: 'correction_release',
  },
  {
    name: 'Tract 6 — Royalty Deeds + ORRI Deck',
    code: 'C6',
    grossAcres: '560',
    pooledAcres: '560',
    description:
      'Royalty-deed carve-outs on the mineral side plus unit-level ORRIs on all three basis types (gross 8/8, NRI, WI).',
    landDesc: 'Section 3, Block 7, GC&SF RR Co. Survey, Midland County, Texas',
    patentYear: 1905,
    patentGrantee: 'Marjorie Caldwell',
    primaryRoyalty: '3/16',
    surnames: ['Caldwell', 'Carver', 'Kirkland', 'Sinclair', 'Atkins', 'Presley', 'Merrill', 'Thornton'],
    flavor: 'royalty_deeds',
  },
  {
    name: 'Tract 7 — Lease Overlap / Top-Lease',
    code: 'C7',
    grossAcres: '640',
    pooledAcres: '640',
    description:
      'Deliberate two-lease overlap on a present owner: an original lease and a later top-lease at a higher royalty, wired to exercise the overlap warning surface.',
    landDesc: 'Section 11, Block 2, GH&H RR Co. Survey, Martin County, Texas',
    patentYear: 1910,
    patentGrantee: 'Clarence Whitfield',
    primaryRoyalty: '1/4',
    surnames: ['Whitfield', 'Sherman', 'Ellison', 'McAllister', 'Benson', 'Campbell', 'Atwood', 'Sterling'],
    flavor: 'lease_overlap',
  },
  {
    name: 'Tract 8 — Kitchen Sink',
    code: 'C8',
    grossAcres: '640',
    pooledAcres: '640',
    description:
      'Every scenario in one tract: probate, NPRI (fixed + floating), correction, release, royalty deed, top-lease, and mixed-royalty unit leases.',
    landDesc: 'Section 19, Block 32, T-2-S, T&P RR Co. Survey, Glasscock County, Texas',
    patentYear: 1909,
    patentGrantee: 'Beatrice Hollister',
    primaryRoyalty: '1/8',
    surnames: ['Hollister', 'Bradford', 'Remington', 'Winslow', 'Chandler', 'Kensington', 'Stanford', 'Wellington'],
    flavor: 'kitchen_sink',
  },
];

const COMBINATORIAL_FIRST_NAMES = [
  'Alice', 'Andrew', 'Anna', 'Anthony', 'Benjamin', 'Beth', 'Brandon', 'Caroline',
  'Charles', 'Charlotte', 'Christopher', 'Claire', 'Daniel', 'David', 'Elizabeth', 'Emily',
  'Ethan', 'Evelyn', 'Frank', 'George', 'Grace', 'Hannah', 'Henry', 'James',
  'Jane', 'Jason', 'Jeffrey', 'Jennifer', 'John', 'Jonathan', 'Joseph', 'Katherine',
  'Kevin', 'Laura', 'Luke', 'Margaret', 'Mark', 'Mary', 'Matthew', 'Megan',
  'Michael', 'Nancy', 'Nicholas', 'Olivia', 'Patrick', 'Paul', 'Peter', 'Rebecca',
  'Robert', 'Sarah', 'Scott', 'Stephen', 'Susan', 'Thomas', 'Victoria', 'William',
] as const;

const COMBINATORIAL_TARGET_NODES_PER_TRACT = 100;

/**
 * Per-tract grantee name generator. Deterministic so reseeding produces the
 * same project snapshot, but unique enough that no two generated owners in the
 * combinatorial fixture share the same full name.
 */
function createCombinatorialGranteeGenerator(tract: CombinatorialTractPlan) {
  let index = 0;

  return function nextCombinatorialGrantee(): string {
    const first = COMBINATORIAL_FIRST_NAMES[index % COMBINATORIAL_FIRST_NAMES.length];
    const surname =
      tract.surnames[
        Math.floor(index / COMBINATORIAL_FIRST_NAMES.length) % tract.surnames.length
      ];
    index += 1;
    return `${first} ${surname}`;
  };
}

function combinatorialDate(
  tract: CombinatorialTractPlan,
  yearOffset: number,
  seq: number
): { date: string; fileDate: string } {
  const year = tract.patentYear + yearOffset;
  const month = String(((seq * 5) % 12) + 1).padStart(2, '0');
  const day = String(((seq * 11) % 27) + 1).padStart(2, '0');
  const fileDay = String(Math.min(Number(day) + 7, 28)).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    fileDate: `${year}-${month}-${fileDay}`,
  };
}

/**
 * Push an NPRI child onto the builder's node list without deducting from the
 * mineral parent's remaining fraction — NPRI is carved sibling-style per the
 * math engine's `allocatesAgainstParent` rule (different interest classes do
 * not allocate against each other). Mirrors the direct-push pattern that
 * `StressBuilder.addChild` would otherwise use, minus the `.remaining` update.
 */
function pushNpriChild(
  builder: StressBuilder,
  parentId: string,
  {
    share,
    royaltyKind,
    fixedRoyaltyBasis,
    grantor,
    grantee,
    instrument,
    date,
    fileDate,
    remarks,
  }: {
    share: number;
    royaltyKind: 'fixed' | 'floating';
    fixedRoyaltyBasis?: 'burdened_branch' | 'whole_tract';
    grantor: string;
    grantee: string;
    instrument: string;
    date: string;
    fileDate: string;
    remarks: string;
  }
): string {
  const id = `stress-${builder.nodes.length + 1}-npri-${builder.pdfMappings.length}-${Math.random().toString(36).slice(2, 8)}`;
  const parent = builder.nodes.find((n) => n.id === parentId);
  builder.nodes.push(
    makeNode(id, parentId, {
      type: 'conveyance',
      instrument,
      date,
      fileDate,
      grantor,
      grantee,
      landDesc: parent?.landDesc ?? '',
      initialFraction: share.toFixed(9),
      fraction: share.toFixed(9),
      docNo: `CB-NPRI-${builder.nodes.length}`,
      remarks,
      interestClass: 'npri',
      royaltyKind,
      fixedRoyaltyBasis: royaltyKind === 'fixed'
        ? fixedRoyaltyBasis ?? 'burdened_branch'
        : null,
      numerator: '1',
      denominator: String(Math.max(1, Math.round(1 / share))),
      conveyanceMode: 'fraction',
      // NPRIs are expressed as a fraction of the 8/8 (whole), not of the
      // mineral parent's fraction. Use splitBasis='whole' so that re-opening
      // the node in ConveyModal recomputes the same stored share back.
      splitBasis: 'whole',
    })
  );
  return id;
}

/** A cluster that always-generates at a fertile parent in a tract. */
type ClusterRunner = (
  builder: StressBuilder,
  parentId: string,
  tract: CombinatorialTractPlan,
  iteration: number,
  nextGrantee: () => string
) => void;

function clusterSplitPair(
  builder: StressBuilder,
  parentId: string,
  tract: CombinatorialTractPlan,
  iteration: number,
  nextGrantee: () => string
) {
  const parent = builder.nodes.find((n) => n.id === parentId);
  if (!parent) return;
  const parentRem = Number(parent.fraction);
  if (parentRem < 1 / 32) return;
  const share = parentRem / 2;
  const grantee1 = nextGrantee();
  const grantee2 = nextGrantee();
  const { date, fileDate } = combinatorialDate(tract, 30 + iteration, iteration);
  const childA = builder.addChild(parentId, share, {
    instrument: 'Warranty Deed',
    date,
    fileDate,
    grantor: parent.grantee,
    grantee: grantee1,
    remarks: `${tract.name} one-half split to ${grantee1}.`,
    numerator: '1',
    denominator: '2',
    conveyanceMode: 'fraction',
    splitBasis: 'initial',
  });
  const childB = builder.addChild(parentId, share, {
    instrument: 'Warranty Deed',
    date,
    fileDate,
    grantor: parent.grantee,
    grantee: grantee2,
    remarks: `${tract.name} one-half split to ${grantee2}.`,
    numerator: '1',
    denominator: '2',
    conveyanceMode: 'fraction',
    splitBasis: 'initial',
  });
  if (iteration % 3 === 0) builder.assignPdf(childA);
  if (iteration % 4 === 0) builder.assignPdf(childB);
}

function clusterQuarterFan(
  builder: StressBuilder,
  parentId: string,
  tract: CombinatorialTractPlan,
  iteration: number,
  nextGrantee: () => string
) {
  const parent = builder.nodes.find((n) => n.id === parentId);
  if (!parent) return;
  const parentRem = Number(parent.fraction);
  if (parentRem < 1 / 16) return;
  const share = parentRem / 4;
  for (let i = 0; i < 4; i += 1) {
    const grantee = nextGrantee();
    const { date, fileDate } = combinatorialDate(
      tract,
      40 + iteration,
      iteration + i
    );
    const childId = builder.addChild(parentId, share, {
      instrument: i % 2 === 0 ? 'Warranty Deed' : 'Special Warranty Deed',
      date,
      fileDate,
      grantor: parent.grantee,
      grantee,
      remarks: `${tract.name} one-quarter split ${i + 1}/4 to ${grantee}.`,
      numerator: '1',
      denominator: '4',
      conveyanceMode: 'fraction',
      splitBasis: 'initial',
    });
    if ((iteration + i) % 3 === 0) builder.assignPdf(childId);
  }
}

function clusterProbate(
  builder: StressBuilder,
  parentId: string,
  tract: CombinatorialTractPlan,
  iteration: number,
  nextGrantee: () => string
) {
  const parent = builder.nodes.find((n) => n.id === parentId);
  if (!parent) return;
  const parentRem = Number(parent.fraction);
  if (parentRem < 1 / 16) return;
  const { date, fileDate } = combinatorialDate(tract, 55 + iteration, iteration);
  builder.markDeceased(parentId, `Passed away ${date} in a tragic paperwork accident.`);
  const dcId = builder.addRelated(parentId, {
    instrument: 'Death Certificate',
    date,
    fileDate,
    grantee: parent.grantee,
    remarks: `${tract.name} death certificate for ${parent.grantee}.`,
  });
  builder.assignPdf(dcId);
  const aohId = builder.addRelated(parentId, {
    instrument: 'Affidavit of Heirship',
    date: addDaysToIso(date, 60),
    fileDate: addDaysToIso(fileDate, 60),
    grantee: parent.grantee,
    remarks: `${tract.name} heirship affidavit identifying two surviving heirs.`,
  });
  if (iteration % 2 === 0) builder.assignPdf(aohId);
  const willId = builder.addRelated(parentId, {
    instrument: 'Will',
    date: addDaysToIso(date, 90),
    fileDate: addDaysToIso(fileDate, 90),
    grantee: parent.grantee,
    remarks: `${tract.name} will admitted to probate.`,
  });
  if (iteration % 3 === 0) builder.assignPdf(willId);
  // Heirs inherit via probate, each taking half of the remaining fraction.
  const share = parentRem / 2;
  for (let i = 0; i < 2; i += 1) {
    const heir = nextGrantee();
    const probateId = builder.addChild(parentId, share, {
      instrument: 'Probate',
      date: addDaysToIso(date, 180),
      fileDate: addDaysToIso(fileDate, 180),
      grantor: `Estate of ${parent.grantee}`,
      grantee: heir,
      remarks: `${tract.name} probate distribution of one-half to ${heir}.`,
      numerator: '1',
      denominator: '2',
      conveyanceMode: 'fraction',
      splitBasis: 'initial',
    });
    if ((iteration + i) % 2 === 0) builder.assignPdf(probateId);
  }
}

function hasNpriOfKind(
  builder: StressBuilder,
  parentId: string,
  kind: 'fixed' | 'floating'
): boolean {
  return builder.nodes.some(
    (n) =>
      n.parentId === parentId
      && n.interestClass === 'npri'
      && n.royaltyKind === kind
  );
}

function clusterFixedNpri(
  builder: StressBuilder,
  parentId: string,
  tract: CombinatorialTractPlan,
  iteration: number,
  nextGrantee: () => string
) {
  const parent = builder.nodes.find((n) => n.id === parentId);
  if (!parent) return;
  // Cap NPRIs at one fixed cluster per parent. Multiple cluster runs on the
  // same parent would stack royalty burdens past 100% (physically impossible).
  // Skipping here lets the while-loop rotate to a fresh parent on the next
  // iteration so every NPRI landed is economically sound.
  if (hasNpriOfKind(builder, parentId, 'fixed')) return;
  // NPRIs don't deduct from the parent; the parent's mineral ownership is unchanged.
  const shares = [1 / 16, 1 / 32];
  for (let i = 0; i < shares.length; i += 1) {
    const grantee = nextGrantee();
    const { date, fileDate } = combinatorialDate(
      tract,
      35 + iteration,
      iteration + i
    );
    const npriId = pushNpriChild(builder, parentId, {
      share: shares[i],
      royaltyKind: 'fixed',
      fixedRoyaltyBasis: 'whole_tract',
      grantor: parent.grantee,
      grantee,
      instrument: 'Royalty Deed',
      date,
      fileDate,
      remarks: `${tract.name} fixed NPRI of ${
        shares[i] === 1 / 16 ? '1/16' : '1/32'
      } of the whole reserved by ${grantee}.`,
    });
    if ((iteration + i) % 2 === 0) builder.assignPdf(npriId);
  }
}

function clusterFloatingNpri(
  builder: StressBuilder,
  parentId: string,
  tract: CombinatorialTractPlan,
  iteration: number,
  nextGrantee: () => string
) {
  const parent = builder.nodes.find((n) => n.id === parentId);
  if (!parent) return;
  // Same cap as fixed NPRI — one floating cluster per parent. 1/2 + 1/4 of
  // lease royalty already consumes 3/4 of the lessor's royalty stream, so
  // stacking another cluster on top would over-carve the royalty interest.
  if (hasNpriOfKind(builder, parentId, 'floating')) return;
  const shares: Array<[number, string]> = [
    [1 / 2, '1/2 of lease royalty'],
    [1 / 4, '1/4 of lease royalty'],
  ];
  for (let i = 0; i < shares.length; i += 1) {
    const [share, label] = shares[i];
    const grantee = nextGrantee();
    const { date, fileDate } = combinatorialDate(
      tract,
      37 + iteration,
      iteration + i
    );
    const npriId = pushNpriChild(builder, parentId, {
      share,
      royaltyKind: 'floating',
      grantor: parent.grantee,
      grantee,
      instrument: 'Royalty Deed',
      date,
      fileDate,
      remarks: `${tract.name} floating NPRI (${label}) reserved by ${grantee}.`,
    });
    if ((iteration + i) % 3 === 0) builder.assignPdf(npriId);
  }
}

function clusterCorrectionAndRelease(
  builder: StressBuilder,
  parentId: string,
  tract: CombinatorialTractPlan,
  iteration: number,
  nextGrantee: () => string
) {
  const parent = builder.nodes.find((n) => n.id === parentId);
  if (!parent) return;
  const parentRem = Number(parent.fraction);
  if (parentRem < 1 / 16) return;
  const { date, fileDate } = combinatorialDate(tract, 60 + iteration, iteration);
  // A quitclaim transferring the whole remaining fraction to a new grantee...
  const newGrantee = nextGrantee();
  const quitclaimId = builder.addChild(parentId, parentRem, {
    instrument: 'Quitclaim Deed',
    date,
    fileDate,
    grantor: parent.grantee,
    grantee: newGrantee,
    remarks: `${tract.name} quitclaim deed conveying residual interest of ${parent.grantee} to ${newGrantee}.`,
    numerator: '1',
    denominator: '1',
    conveyanceMode: 'fraction',
    splitBasis: 'remaining',
  });
  if (iteration % 2 === 0) builder.assignPdf(quitclaimId);
  // ...and a correction deed and release as related documents beneath it.
  const correctionId = builder.addRelated(quitclaimId, {
    instrument: 'Correction Deed',
    date: addDaysToIso(date, 30),
    fileDate: addDaysToIso(fileDate, 30),
    grantee: newGrantee,
    remarks: `${tract.name} correction deed fixing scrivener's error in the quitclaim.`,
  });
  if (iteration % 3 === 0) builder.assignPdf(correctionId);
  const releaseId = builder.addRelated(quitclaimId, {
    instrument: 'Release',
    date: addDaysToIso(date, 120),
    fileDate: addDaysToIso(fileDate, 120),
    grantee: newGrantee,
    remarks: `${tract.name} release of prior lien or encumbrance.`,
  });
  if (iteration % 4 === 0) builder.assignPdf(releaseId);
}

function clusterRoyaltyDeed(
  builder: StressBuilder,
  parentId: string,
  tract: CombinatorialTractPlan,
  iteration: number,
  nextGrantee: () => string
) {
  const parent = builder.nodes.find((n) => n.id === parentId);
  if (!parent) return;
  const parentRem = Number(parent.fraction);
  if (parentRem < 1 / 16) return;
  const share = parentRem / 4;
  const grantee = nextGrantee();
  const { date, fileDate } = combinatorialDate(tract, 45 + iteration, iteration);
  // Label the stored share honestly. With share = parentRem/4 and parentRem
  // drawn from a power-of-2 mineral chain, the share lands on 1/4, 1/8, 1/16,
  // 1/32, etc. Pick the closest 1/N label so the remarks and the stored
  // fraction agree (this is purely cosmetic — math is driven by `share`).
  const labeledDenom = Math.max(1, Math.round(1 / share));
  const shareLabel = `1/${labeledDenom}`;
  const rdId = builder.addChild(parentId, share, {
    instrument: 'Royalty Deed',
    date,
    fileDate,
    grantor: parent.grantee,
    grantee,
    remarks: `${tract.name} royalty-deed carve-out of ${shareLabel} of the parent's remaining interest (one-quarter of ${parent.grantee}'s share) to ${grantee}.`,
    numerator: '1',
    denominator: '4',
    conveyanceMode: 'fraction',
    splitBasis: 'initial',
  });
  if (iteration % 2 === 0) builder.assignPdf(rdId);
}

function clusterDeepWarrantyChain(
  builder: StressBuilder,
  parentId: string,
  tract: CombinatorialTractPlan,
  iteration: number,
  nextGrantee: () => string
) {
  const parent = builder.nodes.find((n) => n.id === parentId);
  if (!parent) return;
  let currentParent = parentId;
  let currentGrantor = parent.grantee;
  let currentRem = Number(parent.fraction);
  for (let i = 0; i < 3; i += 1) {
    if (currentRem < 1 / 32) break;
    const share = currentRem / 2;
    const grantee = nextGrantee();
    const { date, fileDate } = combinatorialDate(
      tract,
      50 + iteration + i * 4,
      iteration + i
    );
    const childId = builder.addChild(currentParent, share, {
      instrument: i % 2 === 0 ? 'Warranty Deed' : 'Mineral Deed',
      date,
      fileDate,
      grantor: currentGrantor,
      grantee,
      remarks: `${tract.name} deep chain generation ${i + 1} — half of remaining to ${grantee}.`,
      numerator: '1',
      denominator: '2',
      conveyanceMode: 'fraction',
      splitBasis: 'initial',
    });
    if ((iteration + i) % 3 === 0) builder.assignPdf(childId);
    currentParent = childId;
    currentGrantor = grantee;
    currentRem = share;
  }
}

function addCombinatorialLease(
  builder: StressBuilder,
  leaseOverrides: Map<string, Partial<OwnerWorkspaceData['leases'][number]>>,
  {
    parentId,
    tract,
    royalty,
    lessee,
    effectiveDate,
    fileDate,
    notes,
    markPdf,
  }: {
    parentId: string;
    tract: CombinatorialTractPlan;
    royalty: string;
    lessee: string;
    effectiveDate: string;
    fileDate: string;
    notes: string;
    markPdf: boolean;
  }
): string | null {
  const parent = builder.nodes.find((n) => n.id === parentId);
  if (!parent) return null;
  const parentRem = Number(parent.fraction);
  if (parentRem <= 0) return null;
  const leaseId = builder.addRelated(parentId, {
    relatedKind: 'lease',
    instrument: 'Oil & Gas Lease',
    date: effectiveDate,
    fileDate,
    grantor: parent.grantee,
    grantee: lessee,
    remarks: `${tract.name} lease covering ${parent.grantee}'s remaining fraction at ${royalty} royalty.`,
  });
  leaseOverrides.set(leaseId, {
    royaltyRate: royalty,
    leasedInterest: parent.fraction,
    leaseName: `${tract.name} — ${parent.grantee} Lease`,
    notes,
  });
  if (markPdf) builder.assignPdf(leaseId);
  return leaseId;
}

/**
 * Iterate over the fertile present-owner leaves of a tract and add leases at
 * mixed royalty rates. The first-pass lease uses the tract's primary royalty;
 * follow-on leases cycle through a small ladder so the unit ends up with a
 * realistic mix. Also handles the "top-lease" overlap scenario when the tract
 * flavor requests it.
 */
function addCombinatorialLeasesToLeaves(
  builder: StressBuilder,
  leaseOverrides: Map<string, Partial<OwnerWorkspaceData['leases'][number]>>,
  tract: CombinatorialTractPlan,
  tractNodeIds: Set<string>
) {
  const ROYALTY_LADDER = ['1/8', '3/16', '1/4', '1/5'];
  const fertileLeaves = builder.nodes.filter(
    (node) =>
      tractNodeIds.has(node.id)
      && node.type === 'conveyance'
      && node.interestClass === 'mineral'
      && Number(node.fraction) > 0
  );
  let leaseIndex = 0;
  for (const leaf of fertileLeaves) {
    const hasExistingLease = builder.nodes.some(
      (node) =>
        node.parentId === leaf.id
        && node.type === 'related'
        && node.relatedKind === 'lease'
    );
    if (hasExistingLease) continue;
    const royalty =
      leaseIndex === 0 ? tract.primaryRoyalty : ROYALTY_LADDER[leaseIndex % ROYALTY_LADDER.length];
    const monthSeq = String(((leaseIndex * 3) % 12) + 1).padStart(2, '0');
    addCombinatorialLease(builder, leaseOverrides, {
      parentId: leaf.id,
      tract,
      royalty,
      lessee: PRIMARY_TEST_LESSEE,
      effectiveDate: `2024-${monthSeq}-01`,
      fileDate: `2024-${monthSeq}-12`,
      notes: `${tract.description}`,
      markPdf: leaseIndex % 3 === 0,
    });
    leaseIndex += 1;
  }

  // Top-lease overlap — only for tracts that request it.
  if (tract.flavor === 'lease_overlap' || tract.flavor === 'kitchen_sink') {
    const topLeaseTarget = fertileLeaves[0];
    if (topLeaseTarget) {
      addCombinatorialLease(builder, leaseOverrides, {
        parentId: topLeaseTarget.id,
        tract,
        royalty: '1/4',
        lessee: 'Salt Fork Top-Lease Partners, LLC',
        effectiveDate: '2025-06-01',
        fileDate: '2025-06-15',
        notes: `Top-lease intentionally overlapping the original lease on ${topLeaseTarget.grantee}; should trigger the desk-map and leasehold overlap warning surface.`,
        markPdf: true,
      });
    }
  }
}

function buildCombinatorialTract(
  builder: StressBuilder,
  leaseOverrides: Map<string, Partial<OwnerWorkspaceData['leases'][number]>>,
  tract: CombinatorialTractPlan
) {
  const beforeCount = builder.nodes.length;
  const nextGrantee = createCombinatorialGranteeGenerator(tract);
  const patentId = builder.addRoot(tract.landDesc, tract.patentGrantee, tract.patentYear);
  builder.assignPdf(patentId);

  // First-level: split the patent cleanly into 2 branches at 1/2 each so
  // every tract has at least two root generation branches to hang clusters off.
  const rootSplitShare = 0.5;
  const topBranchIds: string[] = [];
  for (let i = 0; i < 2; i += 1) {
    const grantee = nextGrantee();
    const { date, fileDate } = combinatorialDate(tract, 25, i);
    const id = builder.addChild(patentId, rootSplitShare, {
      instrument: 'Warranty Deed',
      date,
      fileDate,
      grantor: tract.patentGrantee,
      grantee,
      remarks: `${tract.name} root generation branch ${i + 1} of 2 — one-half of the patent.`,
      numerator: '1',
      denominator: '2',
      conveyanceMode: 'fraction',
      splitBasis: 'initial',
    });
    if (i === 0) builder.assignPdf(id);
    topBranchIds.push(id);
  }

  // Flavor-weighted cluster round: each tract runs a weighted rotation of
  // cluster patterns so its designated flavor is represented more densely,
  // but every tract still touches every pattern at least once.
  const FLAVOR_CYCLES: Record<CombinatorialTractPlan['flavor'], ClusterRunner[]> = {
    baseline_splits: [
      clusterSplitPair,
      clusterQuarterFan,
      clusterDeepWarrantyChain,
      clusterSplitPair,
      clusterQuarterFan,
      clusterProbate,
      clusterFixedNpri,
      clusterCorrectionAndRelease,
      clusterRoyaltyDeed,
      clusterFloatingNpri,
    ],
    probate_heirship: [
      clusterProbate,
      clusterSplitPair,
      clusterProbate,
      clusterDeepWarrantyChain,
      clusterProbate,
      clusterQuarterFan,
      clusterCorrectionAndRelease,
      clusterFixedNpri,
      clusterRoyaltyDeed,
      clusterFloatingNpri,
    ],
    fixed_npri: [
      clusterFixedNpri,
      clusterSplitPair,
      clusterFixedNpri,
      clusterQuarterFan,
      clusterFixedNpri,
      clusterRoyaltyDeed,
      clusterDeepWarrantyChain,
      clusterProbate,
      clusterCorrectionAndRelease,
      clusterFloatingNpri,
    ],
    floating_npri: [
      clusterFloatingNpri,
      clusterSplitPair,
      clusterFloatingNpri,
      clusterDeepWarrantyChain,
      clusterFloatingNpri,
      clusterQuarterFan,
      clusterFixedNpri,
      clusterProbate,
      clusterCorrectionAndRelease,
      clusterRoyaltyDeed,
    ],
    correction_release: [
      clusterCorrectionAndRelease,
      clusterSplitPair,
      clusterCorrectionAndRelease,
      clusterQuarterFan,
      clusterCorrectionAndRelease,
      clusterDeepWarrantyChain,
      clusterProbate,
      clusterFixedNpri,
      clusterRoyaltyDeed,
      clusterFloatingNpri,
    ],
    royalty_deeds: [
      clusterRoyaltyDeed,
      clusterSplitPair,
      clusterRoyaltyDeed,
      clusterQuarterFan,
      clusterRoyaltyDeed,
      clusterProbate,
      clusterDeepWarrantyChain,
      clusterFixedNpri,
      clusterCorrectionAndRelease,
      clusterFloatingNpri,
    ],
    lease_overlap: [
      clusterSplitPair,
      clusterQuarterFan,
      clusterDeepWarrantyChain,
      clusterSplitPair,
      clusterProbate,
      clusterCorrectionAndRelease,
      clusterFixedNpri,
      clusterRoyaltyDeed,
      clusterFloatingNpri,
      clusterQuarterFan,
    ],
    kitchen_sink: [
      clusterSplitPair,
      clusterProbate,
      clusterFixedNpri,
      clusterFloatingNpri,
      clusterCorrectionAndRelease,
      clusterRoyaltyDeed,
      clusterDeepWarrantyChain,
      clusterQuarterFan,
      clusterSplitPair,
      clusterProbate,
    ],
  };
  const cycle = FLAVOR_CYCLES[tract.flavor];

  // Run the cycle until the tract hits its target node count.
  let iteration = 0;
  let safetyFuse = 0;
  const maxIterations = 400;
  while (
    builder.nodes.length - beforeCount < COMBINATORIAL_TARGET_NODES_PER_TRACT
    && safetyFuse < maxIterations
  ) {
    // Pick a fertile mineral-class parent inside this tract.
    const candidates = builder.nodes.filter(
      (node) =>
        node.landDesc === tract.landDesc
        && node.type === 'conveyance'
        && node.interestClass === 'mineral'
        && Number(node.fraction) >= 1 / 32
    );
    if (candidates.length === 0) break;
    // Rotate through candidates deterministically so we don't over-split one branch.
    const parent = candidates[iteration % candidates.length];
    const cluster = cycle[iteration % cycle.length];
    cluster(builder, parent.id, tract, iteration, nextGrantee);
    iteration += 1;
    safetyFuse += 1;
  }

  // Collect the ids of every node belonging to this tract (by landDesc).
  const tractNodeIds = new Set(
    builder.nodes
      .filter((node) => node.landDesc === tract.landDesc)
      .map((node) => node.id)
  );

  // Leases overlay on every fertile leaf.
  addCombinatorialLeasesToLeaves(builder, leaseOverrides, tract, tractNodeIds);
}

export function buildCombinatorialWorkspaceData(): {
  workspaceId: string;
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  leaseholdUnit: LeaseholdUnit;
  leaseholdAssignments: LeaseholdAssignment[];
  leaseholdOrris: LeaseholdOrri[];
  leaseholdTransferOrderEntries: LeaseholdTransferOrderEntry[];
  activeDeskMapId: string | null;
  instrumentTypes: string[];
  pdfMappings: PdfMapping[];
  ownerData: OwnerWorkspaceData;
} {
  const workspaceId = createWorkspaceId();
  const builder = new StressBuilder();
  const leaseOverrides = new Map<
    string,
    Partial<OwnerWorkspaceData['leases'][number]>
  >();

  for (const tract of COMBINATORIAL_TRACTS) {
    buildCombinatorialTract(builder, leaseOverrides, tract);
  }

  const finalizedNodes = finalizeGeneratedNodes(builder.nodes, { humorousDeaths: false });
  const { nodes, ownerData } = buildSeedOwnerWorkspaceData(
    workspaceId,
    finalizedNodes,
    `Combinatorial Demo — ${COMBINATORIAL_TRACTS.length} Tracts`,
    { leaseOverridesByNodeId: leaseOverrides }
  );
  const ts = Date.now();

  const deskMaps = COMBINATORIAL_TRACTS.map((tract, index) => ({
    id: `dm-combinatorial-${index + 1}-${ts}`,
    name: tract.name,
    code: tract.code,
    tractId: tract.code,
    grossAcres: tract.grossAcres,
    pooledAcres: tract.pooledAcres,
    description: tract.description,
    nodeIds: getTractNodes(nodes, tract.landDesc).map((node) => node.id),
  }));
  const deskMapIdByCode = new Map(deskMaps.map((deskMap) => [deskMap.code, deskMap.id]));

  // ORRIs — cover every basis and both scope levels.
  const leaseholdOrris: LeaseholdOrri[] = [
    {
      id: 'combinatorial-orri-1',
      payee: 'Prairie Vista Override, LP',
      scope: 'unit',
      deskMapId: null,
      burdenFraction: '1/32',
      burdenBasis: 'gross_8_8',
      effectiveDate: '2024-02-01',
      sourceDocNo: 'CB-ORRI-1',
      notes: 'Unit-wide gross 8/8 ORRI covering every tract.',
    },
    {
      id: 'combinatorial-orri-2',
      payee: 'Salt Fork Royalty Partners',
      scope: 'unit',
      deskMapId: null,
      burdenFraction: '1/64',
      burdenBasis: 'net_revenue_interest',
      effectiveDate: '2024-02-15',
      sourceDocNo: 'CB-ORRI-2',
      notes: 'Unit-wide NRI-basis ORRI for stacking-order review.',
    },
    {
      id: 'combinatorial-orri-3',
      payee: 'Llano Working Interest Override LLC',
      scope: 'unit',
      deskMapId: null,
      burdenFraction: '1/80',
      burdenBasis: 'working_interest',
      effectiveDate: '2024-03-01',
      sourceDocNo: 'CB-ORRI-3',
      notes: 'Unit-wide WI-basis ORRI (note: see audit finding #2 on the WI-basis convention).',
    },
    {
      id: 'combinatorial-orri-4',
      payee: 'Pecos Override Co.',
      scope: 'tract',
      deskMapId: deskMapIdByCode.get('C6') ?? null,
      burdenFraction: '1/16',
      burdenBasis: 'gross_8_8',
      effectiveDate: '2024-04-10',
      sourceDocNo: 'CB-ORRI-4',
      notes: 'Tract-scope gross 8/8 ORRI on Tract 6 (royalty-deed flavor).',
    },
    {
      id: 'combinatorial-orri-5',
      payee: 'Brazos Bend Overrides, LP',
      scope: 'tract',
      deskMapId: deskMapIdByCode.get('C8') ?? null,
      burdenFraction: '1/128',
      burdenBasis: 'net_revenue_interest',
      effectiveDate: '2024-05-20',
      sourceDocNo: 'CB-ORRI-5',
      notes: 'Tract-scope NRI-basis ORRI on Tract 8 (kitchen sink).',
    },
  ];

  // Assignments — cover unit and tract scope, with varying WI fractions.
  const leaseholdAssignments: LeaseholdAssignment[] = [
    {
      id: 'combinatorial-assignment-1',
      assignor: PRIMARY_TEST_LESSEE,
      assignee: 'Caprock Resources, LLC',
      scope: 'unit',
      deskMapId: null,
      workingInterestFraction: '1/2',
      effectiveDate: '2024-03-01',
      sourceDocNo: 'CB-ASG-1',
      notes: 'Unit-wide 50% working-interest assignment to Caprock Resources.',
    },
    {
      id: 'combinatorial-assignment-2',
      assignor: PRIMARY_TEST_LESSEE,
      assignee: 'Rio Draw Operating Co.',
      scope: 'tract',
      deskMapId: deskMapIdByCode.get('C6') ?? null,
      workingInterestFraction: '1/4',
      effectiveDate: '2024-04-01',
      sourceDocNo: 'CB-ASG-2',
      notes: 'Tract-scope 25% WI assignment on Tract 6.',
    },
    {
      id: 'combinatorial-assignment-3',
      assignor: PRIMARY_TEST_LESSEE,
      assignee: 'Staked Plains Minerals',
      scope: 'tract',
      deskMapId: deskMapIdByCode.get('C8') ?? null,
      workingInterestFraction: '1/8',
      effectiveDate: '2024-05-01',
      sourceDocNo: 'CB-ASG-3',
      notes: 'Tract-scope 12.5% WI assignment on Tract 8 (kitchen sink).',
    },
  ];

  const leaseholdUnit: LeaseholdUnit = {
    name: 'Combinatorial Test Unit',
    description:
      'Eight-tract combinatorial test unit covering every conveyance scenario a Texas landman regularly encounters.',
    operator: PRIMARY_TEST_LESSEE,
    effectiveDate: '2024-01-01',
    jurisdiction: 'tx_fee',
  };

  return {
    workspaceId,
    projectName: `Combinatorial Demo — ${deskMaps.length} Tracts (${builder.nodes.length} nodes)`,
    nodes,
    deskMaps,
    leaseholdUnit,
    leaseholdAssignments,
    leaseholdOrris,
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: deskMaps[0]?.id ?? null,
    instrumentTypes: [...STRESS_INSTRUMENT_TYPES],
    pdfMappings: builder.pdfMappings,
    ownerData,
  };
}

export async function seedCombinatorialData(): Promise<{
  nodeCount: number;
  pdfCount: number;
}> {
  const workspace = buildCombinatorialWorkspaceData();

  useWorkspaceStore.getState().loadWorkspace({
    workspaceId: workspace.workspaceId,
    projectName: workspace.projectName,
    nodes: workspace.nodes,
    deskMaps: workspace.deskMaps,
    leaseholdUnit: workspace.leaseholdUnit,
    leaseholdAssignments: workspace.leaseholdAssignments,
    leaseholdOrris: workspace.leaseholdOrris,
    leaseholdTransferOrderEntries: workspace.leaseholdTransferOrderEntries,
    activeDeskMapId: workspace.activeDeskMapId,
    instrumentTypes: workspace.instrumentTypes,
  });
  await Promise.all([
    useOwnerStore.getState().replaceWorkspaceData(
      workspace.workspaceId,
      workspace.ownerData
    ),
    useMapStore.getState().setWorkspace(workspace.workspaceId),
  ]);

  let pdfCount = 0;
  const failedPdfNodeIds: string[] = [];
  for (const mapping of workspace.pdfMappings) {
    const ok = await attachPdf(mapping.nodeId, mapping.fileName);
    if (ok) {
      pdfCount++;
    } else {
      failedPdfNodeIds.push(mapping.nodeId);
    }
  }

  if (failedPdfNodeIds.length > 0) {
    for (const failedNodeId of failedPdfNodeIds) {
      useWorkspaceStore.getState().updateNode(failedNodeId, { hasDoc: false });
    }
  }

  console.log(
    `[combinatorial] Built ${workspace.nodes.length} nodes, attached ${pdfCount} PDFs, ${workspace.deskMaps.length} desk maps`
  );
  return { nodeCount: workspace.nodes.length, pdfCount };
}
