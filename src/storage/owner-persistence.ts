import db from './db';
import {
  normalizeLease,
  type ContactLog,
  type Lease,
  type Owner,
  type OwnerDoc,
  type OwnerDocMeta,
} from '../types/owner';

export interface OwnerWorkspaceData {
  owners: Owner[];
  leases: Lease[];
  contacts: ContactLog[];
  docs: OwnerDoc[];
}

/** Project-open shape: owner docs carry metadata only, never the file blob. */
export interface OwnerWorkspaceMetadata {
  owners: Owner[];
  leases: Lease[];
  contacts: ContactLog[];
  docs: OwnerDocMeta[];
}

function stripOwnerDocBlob(doc: OwnerDoc): OwnerDocMeta {
  const { blob: _blob, ...meta } = doc;
  return meta;
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

/**
 * Metadata-first project-open reader. Identical to {@link loadOwnerWorkspaceData}
 * except owner documents are returned blob-free so opening a project never
 * holds blob bytes. Fetch bytes on demand with {@link getOwnerDocBlob}.
 */
export async function loadOwnerWorkspaceMetadata(
  workspaceId: string
): Promise<OwnerWorkspaceMetadata> {
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
    docs: docs.map(stripOwnerDocBlob),
  };
}

/**
 * Read the blob-bearing owner documents for a workspace. Used by
 * `.landroid` export and the AI undo snapshot, which must carry the file
 * bytes even though the in-memory store holds metadata only.
 */
export async function loadOwnerDocsWithBlobs(
  workspaceId: string
): Promise<OwnerDoc[]> {
  return db.ownerDocs.where('workspaceId').equals(workspaceId).toArray();
}

/** Fetch a single owner document's file blob on demand (preview/download). */
export async function getOwnerDocBlob(id: string): Promise<Blob | undefined> {
  const doc = await db.ownerDocs.get(id);
  return doc?.blob;
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

/**
 * Update an owner document's editable metadata fields in place. The stored
 * file blob is left untouched, so a metadata edit never needs the bytes in
 * memory.
 */
export function updateOwnerDocFields(id: string, fields: Partial<OwnerDoc>) {
  const { id: _id, blob: _blob, ...rest } = fields;
  return db.ownerDocs.update(id, rest);
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
