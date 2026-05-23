/**
 * Vulcan Mesa — second demo fixture (alongside Raven Forest).
 *
 * Walker County, TX. One operator (Vulcan Mesa Petroleum, LLC) covers
 * two non-pooled units (Jupiter Flats — A, Minerva Draw — B) of five tracts
 * each. Designed as a teaching/test fixture: simple power-of-2 fractions, a
 * handful of "bridge" owners shared across multiple tracts in both units, and
 * intentionally-planted errors that should each trip a visible warning so the
 * user can spot and fix them.
 *
 * Planted errors are documented in `PLANTED_ERRORS` at the bottom of this
 * file — each entry names the warning surface it should trigger.
 */
import { useWorkspaceStore } from '../store/workspace-store';
import { createBlankNode, type OwnershipNode, type DeskMap } from '../types/node';
import type { OwnerWorkspaceData } from './owner-persistence';
import type {
  LeaseholdUnit,
  LeaseholdAssignment,
  LeaseholdOrri,
  LeaseholdTransferOrderEntry,
} from '../types/leasehold';
import { createWorkspaceId } from '../utils/workspace-id';
import {
  attachPdf,
  buildSeedOwnerWorkspaceData,
  DEMO_INSTRUMENT_TYPES,
  DEMO_PDFS,
  finalizeGeneratedNodes,
  resetWorkspaceSideStores,
  type PdfMapping,
} from './seed-test-data';

// ── Constants ───────────────────────────────────────────

const OPERATOR = 'Vulcan Mesa Petroleum, LLC';
const UNIT_A_NAME = 'Jupiter Flats Unit';
const UNIT_B_NAME = 'Minerva Draw Unit';

// Bridge owners — appear in multiple tracts across both units so the user can
// see how ownership records, leases, and roll-ups stay linked between
// prospects. Each is a different entity type so all three code paths are
// exercised at least once.
const BRIDGE = {
  cletus: { name: "Buster 'Janus' McGraw", entityType: 'Individual' },
  trust: {
    name: 'The Jupiter Flats Family Mineral Trust',
    entityType: 'Trust',
  },
  llc: { name: 'Vulcan Spur Holdings, LLC', entityType: 'LLC' },
  ophelia: { name: "Minerva 'Minnie' Pickens", entityType: 'Individual' },
} as const;

// ── Tract plan ──────────────────────────────────────────

type OwnerSpec = {
  /** Display name — bridge owners use the exact `BRIDGE[*].name` string so
   *  `buildSeedOwnerWorkspaceData` consolidates them into one record. */
  grantee: string;
  /** Mineral fraction of the whole tract — numerator/denominator pair. */
  num: number;
  den: number;
  docNo: string;
  deedDate: string;
};

type NpriSpec = {
  grantee: string;
  /** Royalty fraction of the whole tract (basis = whole_tract). */
  num: number;
  den: number;
  docNo: string;
  deedDate: string;
};

interface TractPlan {
  code: string; // VM1..VM10
  name: string;
  unitCode: 'A' | 'B';
  unitName: string;
  grossAcres: string;
  pooledAcres: string;
  landDesc: string;
  description: string;
  patentee: string;
  patentYear: number;
  /** Primary lease royalty applied to each owner's lease unless overridden. */
  primaryRoyalty: string;
  owners: OwnerSpec[];
  /** Optional fixed NPRIs hanging off the patent root. */
  fixedNpris?: NpriSpec[];
  /** Optional per-owner lease overrides keyed by grantee name (e.g. broken
   *  royalty rate to trigger an Input Error warning). */
  leaseOverridesByGrantee?: Record<
    string,
    Partial<{ royaltyRate: string; leaseName: string; notes: string }>
  >;
  /** Optional set of additional, intentionally-overlapping leases. Each entry
   *  adds a second lease on the named grantee's mineral interest. */
  topLeasesByGrantee?: Record<
    string,
    {
      lessee: string;
      royaltyRate: string;
      effectiveDate: string;
      notes: string;
    }
  >;
  /** When set, after building the normal owner conveyances, add `extra`
   *  oversum children to the patent root so the children sum past 100% —
   *  triggers the over-conveyance warning. */
  overConveyance?: {
    extras: Array<{ grantee: string; num: number; den: number; docNo: string; deedDate: string }>;
  };
}

const VM_TRACTS: TractPlan[] = [
  // ── Unit A — Jupiter Flats ────────────────────────────
  {
    code: 'VM1',
    name: 'VM1 — Apollo Draw',
    unitCode: 'A',
    unitName: UNIT_A_NAME,
    grossAcres: '160',
    pooledAcres: '160',
    landDesc: 'A. Apollo Draw Survey, Abstract 401, Walker County, Texas',
    description:
      'Two-owner tract with a clean 1/2 + 1/4 + 1/4 split — Buster and Minerva both land here.',
    patentee: 'P. T. Broncus',
    patentYear: 1872,
    primaryRoyalty: '1/4',
    owners: [
      { grantee: BRIDGE.cletus.name, num: 1, den: 2, docNo: 'VM1-WD-001', deedDate: '1948-04-12' },
      { grantee: BRIDGE.ophelia.name, num: 1, den: 4, docNo: 'VM1-WD-002', deedDate: '1952-08-03' },
      { grantee: 'Mortimer "Sawdust" Hench', num: 1, den: 4, docNo: 'VM1-WD-003', deedDate: '1961-11-29' },
    ],
  },
  {
    code: 'VM2',
    name: "VM2 — Widow's Aegis",
    unitCode: 'A',
    unitName: UNIT_A_NAME,
    grossAcres: '240',
    pooledAcres: '240',
    landDesc: 'B. Aegis Survey, Abstract 412, Walker County, Texas',
    description:
      'Trust + Minerva + rodeo-Olympus tract. Planted: an over-conveyance on the patent root that sums past 100%.',
    patentee: 'Eulalia Mesa',
    patentYear: 1874,
    primaryRoyalty: '1/4',
    owners: [
      { grantee: BRIDGE.trust.name, num: 1, den: 2, docNo: 'VM2-WD-001', deedDate: '1955-02-17' },
      { grantee: BRIDGE.ophelia.name, num: 1, den: 4, docNo: 'VM2-WD-002', deedDate: '1958-06-21' },
      { grantee: 'Estate of Hambone "Lefty" McGurkin', num: 1, den: 4, docNo: 'VM2-WD-003', deedDate: '1962-10-05' },
    ],
    overConveyance: {
      // Two extra deeds out of the patent root, each conveying 3/5 of the
      // whole — total children = 1/2 + 1/4 + 1/4 + 3/5 + 3/5 = 11/5 (220%).
      extras: [
        {
          grantee: 'Pinhead "Doublecount" Crumley',
          num: 3,
          den: 5,
          docNo: 'VM2-WD-OVR-1',
          deedDate: '1979-04-01',
        },
        {
          grantee: 'Pinhead "Doublecount" Crumley',
          num: 3,
          den: 5,
          docNo: 'VM2-WD-OVR-2',
          deedDate: '1979-04-02',
        },
      ],
    },
  },
  {
    code: 'VM3',
    name: 'VM3 — Mercury Cutoff',
    unitCode: 'A',
    unitName: UNIT_A_NAME,
    grossAcres: '160',
    pooledAcres: '160',
    landDesc: 'C. Mercury Cutoff Survey, Abstract 423, Walker County, Texas',
    description:
      'LLC + small owners. Planted: fixed NPRIs that stack above the available NRI for the over-burden warning.',
    patentee: 'Roustabout Whitfield',
    patentYear: 1871,
    primaryRoyalty: '1/4',
    owners: [
      { grantee: BRIDGE.llc.name, num: 1, den: 2, docNo: 'VM3-WD-001', deedDate: '1950-03-08' },
      { grantee: 'Mavis "Sword-Eater" Toomey', num: 1, den: 4, docNo: 'VM3-WD-002', deedDate: '1954-07-14' },
      { grantee: 'Beauregard Plumstead', num: 1, den: 8, docNo: 'VM3-WD-003', deedDate: '1968-12-19' },
      { grantee: 'Beauregard Plumstead', num: 1, den: 8, docNo: 'VM3-WD-004', deedDate: '1970-05-22' },
    ],
    // 1/2 + 1/4 = 3/4 of whole as fixed NPRIs — way more than the 1/4 lease
    // royalty can absorb. Should light up "Over-burdened".
    fixedNpris: [
      { grantee: 'Annie Boggs', num: 1, den: 2, docNo: 'VM3-NPRI-001', deedDate: '1965-04-30' },
      { grantee: 'Hermes Royalty Holdings, LP', num: 1, den: 4, docNo: 'VM3-NPRI-002', deedDate: '1972-09-09' },
    ],
  },
  {
    code: 'VM4',
    name: 'VM4 — Vulcan Gulch',
    unitCode: 'A',
    unitName: UNIT_A_NAME,
    grossAcres: '200',
    pooledAcres: '200',
    landDesc: 'D. Vulcan Gulch Survey, Abstract 434, Walker County, Texas',
    description:
      'Buster + locals. Planted: one lease has a malformed royalty (1/6.5) for the Leasehold Input Error warning.',
    patentee: 'Gertrude "Cannonball" Spivey',
    patentYear: 1869,
    primaryRoyalty: '1/4',
    owners: [
      { grantee: BRIDGE.cletus.name, num: 1, den: 4, docNo: 'VM4-WD-001', deedDate: '1946-09-30' },
      { grantee: 'Constance "Bone-Saw" Whittle', num: 3, den: 8, docNo: 'VM4-WD-002', deedDate: '1953-04-18' },
      { grantee: 'Reginald "Ringmaster" Crumley', num: 3, den: 8, docNo: 'VM4-WD-003', deedDate: '1961-07-25' },
    ],
    leaseOverridesByGrantee: {
      // Planted error #1 — malformed royalty rate. Strict parser should fail
      // and add this lease to the tract's Leasehold "Input error" chip.
      [BRIDGE.cletus.name]: {
        royaltyRate: '1/6.5',
        notes: "PLANTED ERROR: royalty rate '1/6.5' is malformed — should appear as a Leasehold Input Error.",
      },
    },
  },
  {
    code: 'VM5',
    name: 'VM5 — Last Centurion',
    unitCode: 'A',
    unitName: UNIT_A_NAME,
    grossAcres: '320',
    pooledAcres: '320',
    landDesc: 'E. Centurion Survey, Abstract 445, Walker County, Texas',
    description:
      'Trust + LLC + locals at 3/16 royalty so the leasehold math hits a different decimal track from the other tracts.',
    patentee: 'Doc Hieronymus Delphi',
    patentYear: 1873,
    primaryRoyalty: '3/16',
    owners: [
      { grantee: BRIDGE.trust.name, num: 1, den: 4, docNo: 'VM5-WD-001', deedDate: '1949-02-14' },
      { grantee: BRIDGE.llc.name, num: 1, den: 4, docNo: 'VM5-WD-002', deedDate: '1951-05-30' },
      { grantee: 'Pearl "Knife-Catcher" Velasquez', num: 1, den: 4, docNo: 'VM5-WD-003', deedDate: '1956-08-11' },
      { grantee: 'Wendell "Stilt-Stumble" Krabowski', num: 1, den: 4, docNo: 'VM5-WD-004', deedDate: '1963-12-04' },
    ],
  },
  // ── Unit B — Minerva Draw ─────────────────────────────
  {
    code: 'VM6',
    name: 'VM6 — Jupiter Spur',
    unitCode: 'B',
    unitName: UNIT_B_NAME,
    grossAcres: '160',
    pooledAcres: '160',
    landDesc: 'F. Jupiter Spur Survey, Abstract 502, Walker County, Texas',
    description:
      'Trust + Pickled-egg vendor at 1/2 each. Smallest-and-cleanest tract.',
    patentee: 'Octavia Slipknot',
    patentYear: 1870,
    primaryRoyalty: '1/4',
    owners: [
      { grantee: BRIDGE.trust.name, num: 1, den: 2, docNo: 'VM6-WD-001', deedDate: '1944-06-22' },
      { grantee: 'Festus "Pickled-Egg" Drumheller', num: 1, den: 2, docNo: 'VM6-WD-002', deedDate: '1957-10-14' },
    ],
  },
  {
    code: 'VM7',
    name: 'VM7 — Minotaur Fork',
    unitCode: 'B',
    unitName: UNIT_B_NAME,
    grossAcres: '240',
    pooledAcres: '240',
    landDesc: 'G. Minotaur Fork Survey, Abstract 514, Walker County, Texas',
    description:
      'Buster + LLC tract at 1/5 royalty (atypical decimal). Planted: a top-lease that overlaps Buster\'s original lease — should trigger the lease-overlap warning.',
    patentee: 'Cornelius Whiplash',
    patentYear: 1872,
    primaryRoyalty: '1/5',
    owners: [
      { grantee: BRIDGE.cletus.name, num: 1, den: 2, docNo: 'VM7-WD-001', deedDate: '1947-03-19' },
      { grantee: BRIDGE.llc.name, num: 1, den: 4, docNo: 'VM7-WD-002', deedDate: '1953-09-08' },
      { grantee: 'Lurleen "Ares" Sproat', num: 1, den: 4, docNo: 'VM7-WD-003', deedDate: '1960-02-27' },
    ],
    topLeasesByGrantee: {
      // Planted error #5 — second lease on Buster's VM7 interest overlapping
      // the original lease (which fires in 2024). This second lease starts
      // 2025 with a different lessee and runs forward — coverage analysis
      // should report the overlap.
      [BRIDGE.cletus.name]: {
        lessee: 'Labyrinth Top-Lease Partners, LP',
        royaltyRate: '1/4',
        effectiveDate: '2025-03-01',
        notes:
          "PLANTED ERROR: top-lease intentionally overlaps the original VM7 lease on Buster — should appear as a Lease Overlap warning.",
      },
    },
  },
  {
    code: 'VM8',
    name: 'VM8 — Probate Styx',
    unitCode: 'B',
    unitName: UNIT_B_NAME,
    grossAcres: '200',
    pooledAcres: '200',
    landDesc: 'H. Styx Crossing Survey, Abstract 525, Walker County, Texas',
    description:
      'LLC + Minerva + an estate. Round-number splits exercise the average tract path.',
    patentee: 'Ezekiel "Trapdoor" Murch',
    patentYear: 1875,
    primaryRoyalty: '1/4',
    owners: [
      { grantee: BRIDGE.llc.name, num: 1, den: 2, docNo: 'VM8-WD-001', deedDate: '1950-07-04' },
      { grantee: BRIDGE.ophelia.name, num: 1, den: 4, docNo: 'VM8-WD-002', deedDate: '1955-11-11' },
      { grantee: 'Estate of Wilbur "The Geek" Posthumous', num: 1, den: 4, docNo: 'VM8-WD-003', deedDate: '1968-03-23' },
    ],
  },
  {
    code: 'VM9',
    name: "VM9 — Minerva's Bequest",
    unitCode: 'B',
    unitName: UNIT_B_NAME,
    grossAcres: '160',
    pooledAcres: '160',
    landDesc: 'I. Minerva Draw Survey, Abstract 537, Walker County, Texas',
    description:
      'Trust + Minerva majority + a small local. Two bridges meet here.',
    patentee: 'Madame Gloria "Six-Toes" Underwood',
    patentYear: 1871,
    primaryRoyalty: '1/4',
    owners: [
      { grantee: BRIDGE.ophelia.name, num: 1, den: 2, docNo: 'VM9-WD-001', deedDate: '1948-08-30' },
      { grantee: BRIDGE.trust.name, num: 1, den: 4, docNo: 'VM9-WD-002', deedDate: '1953-12-08' },
      { grantee: 'Bartholomew "Centurion" Pickens', num: 1, den: 4, docNo: 'VM9-WD-003', deedDate: '1959-05-15' },
    ],
  },
  {
    code: 'VM10',
    name: 'VM10 — Roughneck Olympus',
    unitCode: 'B',
    unitName: UNIT_B_NAME,
    grossAcres: '320',
    pooledAcres: '320',
    landDesc: 'J. Roughneck Olympus Survey, Abstract 548, Walker County, Texas',
    description:
      'Buster + LLC + two locals. Biggest Unit-B tract.',
    patentee: 'Hortense "Trapeze" Wickersham',
    patentYear: 1874,
    primaryRoyalty: '1/4',
    owners: [
      { grantee: BRIDGE.cletus.name, num: 1, den: 4, docNo: 'VM10-WD-001', deedDate: '1946-04-09' },
      { grantee: BRIDGE.llc.name, num: 1, den: 4, docNo: 'VM10-WD-002', deedDate: '1951-08-26' },
      { grantee: 'Algernon "Fire-Breather" Lipinski', num: 1, den: 4, docNo: 'VM10-WD-003', deedDate: '1957-01-31' },
      { grantee: 'Mable "Dunk-Tank" Twiggs', num: 1, den: 4, docNo: 'VM10-WD-004', deedDate: '1964-06-13' },
    ],
  },
];

// ── Node builder ────────────────────────────────────────

let nodeCounter = 0;
function nextId(): string {
  return `vm-${++nodeCounter}`;
}

function buildTractNodes(
  tract: TractPlan,
  leaseOverridesByNodeId: Map<
    string,
    Partial<OwnerWorkspaceData['leases'][number]>
  >,
  pdfPool: { next(): string | null }
): { nodes: OwnershipNode[]; pdfMappings: PdfMapping[] } {
  const nodes: OwnershipNode[] = [];
  const pdfs: PdfMapping[] = [];

  // ── Patent root ───────────────────────────────────────
  const patentId = nextId();
  const patentFileDate = `${tract.patentYear}-04-01`;
  nodes.push({
    ...createBlankNode(patentId, null),
    instrument: 'Patent',
    date: `${tract.patentYear}-03-15`,
    fileDate: patentFileDate,
    grantor: 'State of Texas',
    grantee: tract.patentee,
    landDesc: tract.landDesc,
    initialFraction: '1.000000000',
    // After all conveyances out, the patentee retains nothing in our tracts.
    fraction: '0.000000000',
    docNo: `${tract.code}-PAT`,
    vol: '1',
    page: String(100 + Number(tract.code.slice(2))),
    remarks: 'Original patent — all minerals and surface.',
    conveyanceMode: 'all',
    splitBasis: 'whole',
    numerator: '1',
    denominator: '1',
    manualAmount: '1.000000000',
  });

  // ── Mineral conveyances out of patent ─────────────────
  for (const owner of tract.owners) {
    const id = nextId();
    const frac = owner.num / owner.den;
    nodes.push({
      ...createBlankNode(id, patentId),
      instrument: 'Warranty Deed',
      date: owner.deedDate,
      fileDate: owner.deedDate,
      grantor: tract.patentee,
      grantee: owner.grantee,
      landDesc: tract.landDesc,
      initialFraction: frac.toFixed(9),
      fraction: frac.toFixed(9),
      docNo: owner.docNo,
      vol: String(200 + Number(tract.code.slice(2))),
      page: String(((nodeCounter * 13) % 290) + 10),
      remarks: `${tract.name} — ${owner.grantee} acquires ${owner.num}/${owner.den} of the whole tract.`,
      conveyanceMode: 'fraction',
      splitBasis: 'initial',
      numerator: String(owner.num),
      denominator: String(owner.den),
      manualAmount: frac.toFixed(9),
    });
    const pdfName = pdfPool.next();
    if (pdfName) pdfs.push({ nodeId: id, fileName: pdfName, kind: 'deed' });
  }

  // ── Planted: over-conveyance extras ───────────────────
  if (tract.overConveyance) {
    for (const extra of tract.overConveyance.extras) {
      const id = nextId();
      const frac = extra.num / extra.den;
      nodes.push({
        ...createBlankNode(id, patentId),
        instrument: 'Mineral Deed',
        date: extra.deedDate,
        fileDate: extra.deedDate,
        grantor: tract.patentee,
        grantee: extra.grantee,
        landDesc: tract.landDesc,
        initialFraction: frac.toFixed(9),
        fraction: frac.toFixed(9),
        docNo: extra.docNo,
        remarks: `PLANTED ERROR: ${tract.name} over-conveyance trigger — ${extra.num}/${extra.den} of the whole to ${extra.grantee} (intentional; combined deeds sum past 100%).`,
        conveyanceMode: 'fraction',
        splitBasis: 'initial',
        numerator: String(extra.num),
        denominator: String(extra.den),
        manualAmount: frac.toFixed(9),
      });
    }
  }

  // ── Planted: fixed NPRIs hanging off the patent root ──
  if (tract.fixedNpris) {
    for (const npri of tract.fixedNpris) {
      const id = nextId();
      const frac = npri.num / npri.den;
      nodes.push({
        ...createBlankNode(id, patentId),
        type: 'conveyance',
        interestClass: 'npri',
        royaltyKind: 'fixed',
        fixedRoyaltyBasis: 'whole_tract',
        instrument: 'Royalty Deed',
        date: npri.deedDate,
        fileDate: npri.deedDate,
        grantor: tract.patentee,
        grantee: npri.grantee,
        landDesc: tract.landDesc,
        initialFraction: frac.toFixed(9),
        fraction: frac.toFixed(9),
        docNo: npri.docNo,
        remarks: `PLANTED ERROR: ${tract.name} fixed NPRI of ${npri.num}/${npri.den} of the whole tract — stacks above the lease royalty to trigger the Over-burdened warning.`,
        conveyanceMode: 'fraction',
        splitBasis: 'whole',
        numerator: String(npri.num),
        denominator: String(npri.den),
        manualAmount: frac.toFixed(9),
      });
    }
  }

  // ── One lease per mineral owner ───────────────────────
  // Two months stride so dates look plausibly spaced.
  let leaseMonth = 1;
  for (const owner of tract.owners) {
    const parentNode = nodes.find(
      (n) =>
        n.parentId === patentId
        && n.grantee === owner.grantee
        && n.interestClass === 'mineral'
    );
    if (!parentNode) continue;
    const leaseId = nextId();
    const mm = String(leaseMonth).padStart(2, '0');
    nodes.push({
      ...createBlankNode(leaseId, parentNode.id),
      type: 'related',
      relatedKind: 'lease',
      instrument: 'Oil & Gas Lease',
      date: `2024-${mm}-01`,
      fileDate: `2024-${mm}-15`,
      grantor: parentNode.grantee,
      grantee: OPERATOR,
      landDesc: tract.landDesc,
      initialFraction: '0',
      fraction: '0',
      docNo: `${tract.code}-OGL-${owner.docNo.split('-').pop()}`,
      remarks: `${tract.name} — ${OPERATOR} leases from ${parentNode.grantee}.`,
    });
    const royaltyOverride =
      tract.leaseOverridesByGrantee?.[owner.grantee]?.royaltyRate;
    const notesOverride =
      tract.leaseOverridesByGrantee?.[owner.grantee]?.notes;
    leaseOverridesByNodeId.set(leaseId, {
      royaltyRate: royaltyOverride ?? tract.primaryRoyalty,
      leasedInterest: parentNode.initialFraction,
      leaseName: `${tract.name} — ${parentNode.grantee} Lease`,
      lessee: OPERATOR,
      effectiveDate: `2024-${mm}-01`,
      expirationDate: `2027-${mm}-01`,
      status: 'Active',
      notes:
        notesOverride
        ?? `${tract.description} — primary lease.`,
    });
    const pdfName = pdfPool.next();
    if (pdfName) pdfs.push({ nodeId: leaseId, fileName: pdfName, kind: 'lease' });
    leaseMonth = (leaseMonth % 12) + 1;
  }

  // ── Planted: top-leases overlapping originals ─────────
  if (tract.topLeasesByGrantee) {
    for (const [grantee, top] of Object.entries(tract.topLeasesByGrantee)) {
      const parentNode = nodes.find(
        (n) =>
          n.parentId === patentId
          && n.grantee === grantee
          && n.interestClass === 'mineral'
      );
      if (!parentNode) continue;
      const topLeaseId = nextId();
      nodes.push({
        ...createBlankNode(topLeaseId, parentNode.id),
        type: 'related',
        relatedKind: 'lease',
        instrument: 'Oil & Gas Lease',
        date: top.effectiveDate,
        fileDate: top.effectiveDate,
        grantor: parentNode.grantee,
        grantee: top.lessee,
        landDesc: tract.landDesc,
        initialFraction: '0',
        fraction: '0',
        docNo: `${tract.code}-OGL-TOP`,
        remarks: top.notes,
      });
      leaseOverridesByNodeId.set(topLeaseId, {
        royaltyRate: top.royaltyRate,
        leasedInterest: parentNode.initialFraction,
        leaseName: `${tract.name} — ${parentNode.grantee} Top-Lease`,
        lessee: top.lessee,
        effectiveDate: top.effectiveDate,
        expirationDate: '2028-03-01',
        status: 'Active',
        notes: top.notes,
      });
    }
  }

  return { nodes, pdfMappings: pdfs };
}

// ── Owner entity-type post-patch ────────────────────────

/** After `buildSeedOwnerWorkspaceData` consolidates owners, patch the bridge
 *  owners' entityType so we exercise Individual / Trust / LLC code paths. */
function patchBridgeOwnerEntityTypes(ownerData: OwnerWorkspaceData) {
  const patches: Record<string, string> = {
    [BRIDGE.cletus.name]: BRIDGE.cletus.entityType,
    [BRIDGE.trust.name]: BRIDGE.trust.entityType,
    [BRIDGE.llc.name]: BRIDGE.llc.entityType,
    [BRIDGE.ophelia.name]: BRIDGE.ophelia.entityType,
  };
  for (const owner of ownerData.owners) {
    const next = patches[owner.name];
    if (next) owner.entityType = next;
  }
}

// ── Workspace builder ───────────────────────────────────

export function buildVulcanMesaWorkspaceData(): {
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
  nodeCounter = 0;
  const workspaceId = createWorkspaceId();
  const leaseOverrides = new Map<
    string,
    Partial<OwnerWorkspaceData['leases'][number]>
  >();

  // Round-robin through the demo PDF pool so attachments look varied.
  let pdfIdx = 0;
  const pdfPool = {
    next(): string | null {
      if (pdfIdx >= DEMO_PDFS.length) return null;
      return DEMO_PDFS[pdfIdx++];
    },
  };

  const rawNodes: OwnershipNode[] = [];
  const pdfMappings: PdfMapping[] = [];
  for (const tract of VM_TRACTS) {
    const built = buildTractNodes(tract, leaseOverrides, pdfPool);
    rawNodes.push(...built.nodes);
    pdfMappings.push(...built.pdfMappings);
  }

  const finalizedNodes = finalizeGeneratedNodes(rawNodes, {
    humorousDeaths: false,
  });
  const { nodes, ownerData } = buildSeedOwnerWorkspaceData(
    workspaceId,
    finalizedNodes,
    'Vulcan Mesa — Demo',
    { leaseOverridesByNodeId: leaseOverrides }
  );
  patchBridgeOwnerEntityTypes(ownerData);

  const ts = Date.now();
  const deskMaps: DeskMap[] = VM_TRACTS.map((tract, index) => ({
    id: `dm-vulcan-mesa-${index + 1}-${ts}`,
    name: tract.name,
    code: tract.code,
    tractId: tract.code,
    grossAcres: tract.grossAcres,
    pooledAcres: tract.pooledAcres,
    description: tract.description,
    nodeIds: nodes.filter((n) => n.landDesc === tract.landDesc).map((n) => n.id),
    unitName: tract.unitName,
    unitCode: tract.unitCode,
  }));
  const deskMapIdByCode = new Map(deskMaps.map((dm) => [dm.code, dm.id]));

  // ── ORRIs — one per basis, plus a tract-scope with a planted div-by-zero
  const leaseholdOrris: LeaseholdOrri[] = [
    {
      id: 'vm-orri-1-unit-a-gross',
      payee: 'Ares Override, LP',
      scope: 'unit',
      unitCode: 'A',
      deskMapId: null,
      burdenFraction: '1/32',
      burdenBasis: 'gross_8_8',
      effectiveDate: '2024-02-01',
      sourceDocNo: 'VM-ORRI-1',
      notes: 'Unit A gross-8/8 ORRI — exercises the gross_8_8 burden basis.',
      depthRange: 'all_depths',
    },
    {
      id: 'vm-orri-2-unit-b-nri',
      payee: 'Hermes Royalty Holdings, LP',
      scope: 'unit',
      unitCode: 'B',
      deskMapId: null,
      burdenFraction: '1/64',
      burdenBasis: 'net_revenue_interest',
      effectiveDate: '2024-02-15',
      sourceDocNo: 'VM-ORRI-2',
      notes: 'Unit B NRI-basis ORRI — exercises the net_revenue_interest burden basis.',
      depthRange: 'all_depths',
    },
    {
      id: 'vm-orri-3-vm10-wi',
      payee: 'Centurion Override Co.',
      scope: 'tract',
      unitCode: null,
      deskMapId: deskMapIdByCode.get('VM10') ?? null,
      burdenFraction: '1/80',
      burdenBasis: 'working_interest',
      effectiveDate: '2024-03-01',
      sourceDocNo: 'VM-ORRI-3',
      notes: 'Tract-scope WI-basis ORRI on VM10 — exercises the working_interest burden basis.',
      depthRange: 'all_depths',
    },
    {
      id: 'vm-orri-4-vm5-broken',
      payee: 'Oracle Royalty Trust',
      scope: 'tract',
      unitCode: null,
      deskMapId: deskMapIdByCode.get('VM5') ?? null,
      // Planted error #6 — malformed burden fraction (divide by zero). Strict
      // parser should fail and surface this as a Leasehold Input Error.
      burdenFraction: '1/0',
      burdenBasis: 'gross_8_8',
      effectiveDate: '2024-04-01',
      sourceDocNo: 'VM-ORRI-4',
      notes:
        "PLANTED ERROR: burdenFraction '1/0' is malformed — should appear as a Leasehold Input Error on VM5.",
      depthRange: 'all_depths',
    },
  ];

  // ── Assignments — both scopes, plus a planted over-assignment on Unit A
  const leaseholdAssignments: LeaseholdAssignment[] = [
    {
      id: 'vm-asg-1-unit-a-60',
      assignor: OPERATOR,
      assignee: 'Praetor Brothers Operating, LLC',
      scope: 'unit',
      unitCode: 'A',
      deskMapId: null,
      workingInterestFraction: '3/5',
      effectiveDate: '2024-03-01',
      sourceDocNo: 'VM-ASG-1',
      notes: 'Unit A 60% WI assignment to Praetor Brothers.',
      depthRange: 'all_depths',
    },
    {
      id: 'vm-asg-2-unit-a-50',
      assignor: OPERATOR,
      assignee: 'Minerva Draw Production Co.',
      scope: 'unit',
      unitCode: 'A',
      deskMapId: null,
      // Planted error #4 — combined with the 60% above, Unit A is now 110% WI
      // assigned. Should fire the Over-assigned warning on every Unit A tract.
      workingInterestFraction: '1/2',
      effectiveDate: '2024-04-01',
      sourceDocNo: 'VM-ASG-2',
      notes:
        "PLANTED ERROR: this Unit A 50% WI assignment, combined with the 60% above, totals 110% WI — should appear as Over-assigned on Unit A tracts.",
      depthRange: 'all_depths',
    },
    {
      id: 'vm-asg-3-vm10-25',
      assignor: OPERATOR,
      assignee: 'Ares Production Co.',
      scope: 'tract',
      unitCode: null,
      deskMapId: deskMapIdByCode.get('VM10') ?? null,
      workingInterestFraction: '1/4',
      effectiveDate: '2024-05-01',
      sourceDocNo: 'VM-ASG-3',
      notes: 'Tract-scope 25% WI assignment on VM10 — exercises tract-scope WI flow.',
      depthRange: 'all_depths',
    },
  ];

  const leaseholdUnit: LeaseholdUnit = {
    name: 'Vulcan Mesa Unit',
    description:
      'Two non-pooled units (Jupiter Flats — A, Minerva Draw — B) of five tracts each in Walker County, TX. Same operator covers both; several mineral owners hold interests across both units.',
    operator: OPERATOR,
    effectiveDate: '2024-01-01',
    jurisdiction: 'tx_fee',
  };

  return {
    workspaceId,
    projectName: `Vulcan Mesa — Demo (${deskMaps.length} Tracts, ${nodes.length} nodes)`,
    nodes,
    deskMaps,
    leaseholdUnit,
    leaseholdAssignments,
    leaseholdOrris,
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: deskMaps[0]?.id ?? null,
    activeUnitCode: 'A',
    instrumentTypes: [...DEMO_INSTRUMENT_TYPES],
    pdfMappings,
    ownerData,
  };
}

// ── Public seed entry point ─────────────────────────────

export async function seedVulcanMesaData(): Promise<{
  nodeCount: number;
  pdfCount: number;
}> {
  const workspace = buildVulcanMesaWorkspaceData();

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

  let pdfCount = 0;
  for (const mapping of workspace.pdfMappings) {
    const ok = await attachPdf(mapping.nodeId, mapping.fileName, mapping.kind);
    if (ok) pdfCount++;
  }

  console.log(
    `[vulcan-mesa] Built ${workspace.nodes.length} nodes, attached ${pdfCount} PDFs, ${workspace.deskMaps.length} desk maps`
  );
  console.table(PLANTED_ERRORS);
  return { nodeCount: workspace.nodes.length, pdfCount };
}

// ── Planted-error roster (printed to console on seed) ───

export const PLANTED_ERRORS = [
  {
    where: 'VM2 patent root',
    what: 'Children sum past 100% of the whole tract',
    expect: 'Over-conveyance warning on Desk Map for VM2',
  },
  {
    where: 'VM3 fixed NPRIs',
    what: '1/2 + 1/4 fixed NPRIs of the whole tract stacked above 1/4 royalty',
    expect: 'Over-burdened chip on VM3 Leasehold summary',
  },
  {
    where: "VM4 Buster's lease",
    what: "royaltyRate '1/6.5' (malformed)",
    expect: 'Leasehold Input Error chip on VM4',
  },
  {
    where: 'VM5 tract ORRI (vm-orri-4-vm5-broken)',
    what: "burdenFraction '1/0' (divide by zero)",
    expect: 'Leasehold Input Error chip on VM5 ORRI list',
  },
  {
    where: "VM7 Buster's leases",
    what: 'Original 2024 lease + 2025 top-lease, overlapping date ranges',
    expect: 'Lease Overlap warning on VM7 Desk Map card + Leasehold summary',
  },
  {
    where: 'Unit A WI assignments',
    what: '60% + 50% = 110% WI assigned on Unit A',
    expect: 'Over-assigned chip on every Unit A tract',
  },
] as const;
