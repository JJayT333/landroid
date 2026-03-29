/** Export owner database to multi-sheet Excel workbook. */
import type { Owner, Lease, ContactLog } from '../types/owner';
import { STATUS_OPTIONS, PROVISION_OPTIONS, ATTACHMENT_OPTIONS, CONTACT_TYPE_OPTIONS } from '../types/owner';
import { loadAllOwners, loadLeasesForOwner, loadContactsForOwner } from './owner-persistence';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const OWNER_HEADERS = [
  'Name', 'Additional Lessors', 'Status', 'Priority', 'Phone', 'Alt Phone',
  'Email', 'Address', 'City', 'State', 'ZIP', 'Prospect', 'County',
  'State (Land)', 'Assigned To', 'Notes', 'Created', 'Updated',
];

const LEASE_HEADERS = [
  'Owner', 'Tract No.', 'Lease Type', 'Lease Form', 'Lessee',
  'Lease Date', 'Effective', 'Expiration', 'Primary Term',
  'Royalty', 'Bonus/Ac', 'Rental/Ac', 'Paid Up', 'Total Bonus', 'Total Check',
  'Lessor Interest', 'Gross Acres', 'Net Acres',
  'Brief Description', 'Legal Description',
  'Provisions', 'Attachments',
  'Comments', 'Prepared By', 'Date Prepared',
];

const CONTACT_HEADERS = [
  'Owner', 'Date', 'Time', 'Type', 'Direction', 'Contact Person',
  'Summary', 'Notes', 'Follow-up Date', 'Follow-up Done',
];

function ownerRow(o: Owner): (string | number)[] {
  return [
    o.name, o.additionalLessors,
    STATUS_OPTIONS.find((s) => s.value === o.status)?.label ?? o.status,
    o.priority, o.phone, o.altPhone, o.email,
    o.address, o.city, o.state, o.zip,
    o.prospect, o.county, o.stateJurisdiction, o.assignedTo, o.notes,
    o.createdAt?.slice(0, 10) ?? '', o.updatedAt?.slice(0, 10) ?? '',
  ];
}

function leaseRow(l: Lease, ownerName: string): (string | number)[] {
  return [
    ownerName, l.tractNo, l.leaseType, l.leaseForm, l.lessee,
    l.leaseDate, l.effectiveDate, l.expirationDate, l.primaryTerm,
    l.royaltyRate, l.bonusPerAcre, l.rentalPerAcre, l.paidUp ? 'Yes' : 'No',
    l.totalBonus, l.totalCheck,
    l.lessorInterest, l.grossAcres, l.netAcres,
    l.briefDescription, l.legalDescription,
    l.provisions.map((k) => PROVISION_OPTIONS.find((p) => p.key === k)?.label ?? k).join('; '),
    l.attachments.map((k) => ATTACHMENT_OPTIONS.find((a) => a.key === k)?.label ?? k).join('; '),
    l.comments, l.preparedBy, l.datePrepared,
  ];
}

function contactRow(c: ContactLog, ownerName: string): (string | number)[] {
  return [
    ownerName, c.date, c.time,
    CONTACT_TYPE_OPTIONS.find((t) => t.value === c.type)?.label ?? c.type,
    c.direction, c.contactPerson, c.summary, c.notes,
    c.followUpDate, c.followUpCompleted ? 'Yes' : 'No',
  ];
}

export async function exportOwnerDatabase(): Promise<Blob> {
  const XLSX = await import('xlsx');
  const owners = await loadAllOwners();

  const ownerRows = [OWNER_HEADERS, ...owners.map((o) => ownerRow(o))];
  const leaseRows: (string | number)[][] = [LEASE_HEADERS];
  const contactRows: (string | number)[][] = [CONTACT_HEADERS];

  for (const owner of owners) {
    const [leases, contacts] = await Promise.all([
      loadLeasesForOwner(owner.id),
      loadContactsForOwner(owner.id),
    ]);
    for (const l of leases) leaseRows.push(leaseRow(l, owner.name));
    for (const c of contacts) contactRows.push(contactRow(c, owner.name));
  }

  const wb = XLSX.utils.book_new();

  const ownerSheet = XLSX.utils.aoa_to_sheet(ownerRows);
  ownerSheet['!cols'] = OWNER_HEADERS.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ownerSheet, 'Owners');

  const leaseSheet = XLSX.utils.aoa_to_sheet(leaseRows);
  leaseSheet['!cols'] = LEASE_HEADERS.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, leaseSheet, 'Leases');

  const contactSheet = XLSX.utils.aoa_to_sheet(contactRows);
  contactSheet['!cols'] = CONTACT_HEADERS.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, contactSheet, 'Contacts');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: XLSX_MIME });
}

export async function downloadOwnerExport() {
  const blob = await exportOwnerDatabase();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `LANDroid-Owners-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
