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
import { useCurativeStore } from '../store/curative-store';
import { useResearchStore } from '../store/research-store';
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
import {
  buildRavenForestFederalLeases,
  clearFederalLeaseDocuments,
  registerFederalLeaseDocuments,
} from './federal-lease-seed';

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

function markNodePdfMetadata(
  nodes: OwnershipNode[],
  nodeId: string,
  fileName: string
): void {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return;
  node.hasDoc = true;
  node.docFileName = fileName;
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
  const ownerIdByNameKey = new Map<string, string>();
  const ownerSourceById = new Map<string, { node: OwnershipNode; index: number }>();

  const nodesWithOwners = nodes.map((node, index) => {
    if (!hasPositiveFraction(node)) {
      return node;
    }

    const ownerName = node.grantee.trim();
    const nameKey = ownerName ? slugify(ownerName) : `${slugify(node.id)}-${index + 1}`;
    let ownerId = ownerIdByNameKey.get(nameKey);
    if (!ownerId) {
      ownerId = `owner-${nameKey || slugify(node.id)}-${ownerIdByNameKey.size + 1}`;
      ownerIdByNameKey.set(nameKey, ownerId);
      ownerSourceById.set(ownerId, { node, index });
    }

    return {
      ...node,
      linkedOwnerId: ownerId,
    };
  });

  const owners = [...ownerSourceById.entries()].map(([ownerId, source]) => {
    const node = source.node;
    const matchingNodes = nodesWithOwners.filter(
      (candidate) => candidate.linkedOwnerId === ownerId
    );
    const linkedTractNotes = matchingNodes
      .map((candidate) => candidate.landDesc)
      .filter((landDesc, index, all) => landDesc && all.indexOf(landDesc) === index)
      .map((landDesc) => `Linked tract: ${landDesc}`);

    return createBlankOwner(workspaceId, {
      id: ownerId,
      name: node.grantee || `Owner ${source.index + 1}`,
      county: countyFromLandDesc(node.landDesc),
      prospect: projectName,
      notes: [
        node.instrument ? `Source Instrument: ${node.instrument}` : '',
        node.docNo ? `Doc #: ${node.docNo}` : '',
        ...linkedTractNotes,
      ]
        .filter(Boolean)
        .join('\n'),
      createdAt: toIsoTimestamp(node.fileDate || node.date),
      updatedAt: toIsoTimestamp(node.fileDate || node.date),
    });
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
    const file = await createBundledDeskMapPdfFile(
      `${nodeId}:${fileName}`,
      fileName
    );
    const attachment = await savePdf(nodeId, file);
    useWorkspaceStore.getState().updateNode(nodeId, {
      hasDoc: true,
      docFileName: attachment.fileName,
    });
    return true;
  } catch (err) {
    console.warn(`[seed] Failed to attach ${fileName}:`, err);
    return false;
  }
}

async function resetWorkspaceSideStores(
  workspaceId: string,
  ownerData: OwnerWorkspaceData
) {
  await Promise.all([
    useOwnerStore.getState().replaceWorkspaceData(workspaceId, ownerData),
    useMapStore.getState().setWorkspace(workspaceId),
    useCurativeStore.getState().replaceWorkspaceData(workspaceId, {
      titleIssues: [],
    }),
    useResearchStore.getState().replaceWorkspaceData(workspaceId, {
      imports: [],
      sources: [],
      formulas: [],
      projectRecords: [],
      questions: [],
    }),
  ]);
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
    markNodePdfMetadata(nodes, mapping.nodeId, mapping.fileName);
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
  await resetWorkspaceSideStores(workspaceId, ownerData);

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
      useWorkspaceStore.getState().updateNode(failedNodeId, {
        hasDoc: false,
        docFileName: '',
      });
    }
  }

  return { nodeCount: nodes.length, pdfCount };
}

// ═══════════════════════════════════════════════════════════
// Demo instrument palette + PDF pool (shared by the combinatorial seed)
// ═══════════════════════════════════════════════════════════

const DEMO_INSTRUMENT_TYPES = [
  'Patent', 'Warranty Deed', 'Mineral Deed', 'Royalty Deed',
  'Special Warranty Deed', 'Oil & Gas Lease', 'Probate', 'Affidavit of Heirship',
  'Surface Use Agreement',
  'Death Certificate', 'Quitclaim Deed', 'Correction Deed', 'Release',
  'Will', 'Order',
];

const DEMO_PDFS = [
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

/**
 * Builder used by the combinatorial seed to incrementally assemble a
 * deterministic tract: tracks remaining mineral fractions per parent, pops
 * one PDF at a time from the shared demo pool, and produces sequential
 * doc numbers so combinatorial outputs stay deterministic across runs.
 *
 * Named `StressBuilder` for historical reasons — the combinatorial seed
 * reuses the same pattern that previously drove the stress fixture.
 */
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
    if (this.pdfIdx >= DEMO_PDFS.length) return;
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      markNodePdfMetadata(this.nodes, nodeId, DEMO_PDFS[this.pdfIdx]);
      this.pdfMappings.push({ nodeId, fileName: DEMO_PDFS[this.pdfIdx++] });
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

function getTractNodes(nodes: OwnershipNode[], landDesc: string): OwnershipNode[] {
  return nodes.filter((node) => node.landDesc === landDesc);
}

// ═══════════════════════════════════════════════════════════
// Combinatorial fixture — 10 tracts, Raven Forest prospect
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
    | 'over_conveyance'
    | 'kitchen_sink';
  /** Raven Forest pooled-unit grouping. */
  unitName: string;
  unitCode: string;
  /** Target node count — varies per tract so the dataset has realistic variety. */
  targetNodes: number;
  /** Lessee name for leases generated on this tract. */
  lessee: string;
}

const UNIT_A_LESSEE = 'Texas Energy Acquisitions LP';
const UNIT_B_LESSEE = 'Lone Star Minerals LLC';

const COMBINATORIAL_TRACTS: CombinatorialTractPlan[] = [
  // ── Unit A — Walker County, TX (Sam Houston NF) ─────────────
  {
    name: 'C1 — Baseline Splits',
    code: 'C1',
    grossAcres: '160',
    pooledAcres: '160',
    description:
      'Clean 1/2, 1/4, 1/8 warranty-deed chain with simple power-of-2 splits and leases at 1/8 royalty.',
    landDesc: 'J. Walker Survey, Abstract 42, Walker County, Texas',
    patentYear: 1856,
    patentGrantee: 'Harold Whitaker',
    primaryRoyalty: '1/8',
    surnames: ['Whitaker', 'Bennett', 'Parker', 'Collins', 'Hayes', 'Foster', 'Mercer', 'Lawson'],
    flavor: 'baseline_splits',
    unitName: 'Raven Forest Unit A',
    unitCode: 'A',
    targetNodes: 60,
    lessee: UNIT_A_LESSEE,
  },
  {
    name: 'C2 — Probate & Heirship',
    code: 'C2',
    grossAcres: '240',
    pooledAcres: '240',
    description:
      'Multi-generation death certificate, affidavit of heirship, will, and probate chains feeding the present owners.',
    landDesc: 'S. Houston Survey, Abstract 71, Walker County, Texas',
    patentYear: 1858,
    patentGrantee: 'Eleanor Sutton',
    primaryRoyalty: '1/8',
    surnames: ['Sutton', 'Baker', 'Fletcher', 'Morgan', 'Russell', 'Snyder', 'Keller', 'Preston'],
    flavor: 'probate_heirship',
    unitName: 'Raven Forest Unit A',
    unitCode: 'A',
    targetNodes: 80,
    lessee: UNIT_A_LESSEE,
  },
  {
    name: 'C3 — NPRI Discrepancy',
    code: 'C3',
    grossAcres: '320',
    pooledAcres: '320',
    description:
      'Fixed NPRIs at 1/16 and 1/32 of the whole stacked under a mineral chain — triggers NPRI-discrepancy warning on the desk map.',
    landDesc: 'I. Irwin Survey, Abstract 103, Walker County, Texas',
    patentYear: 1861,
    patentGrantee: 'Leonard Carlisle',
    primaryRoyalty: '1/8',
    surnames: ['Carlisle', 'Bishop', 'Kendall', 'Porter', 'Maddox', 'Dalton', 'Barrett', 'Holland'],
    flavor: 'fixed_npri',
    unitName: 'Raven Forest Unit A',
    unitCode: 'A',
    targetNodes: 90,
    lessee: UNIT_A_LESSEE,
  },
  {
    name: 'C4 — Floating NPRI',
    code: 'C4',
    grossAcres: '400',
    pooledAcres: '400',
    description:
      'Floating NPRIs at 1/2 and 1/4 of lease royalty with sibling fixed NPRIs for contrast and mixed royalty rates.',
    landDesc: 'B. Buckner Survey, Abstract 115, Walker County, Texas',
    patentYear: 1860,
    patentGrantee: 'Dorothy Langley',
    primaryRoyalty: '1/8',
    surnames: ['Langley', 'Whitman', 'Turner', 'Griffin', 'Hawkins', 'Brady', 'Sawyer', 'Monroe'],
    flavor: 'floating_npri',
    unitName: 'Raven Forest Unit A',
    unitCode: 'A',
    targetNodes: 100,
    lessee: UNIT_A_LESSEE,
  },
  {
    name: 'C5 — Corrections & Releases',
    code: 'C5',
    grossAcres: '480',
    pooledAcres: '480',
    description:
      'Quitclaims, correction deeds, and release instruments layered on a working warranty-deed chain.',
    landDesc: 'R. Rankin Survey, Abstract 128, Walker County, Texas',
    patentYear: 1862,
    patentGrantee: 'Stanley Rutledge',
    primaryRoyalty: '1/8',
    surnames: ['Rutledge', 'Donovan', 'Wheeler', 'Harrison', 'Farley', 'Patterson', 'Granger', 'Baxter'],
    flavor: 'correction_release',
    unitName: 'Raven Forest Unit A',
    unitCode: 'A',
    targetNodes: 110,
    lessee: UNIT_A_LESSEE,
  },
  // ── Unit B — Walker/Montgomery County line (Sam Houston NF) ─
  {
    name: 'C6 — Royalty Deeds + ORRI Deck',
    code: 'C6',
    grossAcres: '560',
    pooledAcres: '560',
    description:
      'Royalty-deed carve-outs on the mineral side plus unit-level ORRIs on all three basis types (gross 8/8, NRI, WI).',
    landDesc: 'T. Tobin Survey, Abstract 201, Walker County, Texas',
    patentYear: 1863,
    patentGrantee: 'Marjorie Caldwell',
    primaryRoyalty: '3/16',
    surnames: ['Caldwell', 'Carver', 'Kirkland', 'Sinclair', 'Atkins', 'Presley', 'Merrill', 'Thornton'],
    flavor: 'royalty_deeds',
    unitName: 'Raven Forest Unit B',
    unitCode: 'B',
    targetNodes: 120,
    lessee: UNIT_B_LESSEE,
  },
  {
    name: 'C7 — Over-conveyance',
    code: 'C7',
    grossAcres: '640',
    pooledAcres: '640',
    description:
      'Deliberate conveyances that sum past 100% on one branch, triggering the over-conveyance validation warning.',
    landDesc: 'M. McCoy Survey, Abstract 215, Montgomery County, Texas',
    patentYear: 1865,
    patentGrantee: 'Clarence Whitfield',
    primaryRoyalty: '3/16',
    surnames: ['Whitfield', 'Sherman', 'Ellison', 'McAllister', 'Benson', 'Campbell', 'Atwood', 'Sterling'],
    flavor: 'over_conveyance',
    unitName: 'Raven Forest Unit B',
    unitCode: 'B',
    targetNodes: 130,
    lessee: UNIT_B_LESSEE,
  },
  {
    name: 'C8 — Lease Overlap / Top-Lease',
    code: 'C8',
    grossAcres: '640',
    pooledAcres: '640',
    description:
      'Deliberate two-lease overlap on a present owner: an original lease and a later top-lease at a higher royalty.',
    landDesc: 'G. Grimes Survey, Abstract 230, Montgomery County, Texas',
    patentYear: 1867,
    patentGrantee: 'Agnes Hollister',
    primaryRoyalty: '3/16',
    surnames: ['Hollister', 'Bradford', 'Remington', 'Winslow', 'Chandler', 'Kensington', 'Stanford', 'Wellington'],
    flavor: 'lease_overlap',
    unitName: 'Raven Forest Unit B',
    unitCode: 'B',
    targetNodes: 140,
    lessee: UNIT_B_LESSEE,
  },
  {
    name: 'C9 — Orphan Node',
    code: 'C9',
    grossAcres: '320',
    pooledAcres: '320',
    description:
      'A correction-and-release tract with one deliberately broken parentId reference, triggering the orphan-node validation warning.',
    landDesc: 'W. Willis Survey, Abstract 244, Montgomery County, Texas',
    patentYear: 1868,
    patentGrantee: 'Frederick Grant',
    primaryRoyalty: '3/16',
    surnames: ['Grant', 'Ogden', 'Perry', 'Lawton', 'Hale', 'Corbin', 'Marsh', 'Drake'],
    flavor: 'correction_release',
    unitName: 'Raven Forest Unit B',
    unitCode: 'B',
    targetNodes: 80,
    lessee: UNIT_B_LESSEE,
  },
  {
    name: 'C10 — Kitchen Sink',
    code: 'C10',
    grossAcres: '640',
    pooledAcres: '640',
    description:
      'Every scenario in one tract: probate, NPRI (fixed + floating), correction, release, royalty deed, top-lease, and mixed-royalty unit leases.',
    landDesc: 'H. Henderson Survey, Abstract 260, Montgomery County, Texas',
    patentYear: 1870,
    patentGrantee: 'Beatrice Holloway',
    primaryRoyalty: '3/16',
    surnames: ['Holloway', 'Graves', 'Fielding', 'Norwood', 'Prescott', 'Stafford', 'Langdon', 'Waverly'],
    flavor: 'kitchen_sink',
    unitName: 'Raven Forest Unit B',
    unitCode: 'B',
    // Target is higher than other tracts but capped by fertile-parent availability
    // (the builder filters for fraction >= 1/32). The actual count will settle
    // around 200–250 including lease overlays — still 2–3× any other tract.
    targetNodes: 250,
    lessee: UNIT_B_LESSEE,
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

/**
 * Deliberately creates conveyances from a parent that sum to more than 100%,
 * triggering the over-conveyance validation warning. This is the only cluster
 * runner that intentionally violates the fraction budget — all others respect
 * parent remaining. Used exclusively on tract C7.
 */
function clusterOverConveyance(
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
  // Only inject the over-conveyance once per tract.
  const alreadyInjected = builder.nodes.some(
    (n) => n.landDesc === tract.landDesc && n.remarks.includes('over-conveyance trigger')
  );
  if (alreadyInjected) {
    // Fall through to a normal split pair.
    clusterSplitPair(builder, parentId, tract, iteration, nextGrantee);
    return;
  }
  // Convey 60% twice from the same parent — totals 120%.
  for (let i = 0; i < 2; i += 1) {
    const grantee = nextGrantee();
    const { date, fileDate } = combinatorialDate(tract, 70 + iteration, iteration + i);
    builder.addChild(parentId, parentRem * 0.6, {
      instrument: 'Mineral Deed',
      date,
      fileDate,
      grantor: parent.grantee,
      grantee,
      remarks: `${tract.name} over-conveyance trigger — 60% of ${parent.grantee}'s interest to ${grantee} (intentional).`,
      numerator: '3',
      denominator: '5',
      conveyanceMode: 'fraction',
      splitBasis: 'initial',
    });
  }
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
      lessee: tract.lessee,
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
    over_conveyance: [
      clusterOverConveyance,
      clusterSplitPair,
      clusterQuarterFan,
      clusterDeepWarrantyChain,
      clusterSplitPair,
      clusterProbate,
      clusterCorrectionAndRelease,
      clusterFixedNpri,
      clusterRoyaltyDeed,
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

  // Run the cycle until the tract hits its per-tract target node count.
  let iteration = 0;
  let safetyFuse = 0;
  const maxIterations = 2000;
  while (
    builder.nodes.length - beforeCount < tract.targetNodes
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

  // ── Post-build error injection ──────────────────────────────
  // C9 gets an orphan node whose parentId points to a nonexistent ID.
  if (tract.code === 'C9') {
    const orphanCandidate = builder.nodes.find(
      (n) =>
        n.landDesc === tract.landDesc
        && n.type === 'conveyance'
        && n.parentId !== null
        && Number(n.fraction) < 1 / 8
    );
    if (orphanCandidate) {
      orphanCandidate.parentId = 'missing-parent-orphan-trigger';
      orphanCandidate.remarks =
        `${tract.name} orphan node — parentId deliberately broken to trigger validation warning.`;
    }
  }
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
  activeUnitCode: string | null;
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

  const deskMaps: DeskMap[] = COMBINATORIAL_TRACTS.map((tract, index) => ({
    id: `dm-combinatorial-${index + 1}-${ts}`,
    name: tract.name,
    code: tract.code,
    tractId: tract.code,
    grossAcres: tract.grossAcres,
    pooledAcres: tract.pooledAcres,
    description: tract.description,
    nodeIds: getTractNodes(nodes, tract.landDesc).map((node) => node.id),
    unitName: tract.unitName,
    unitCode: tract.unitCode,
  }));
  const deskMapIdByCode = new Map(deskMaps.map((deskMap) => [deskMap.code, deskMap.id]));

  // ORRIs — cover every basis and both scope levels.
  const leaseholdOrris: LeaseholdOrri[] = [
    {
      id: 'combinatorial-orri-1',
      payee: 'Prairie Vista Override, LP',
      scope: 'unit',
      unitCode: 'A',
      deskMapId: null,
      burdenFraction: '1/32',
      burdenBasis: 'gross_8_8',
      effectiveDate: '2024-02-01',
      sourceDocNo: 'CB-ORRI-1',
      notes: 'Unit A gross 8/8 ORRI covering every Unit A tract.',
    },
    {
      id: 'combinatorial-orri-2',
      payee: 'Salt Fork Royalty Partners',
      scope: 'unit',
      unitCode: 'A',
      deskMapId: null,
      burdenFraction: '1/64',
      burdenBasis: 'net_revenue_interest',
      effectiveDate: '2024-02-15',
      sourceDocNo: 'CB-ORRI-2',
      notes: 'Unit A NRI-basis ORRI for stacking-order review.',
    },
    {
      id: 'combinatorial-orri-3',
      payee: 'Llano Working Interest Override LLC',
      scope: 'unit',
      unitCode: 'A',
      deskMapId: null,
      burdenFraction: '1/80',
      burdenBasis: 'working_interest',
      effectiveDate: '2024-03-01',
      sourceDocNo: 'CB-ORRI-3',
      notes: 'Unit A WI-basis ORRI.',
    },
    {
      id: 'combinatorial-orri-3b',
      payee: 'Pine Island Override, LP',
      scope: 'unit',
      unitCode: 'B',
      deskMapId: null,
      burdenFraction: '1/40',
      burdenBasis: 'gross_8_8',
      effectiveDate: '2024-03-15',
      sourceDocNo: 'CB-ORRI-3B',
      notes: 'Unit B gross 8/8 ORRI covering every Unit B tract.',
    },
    {
      id: 'combinatorial-orri-4',
      payee: 'Pecos Override Co.',
      scope: 'tract',
      unitCode: null,
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
      unitCode: null,
      deskMapId: deskMapIdByCode.get('C10') ?? null,
      burdenFraction: '1/128',
      burdenBasis: 'net_revenue_interest',
      effectiveDate: '2024-05-20',
      sourceDocNo: 'CB-ORRI-5',
      notes: 'Tract-scope NRI-basis ORRI on Tract 10 (kitchen sink).',
    },
  ];

  // Assignments — cover unit and tract scope, with varying WI fractions.
  const leaseholdAssignments: LeaseholdAssignment[] = [
    {
      id: 'combinatorial-assignment-1',
      assignor: UNIT_A_LESSEE,
      assignee: 'Caprock Resources, LLC',
      scope: 'unit',
      unitCode: 'A',
      deskMapId: null,
      workingInterestFraction: '1/2',
      effectiveDate: '2024-03-01',
      sourceDocNo: 'CB-ASG-1',
      notes: 'Unit A 50% working-interest assignment to Caprock Resources.',
    },
    {
      id: 'combinatorial-assignment-2',
      assignor: UNIT_B_LESSEE,
      assignee: 'Rio Draw Operating Co.',
      scope: 'tract',
      unitCode: null,
      deskMapId: deskMapIdByCode.get('C6') ?? null,
      workingInterestFraction: '1/4',
      effectiveDate: '2024-04-01',
      sourceDocNo: 'CB-ASG-2',
      notes: 'Tract-scope 25% WI assignment on Tract 6.',
    },
    {
      id: 'combinatorial-assignment-3',
      assignor: UNIT_B_LESSEE,
      assignee: 'Staked Plains Minerals',
      scope: 'tract',
      unitCode: null,
      deskMapId: deskMapIdByCode.get('C10') ?? null,
      workingInterestFraction: '1/8',
      effectiveDate: '2024-05-01',
      sourceDocNo: 'CB-ASG-3',
      notes: 'Tract-scope 12.5% WI assignment on Tract 10 (kitchen sink).',
    },
  ];

  const leaseholdUnit: LeaseholdUnit = {
    name: 'Raven Forest Unit',
    description:
      'Ten-tract Raven Forest prospect in Sam Houston National Forest (Walker/Montgomery counties, TX) with two pooled units of five tracts each.',
    operator: UNIT_A_LESSEE,
    effectiveDate: '2024-01-01',
    jurisdiction: 'tx_fee',
  };

  return {
    workspaceId,
    projectName: `Combinatorial Demo — Raven Forest (${deskMaps.length} Tracts, ${builder.nodes.length} nodes)`,
    nodes,
    deskMaps,
    leaseholdUnit,
    leaseholdAssignments,
    leaseholdOrris,
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: deskMaps[0]?.id ?? null,
    activeUnitCode: 'A',
    instrumentTypes: [...DEMO_INSTRUMENT_TYPES],
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
    activeUnitCode: workspace.activeUnitCode,
    instrumentTypes: workspace.instrumentTypes,
  });
  await resetWorkspaceSideStores(workspace.workspaceId, workspace.ownerData);

  // Seed Raven Forest federal lease inventory + register their BLM Form
  // 3100-11 documents so the LeaseDocumentModal has structured data to render.
  // Federal records are reference-only and intentionally do not feed Texas
  // leasehold or Desk Map math.
  clearFederalLeaseDocuments();
  const federal = buildRavenForestFederalLeases(workspace.workspaceId);
  registerFederalLeaseDocuments(federal.documents);
  for (const record of federal.records) {
    await useResearchStore.getState().addProjectRecord(record);
  }

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
      useWorkspaceStore.getState().updateNode(failedNodeId, {
        hasDoc: false,
        docFileName: '',
      });
    }
  }

  console.log(
    `[combinatorial] Built ${workspace.nodes.length} nodes, attached ${pdfCount} PDFs, ${workspace.deskMaps.length} desk maps`
  );
  return { nodeCount: workspace.nodes.length, pdfCount };
}
