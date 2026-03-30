import db from './db';
import { normalizeLease, type ContactLog, type Lease, type Owner, type OwnerDoc } from '../types/owner';

export interface OwnerWorkspaceData {
  owners: Owner[];
  leases: Lease[];
  contacts: ContactLog[];
  docs: OwnerDoc[];
}

export async function loadOwnerWorkspaceData(
  workspaceId: string
): Promise<OwnerWorkspaceData> {
  const [owners, leases, contacts, docs] = await Promise.all([
    db.owners.where('workspaceId').equals(workspaceId).sortBy('name'),
    db.leases.where('workspaceId').equals(workspaceId).toArray(),
    db.contactLogs.where('workspaceId').equals(workspaceId).toArray(),
    db.ownerDocs.where('workspaceId').equals(workspaceId).toArray(),
  ]);

  return {
    owners,
    leases: leases.map((lease) => normalizeLease(lease, { workspaceId })),
    contacts,
    docs,
  };
}

export async function replaceOwnerWorkspaceData(
  workspaceId: string,
  data: OwnerWorkspaceData
): Promise<void> {
  await db.transaction(
    'rw',
    db.owners,
    db.leases,
    db.contactLogs,
    db.ownerDocs,
    async () => {
      await Promise.all([
        db.owners.where('workspaceId').equals(workspaceId).delete(),
        db.leases.where('workspaceId').equals(workspaceId).delete(),
        db.contactLogs.where('workspaceId').equals(workspaceId).delete(),
        db.ownerDocs.where('workspaceId').equals(workspaceId).delete(),
      ]);

      if (data.owners.length > 0) {
        await db.owners.bulkPut(
          data.owners.map((owner) => ({ ...owner, workspaceId }))
        );
      }
      if (data.leases.length > 0) {
        await db.leases.bulkPut(
          data.leases.map((lease) =>
            normalizeLease(lease, { workspaceId, ownerId: lease.ownerId })
          )
        );
      }
      if (data.contacts.length > 0) {
        await db.contactLogs.bulkPut(
          data.contacts.map((contact) => ({ ...contact, workspaceId }))
        );
      }
      if (data.docs.length > 0) {
        await db.ownerDocs.bulkPut(
          data.docs.map((doc) => ({ ...doc, workspaceId }))
        );
      }
    }
  );
}

export function saveOwner(owner: Owner) {
  return db.owners.put(owner);
}

export function saveLease(lease: Lease) {
  return db.leases.put(
    normalizeLease(lease, {
      workspaceId: lease.workspaceId,
      ownerId: lease.ownerId,
    })
  );
}

export function saveContact(contact: ContactLog) {
  return db.contactLogs.put(contact);
}

export function saveOwnerDoc(doc: OwnerDoc) {
  return db.ownerDocs.put(doc);
}

export function deleteOwner(id: string) {
  return db.transaction(
    'rw',
    db.owners,
    db.leases,
    db.contactLogs,
    db.ownerDocs,
    async () => {
      await db.owners.delete(id);
      await Promise.all([
        db.leases.where('ownerId').equals(id).delete(),
        db.contactLogs.where('ownerId').equals(id).delete(),
        db.ownerDocs.where('ownerId').equals(id).delete(),
      ]);
    }
  );
}

export function deleteLease(id: string) {
  return db.transaction('rw', db.leases, db.ownerDocs, async () => {
    await db.leases.delete(id);
    await db.ownerDocs.where('leaseId').equals(id).modify({ leaseId: null });
  });
}

export function deleteContact(id: string) {
  return db.contactLogs.delete(id);
}

export function deleteOwnerDoc(id: string) {
  return db.ownerDocs.delete(id);
}
