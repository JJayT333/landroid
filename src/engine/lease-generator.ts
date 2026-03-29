/**
 * Producers 88 (7-69) Paid Up — lease document generator.
 *
 * Generates a .docx matching the exact template text, formatted for
 * legal-size paper (8.5 x 14), front and back, single page.
 *
 * Variable fields are injected from Owner + Lease data.
 * Formatting matched to the original Producers_88.docx template.
 */
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  UnderlineType, BorderStyle,
} from 'docx';
import type { Owner, Lease } from '../types/owner';

// ── Sizing constants (DXA: 1440 = 1 inch) ──────────────

const LEGAL_WIDTH = 12240;   // 8.5"
const LEGAL_HEIGHT = 20160;  // 14"
const MARGIN = 720;          // 0.5" all sides

// Font sizes in half-points (matched to original template)
const SZ_FORM_ID = 12;       // 6pt — form identifier line
const SZ_BODY = 16;          // 8pt — body text
const SZ_HEADING = 34;       // 17pt — "OIL, GAS AND MINERAL LEASE"
const SZ_NAME = 20;          // 10pt — names, land desc, ack section
const SZ_COMMA = 8;          // 4pt — tiny comma after consideration

const FONT = 'Times New Roman';

// ── Spacing constants (from template analysis) ──────────

// Body paragraphs: line=180, lineRule=exact
const SP_BODY = { after: 0, line: 180 };
// Preamble (THIS AGREEMENT): line=240, lineRule=auto
const SP_PREAMBLE = { after: 0, line: 240 };
// Acknowledgement section: line=238 (template uses -238 auto = exact 238)
const SP_ACK = { after: 0, line: 238 };

// ── Helpers ─────────────────────────────────────────────

function run(text: string, opts: Partial<{
  bold: boolean; italic: boolean; smallCaps: boolean;
  size: number; underline: boolean; superScript: boolean;
}> = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? SZ_BODY,
    bold: opts.bold,
    italics: opts.italic,
    smallCaps: opts.smallCaps,
    underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
    superScript: opts.superScript,
  });
}

function emptyPara(spacing = SP_BODY): Paragraph {
  return new Paragraph({ children: [], spacing });
}

function formatLeaseDate(dateStr: string): { day: string; ordinal: string; month: string; year: string } {
  if (!dateStr) return { day: '___', ordinal: 'th', month: '____________', year: '20__' };
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDate();
  const ordinal = getOrdinal(day);
  const month = d.toLocaleString('en-US', { month: 'long' });
  const year = d.getFullYear().toString();
  return { day: day.toString(), ordinal, month, year };
}

function getOrdinal(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function ownerFullAddress(owner: Owner): string {
  const parts = [owner.address, owner.city, owner.state, owner.zip].filter(Boolean);
  return parts.join(', ') || '________________________________';
}

// ── Main generator ──────────────────────────────────────

export async function generateProducers88(owner: Owner, lease: Lease): Promise<Blob> {
  const dt = formatLeaseDate(lease.leaseDate);
  const lessorName = owner.name || '________________________________';
  const lesseeName = lease.lessee || '________________________________';
  const lesseeAddr = lease.lesseeAddress || '________________________________';
  const lessorAddr = ownerFullAddress(owner);
  const royaltyWritten = lease.royaltyWritten || 'three sixteenths (3/16)';
  const termWritten = lease.primaryTermWritten || 'three (3) years';
  const grossAcres = lease.grossAcres || '______';
  const county = owner.county || '____________';
  const state = owner.stateJurisdiction || 'Texas';
  const briefDesc = lease.briefDescription || '________________________________________';
  const legalDesc = lease.legalDescription || '';
  const ackState = owner.state || state;
  const ackCounty = owner.county || '____________';

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: LEGAL_WIDTH, height: LEGAL_HEIGHT },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children: [
        // ── Form identifier (6pt, italic, right-aligned) ──
        new Paragraph({
          children: [run('PRODUCER 88 (7-69) PAID UP', { italic: true, size: SZ_FORM_ID })],
          alignment: AlignmentType.RIGHT,
        }),

        // ── Empty line ──
        emptyPara(),

        // ── Confidentiality notice (bold, justified, small indent both sides) ──
        new Paragraph({
          children: [
            run('NOTICE OF CONFIDENTIALITY RIGHTS: IF YOU ARE A NATURAL PERSON, YOU MAY REMOVE OR STRIKE ANY OF THE FOLLOWING INFORMATION FROM THIS INSTRUMENT BEFORE IT IS FILED FOR RECORD IN THE PUBLIC RECORDS: YOUR SOCIAL SECURITY NUMBER OR YOUR DRIVER\u2019S LICENSE NUMBER.', { bold: true }),
          ],
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: 180, right: 180 },
        }),

        // ── Empty line ──
        emptyPara(),

        // ── Title (17pt, centered, bold) ──
        new Paragraph({
          children: [run('OIL, GAS AND MINERAL LEASE', { bold: true, size: SZ_HEADING })],
          alignment: AlignmentType.CENTER,
        }),

        // ── Two empty lines before preamble ──
        emptyPara(SP_BODY),
        emptyPara(SP_BODY),

        // ── Preamble (line=240) ──
        new Paragraph({
          children: [
            run('THIS AGREEMENT ', { bold: true }),
            run('made this '),
            run(dt.day),
            run(dt.ordinal, { superScript: true }),
            run(` day of ${dt.month} ${dt.year} between `),
            run(lessorName, { bold: true, smallCaps: true, size: SZ_NAME }),
            run(' as Lessor (whether one or more), whose address is: '),
            run(lessorAddr),
            run(' and '),
            run(lesseeName, { bold: true, smallCaps: true, size: SZ_NAME }),
            run(' as Lessee, whose address is '),
            run(lesseeAddr),
          ],
          spacing: SP_PREAMBLE,
        }),

        // ── Empty line ──
        emptyPara(SP_BODY),

        // ── WITNESSETH ──
        new Paragraph({
          children: [run('WITNESSETH:', { bold: true })],
          spacing: SP_BODY,
        }),

        // ── Empty line ──
        emptyPara(SP_BODY),

        // ── Paragraph 1 ──
        new Paragraph({
          children: [
            run('1. Lessor, in consideration of Ten Dollars ($10.00) and other good and valuable consideration'),
            run(',', { bold: true, size: SZ_COMMA }),
            run(' receipt of which is hereby acknowledged, and of the covenants and agreements of lessee hereinafter contained, does hereby grant, lease and let unto lessee the land covered hereby for the purposes and with the exclusive right of exploring, drilling, mining and operating for, producing and owning oil, gas, sulphur and all other minerals (whether or not similar to those mentioned), together with the right to make surveys on said land, lay pipe lines, establish and utilize facilities for surface or subsurface disposal of salt water, construct roads and bridges, dig canals, build tanks, power stations, telephone lines, employee houses and other structures on said land, necessary or useful in lessee\u2019s operations in exploring, drilling for, producing, treating, storing and transporting minerals produced from the land covered hereby or any other land adjacent thereto. The land covered hereby, herein called \u201Csaid land,\u201D is located in the County of '),
            run(county),
            run(', State of '),
            run(state),
            run(' and is described as follows:'),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: SP_BODY,
        }),

        // ── Empty line before land description ──
        emptyPara(),

        // ── Land description (10pt, bold) ──
        new Paragraph({
          children: [run(briefDesc, { bold: true, size: SZ_NAME })],
          alignment: AlignmentType.JUSTIFIED,
        }),

        // ── Legal / tract descriptions (10pt) ──
        ...(legalDesc ? [
          new Paragraph({
            children: [run(legalDesc, { size: SZ_NAME })],
            alignment: AlignmentType.JUSTIFIED,
          }),
        ] : []),

        // ── Empty line after land description ──
        emptyPara(SP_BODY),

        // ── Continuation of paragraph 1 ──
        new Paragraph({
          children: [
            run('This lease also covers and includes, in addition to that above described, all land, if any, contiguous or adjacent to or adjoining the land above described and (a) owned or claimed by lessor by limitation, prescription, possession, reversion or unrecorded instrument or (b) as to which lessor has a preference right of acquisition. Lessor agrees to execute any supplemental instrument requested by lessee for a more complete or accurate description of said land. For the purpose of determining the amount of any bonus or other payment hereunder, said land shall be deemed to contain '),
            run(grossAcres, { bold: true }),
            run(' acres', { bold: true }),
            run(', whether actually containing more or less, and the above recital of acreage in any tract shall be deemed to be the true acreage thereof. Lessor accepts the bonus as lump sum consideration for this lease and all rights and options hereunder.'),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: SP_BODY,
        }),

        // ── Empty line ──
        emptyPara(SP_BODY),

        // ── Paragraph 2 — Primary Term (indented first line per template) ──
        new Paragraph({
          children: [
            run('Unless sooner terminated or longer kept in force under other provisions hereof, this lease shall remain in force for a term of '),
            run(termWritten, { bold: true }),
            run(' from the date hereof, hereinafter called \u201Cprimary term\u201D, and as long thereafter as operations, as hereinafter defined, are conducted upon said land with no cessation for more than ninety (90) consecutive days.'),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: SP_BODY,
          indent: { firstLine: 360 },
        }),

        // ── Empty line ──
        emptyPara(SP_BODY),

        // ── Paragraph 3 — Royalties ──
        new Paragraph({
          children: [
            run('3. '),
            run('As royalty, lessee covenants and agrees: (a) To deliver to the credit of lessor, in the pipe line to which lessee may connect its wells, the equal '),
            run(royaltyWritten, { bold: true }),
            run(' part of all oil produced and saved by lessee from said land, or from time to time, at the option of lessee, to pay lessor the average posted market price of such '),
            run(royaltyWritten, { bold: true }),
            run(' of such oil at the wells as of the day it is run to the pipe line or storage tanks, lessor\u2019s interest, in either case, to bear '),
            run(royaltyWritten, { bold: true }),
            run(' of the cost of treating oil to render it marketable pipe line oil; (b) To pay lessor on gas and casinghead gas produced from said land (1) when sold by lessee, '),
            run(royaltyWritten, { bold: true }),
            run(' of the amount realized by lessee, computed at the mouth of the well, or (2) when used by lessee off said land or in the manufacture of gasoline or other products, the market value, at the mouth of the well, of '),
            run(royaltyWritten, { bold: true }),
            run(' of such gas and casinghead gas; (c) To pay lessor on all other minerals mined and marketed or utilized by lessee from said land, one-tenth either in kind or value at the well or mine at lessee\u2019s election, except that on sulphur mined and marketed the royalty shall be one dollar ($1.00) per long ton. If, at the expiration of the primary term or at any time or times thereafter, there is any well on said land or on lands with which said land or any portion thereof has been pooled, capable of producing oil or gas, and all such wells are shut-in, this lease shall, nevertheless, continue in force as though operations were being conducted on said land for so long as said wells are shut-in, and thereafter this lease may be continued in force as if no shut-in had occurred. Lessee covenants and agrees to use reasonable diligence to produce, utilize, or market the minerals capable of being produced from said wells, but in the exercise of such diligence, lessee shall not be obligated to install or furnish facilities other than well facilities and ordinary lease facilities of flow lines, separator, and lease tank, and shall not be required to settle labor trouble or to market gas upon terms unacceptable to lessee. If, at any time or times after the expiration of the primary term, all such wells are shut-in for a period of ninety consecutive days, and during such time there are no operations on said land, then at or before the expiration of said ninety day period, lessee shall pay or tender, by check or draft of lessee, as royalty, a sum equal to one dollar ($1.00) for each acre of land then covered hereby. Lessee shall make like payments or tenders at or before the end of each anniversary of the expiration of said ninety-day period if upon such anniversary this lease is being continued in force solely by reason of the provisions of this paragraph. Each such payment or tender shall be made to the parties who at the time of payment would be entitled to receive the royalties which would be paid under this lease if the wells were producing, and may be'),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: SP_BODY,
        }),

        new Paragraph({
          children: [run('PAID DIRECTLY TO LESSOR', { bold: true })],
          alignment: AlignmentType.CENTER,
          spacing: SP_BODY,
        }),

        new Paragraph({
          children: [
            run(' or its successors, which shall continue as the depositories, regardless of changes in the ownership of shut-in royalty. If at any time that lessee pays or tenders shut-in royalty, two or more parties are, or claim to be, entitled to receive same; lessee may, in lieu of any other method of payment herein provided. pay or tender such shut-in royalty, in the manner above specified, either jointly to such parties or separately to each in accordance with their respective ownerships thereof, as lessee may elect. Any payment hereunder may be made by check or draft of lessee deposited in the mail or delivered to the party entitled to receive payment or to a depository bank provided for above on or before the last date for payment. Nothing herein shall impair lessee\u2019s right to release as provided in paragraph 5 hereof. In the event of assignment of this lease in whole or in part, liability for payment hereunder shall rest exclusively on the then owner or owners of this lease, severally as to acreage owned by each.'),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: SP_BODY,
        }),

        // ── Empty line ──
        emptyPara(SP_BODY),

        // ── Paragraph 4 — Pooling ──
        new Paragraph({
          children: [
            run('4. '),
            run('Lessee is hereby granted the right, at its option, to pool or unitize any land covered by this lease with any other land covered by this lease, and/or with any other land, lease, or leases, as to any or all minerals or horizons, so as to establish units containing not more than 80 surface acres, plus 10% acreage tolerance; provided, however, units may be established as to any one or more horizons, or existing units may be enlarged as to any one or more horizons, so as to contain not more than 640 surface acres plus 10% acreage tolerance, if limited to one or more of the following: (1) gas, other than casinghead gas, (2) liquid hydrocarbons (condensate) which are not liquids in the subsurface reservoir, (3) minerals produced from wells classified as gas wells by the conservation agency having jurisdiction. If larger units than any of those herein permitted, either at the time established, or after enlargement, are required under any governmental rule or order, for the drilling or operation of a well at a regular location, or for obtaining maximum allowable from any well to be drilled, drilling, or already drilled, any such unit may be established or enlarged to conform to the size required by such governmental order or rule. Lessee shall exercise said option as to each desired unit by executing an instrument identifying such unit and filing it for record in the public office in which this lease is recorded. Each of said options may be exercised by lessee at any time and from time to time while this lease is in force, and whether before or after production has been established either on said land, or on the portion of said land included in the unit, or on other land unitized therewith. A unit established hereunder shall be valid and effective for all purposes of this lease even though there may be mineral, royalty, or leasehold interests in lands within the unit which are not effectively pooled or unitized. Any operations conducted on any part of such unitized land shall be considered, for all purposes, except the payment of royalty, operations conducted upon said land under this lease. There shall be allocated to the land covered by this lease within each such unit (or to each separate tract within the unit if this lease covers separate tracts within the unit) that proportion of the total production of unitized minerals from the unit, after deducting any used in lease or unit operations, which the number of surface acres in such land (or in each such separate tract) covered by this lease within the unit bears to the total number of surface acres in the unit, and the production so allocated shall be considered for all purposes, including payment or delivery of royalty, overriding royalty and any other payments out of production, to be the entire production of unitized minerals from the land to which allocated in the same manner as though produced therefrom under the terms of this lease. The owner of the reversionary estate of any term royalty or mineral estate agrees that the accrual of royalties pursuant to this paragraph or of shut-in royalties from a well on the unit shall satisfy any limitation of term requiring production of oil or gas. The formation of any unit hereunder which includes land not covered by this lease shall not have the effect of exchanging or transferring any interest under this lease (including, without limitation, any shut-in royalty which may become payable under this lease) between parties owning interests in land covered by this lease and parties owning interests in land not covered by this lease. Neither shall it impair the right of lessee to release as provided in paragraph 5 hereof, except that lessee may not so release as to lands within a unit while there are operations thereon for unitized minerals unless all pooled leases are released as to lands within the unit. At any time while this lease is in force lessee may dissolve any unit established hereunder by filing for record in the public office where this lease is recorded a declaration to that effect, if at that time no operations are being conducted thereon for unitized minerals. Subject to the provisions of this paragraph 4. A unit once established hereunder shall remain in force so long as any lease subject thereto shall remain in force. If this lease now or hereafter covers separate tracts, no pooling or unitization of royalty interests as between any such separate tracts is intended or shall be implied or result merely from the inclusion of such separate tracts within this lease but lessee shall nevertheless have the right to pool or unitize as provided in this paragraph 4 with consequent allocation of production as herein provided. As used in this paragraph 4, the words \u201Cseparate tract\u201D mean any tract with royalty ownership differing, now or hereafter, either as to parties or amounts, from that as to any other part of the leased premises.'),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: SP_BODY,
        }),

        // ── Empty line ──
        emptyPara(SP_BODY),

        // ── Paragraph 5 ──
        new Paragraph({
          children: [
            run('5. '),
            run('Lessee may at any time and from time to time execute and deliver to lessor or file for record a release or releases of this lease as to any part or all of said land or of any mineral or horizon thereunder, and thereby be relieved of all obligations as to the released acreage or interest.'),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: SP_BODY,
        }),

        // ── Empty line ──
        emptyPara(SP_BODY),

        // ── Paragraph 6 ──
        new Paragraph({
          children: [
            run('6. '),
            run('Whenever used in this lease the word \u201Coperations\u201D shall mean operations for and any of the following: drilling, testing, completing, reworking, recompleting, deepening, plugging back or repairing of a well in search for or in an endeavor to obtain production of oil, gas, sulphur or other minerals, excavating a mine, production of oil, gas, sulphur or other mineral, whether or not in paying quantities.'),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: SP_BODY,
        }),

        // ── Empty line ──
        emptyPara(SP_BODY),

        // ── Paragraph 7 ──
        new Paragraph({
          children: [
            run('7. '),
            run('Lessee shall have the use, free from royalty, of water, other than from lessors water wells, and of oil and gas produced from said land in all operations hereunder. Lessee shall have the right at any time to remove all machinery and fixtures placed on said land, including the right to draw and remove casing. No well shall be drilled nearer than 200 feet to the house or barn now on said land without the consent of the lessor. Lessee shall pay for damages caused by its operations to growing crops and timber on said land.'),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: SP_BODY,
        }),

        // ── Empty line ──
        emptyPara(SP_BODY),

        // ── Paragraph 8 ──
        new Paragraph({
          children: [
            run('8. '),
            run('The rights and estate of any party hereto may be assigned from time to time in whole or in part and as to any mineral or horizon. All of the covenants, obligations, and considerations of this lease shall extend to and be binding upon the parties hereto, their heirs, successors, assigns, and successive assigns. No change or division in the ownership of said land, royalties, or other moneys, or any part thereof, howsoever effected, shall increase the obligations or diminish the rights of lessee, including, but not limited to, the location and drilling of wells and the measurement of production. Notwithstanding any other actual or constructive knowledge or notice thereof of or to lessee, its successors or assigns, no change or division in the ownership of said land or of the royalties, or other moneys, or the right to receive the same, howsoever effected, shall be binding upon the then record owner of this lease until thirty (30) days after there has been furnished to such record owner at his or its principal place of business by lessor or lessor\u2019s heirs, successors, or assigns, notice of such change or division, supported by either originals or duly certified copies of the instruments which have been properly filed for record and which evidence such change or division, and of such court records and proceedings, transcripts, or other documents as shall be necessary in the opinion of such record owner to establish the validity of such change or division. If any such change in ownership occurs by reason of the death of the owner, lessee may, nevertheless pay or tender such royalties, or other moneys, or part thereof, to the credit of the decedent in a depository bank provided for above.'),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: SP_BODY,
        }),

        // ── Empty line ──
        emptyPara(SP_BODY),

        // ── Paragraph 9 ──
        new Paragraph({
          children: [
            run('9. '),
            run('In the event, lessor considers that lessee has not complied with all its obligations hereunder, both express and implied, lessor shall notify lessee in writing, setting out specifically in what respects lessee has breached this contract. Lessee shall then have sixty (60) days after receipt of said notice within which to meet or commence to meet all or any part of the breaches alleged by lessor. The service of said notice shall be precedent to the bringing of any action by lessor on said lease for any cause, and no such action shall be brought until the lapse of sixty (60) days, after service of such notice on lessee. Neither the service of said notice nor the doing of any acts by lessee aimed to meet all or any of the alleged breeches shall be deemed an admission or presumption that lessee has failed to perform all its obligations hereunder. If this lease is canceled for any cause, it shall nevertheless remain in force and effect as to (1) sufficient acreage around each well as to which there are operations to constitute a drilling or maximum allowable unit under applicable governmental regulations, (but in no event less than forty acres), such acreage to be designated by lessee as nearly as practicable in the form of a square centered at the well, or in such shape as then existing spacing rules require: and (2) any part of said land included in a pooled unit on which there are operations. Lessee shall also have such easements on said land as are necessary to operations on the acreage so retained.'),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: SP_BODY,
        }),

        // ── Empty line ──
        emptyPara(SP_BODY),

        // ── Paragraph 10 ──
        new Paragraph({
          children: [
            run('10. '),
            run('Lessor hereby warrants and agrees to defend title to said land against the claims of all persons whomsoever, lessor\u2019s rights and interests hereunder shall be charged primarily with any mortgages, taxes or other liens, or interest and other charges on said land, but lessor agrees that lessee shall have the right at any time to pay or reduce same for lessor, either before or after maturity, and be subrogated to the rights of the holder thereof and to deduct amounts so paid from royalties or other payments payable or which may become payable to lessor and/or assigns under this lease. If this lease covers a less interest in the oil, gas, sulphur, or other minerals in all or any part of said land than the entire and undivided fee simple estate whether lessor\u2019s interest is herein specified or not), or no interest therein, then the royalties and other moneys accruing from any part as to which this lease covers less than such full interest, shall be paid only in the proportion which the interest therein, if any, covered by this lease, bears to the whole and undivided fee simple estate therein. All royalty interest covered by this lease (whether or not owned by lessor) shall be paid out of the royalty herein provided. This lease shall be binding upon each party who executes it without regard to whether it is executed by all those named herein as lessor.'),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: SP_BODY,
        }),

        // ── Empty line ──
        emptyPara(SP_BODY),

        // ── Paragraph 11 ──
        new Paragraph({
          children: [
            run('11. If, while this lease is in force, at, or after the expiration of the primary term hereof, it is not being continued in force by reason of the shut-in well provisions of paragraph 3 hereof, and lessee is not conducting operations on said land by reason of (1) any law, order, rule or regulation, (whether or not subsequently determined to be invalid) or (2) any other cause, whether similar or dissimilar, (except financial) beyond the reasonable control of lessee, the primary term hereof shall be extended until the first anniversary date hereof occurring ninety (90) or more days following the removal of such delaying cause, and this lease may be extended thereafter by operations as if such delay had not occurred.'),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: SP_BODY,
        }),

        // ══════════════════════════════════════════════════════
        // SIGNATURE & ACKNOWLEDGEMENT SECTION (10pt, line=238)
        // ══════════════════════════════════════════════════════

        emptyPara(SP_BODY),
        emptyPara(SP_BODY),

        // ── Signature lines ──
        emptyPara(SP_ACK),
        emptyPara(SP_ACK),
        emptyPara(SP_ACK),
        new Paragraph({
          children: [run('________________________________', { size: SZ_NAME })],
          spacing: SP_ACK,
        }),
        new Paragraph({
          children: [run(lessorName, { bold: true, size: SZ_NAME })],
          spacing: SP_ACK,
        }),

        // ── Spacing before acknowledgement ──
        emptyPara(SP_ACK),
        emptyPara(SP_ACK),
        emptyPara(SP_ACK),
        emptyPara(SP_ACK),

        // ── ACKNOWLEDGEMENT (centered) ──
        new Paragraph({
          children: [run('ACKNOWLEDGEMENT', { bold: true, underline: true, size: SZ_NAME })],
          alignment: AlignmentType.CENTER,
          spacing: SP_ACK,
        }),

        emptyPara(SP_ACK),
        emptyPara(SP_ACK),
        emptyPara(SP_ACK),

        // ── State / County ──
        new Paragraph({
          children: [
            run('STATE OF ', { bold: true, size: SZ_NAME }),
            run(ackState, { bold: true, size: SZ_NAME }),
            run('                            \u00A7                   ', { bold: true, size: SZ_NAME }),
          ],
          spacing: SP_ACK,
        }),
        new Paragraph({
          children: [run('                               \u00A7', { bold: true, size: SZ_NAME })],
          spacing: SP_ACK,
        }),
        new Paragraph({
          children: [
            run('COUNTY OF ', { bold: true, size: SZ_NAME }),
            run(ackCounty, { bold: true, underline: true, size: SZ_NAME }),
            run('      \u00A7     ', { bold: true, size: SZ_NAME }),
          ],
          spacing: SP_ACK,
        }),

        // ── Spacing ──
        emptyPara(SP_ACK),
        emptyPara(SP_ACK),
        emptyPara(SP_ACK),

        // ── Acknowledgement text ──
        new Paragraph({
          children: [
            run('This instrument was acknowledged before me on the ___ day of ___________, ', { size: SZ_NAME }),
            run(dt.year, { size: SZ_NAME }),
            run(' by __________________.', { size: SZ_NAME }),
          ],
          spacing: SP_ACK,
        }),

        // ── Notary signature ──
        emptyPara(SP_ACK),
        emptyPara(SP_ACK),
        emptyPara(SP_ACK),
        emptyPara(SP_ACK),
        new Paragraph({
          children: [run('___________________________________', { size: SZ_NAME })],
          spacing: SP_ACK,
        }),
        new Paragraph({
          children: [run(`      Notary Public State of ${ackState}`, { size: SZ_NAME })],
          spacing: SP_ACK,
        }),

        // ── Spacing before return address ──
        emptyPara(SP_ACK),
        emptyPara(),

        // ── Return address (with bottom border line per template) ──
        new Paragraph({
          children: [
            run('After Recording Return To:', { bold: true, size: SZ_NAME }),
          ],
          spacing: SP_ACK,
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 12, space: 11, color: 'auto' },
          },
        }),
        new Paragraph({
          children: [run('After Recording Return To:', { bold: true, size: SZ_NAME })],
          spacing: SP_ACK,
        }),
        new Paragraph({
          children: [run('Professional Land Consulting', { size: SZ_NAME })],
          spacing: SP_ACK,
        }),
        new Paragraph({
          children: [run('2010 Shady Branch Dr.', { size: SZ_NAME })],
          spacing: SP_ACK,
        }),
        new Paragraph({
          children: [run('Kingwood, TX 77339', { size: SZ_NAME })],
          spacing: SP_ACK,
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

export async function downloadProducers88(owner: Owner, lease: Lease) {
  const blob = await generateProducers88(owner, lease);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (owner.name || 'Lease').replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
  a.download = `Producers88_${safeName}_Tract${lease.tractNo || 'X'}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
