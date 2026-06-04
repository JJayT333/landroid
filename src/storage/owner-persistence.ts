import db from './db';
import {
  activeStorageScopedId,
  activeWorkspaceScope,
  stampActiveDbKeyWithStorageId,
  stripDbKeyAndStorageId,
  stripStorageScopedId,
} from './db-key-scope';
import {
  assertWorkspaceWriteFence,
  ensureWorkspaceWriteFence,
} from './workspace-write-lease';
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

function stripStoredId<T extends { id: string; dbKey?: string }>(
  row: T
): Omit<T, 'dbKey'> {
  return stripDbKeyAndStorageId(row, 'id');
}

async function getOwnerRow(id: string) {
  return (await db.owners.get(activeStorageScopedId(id))) ?? db.owners.get(id);
}

async function getLeaseRow(id: string) {
  return (await db.leases.get(activeStorageScopedId(id))) ?? db.leases.get(id);
}

async function getContactRow(id: string) {
  return (await db.contactLogs.get(activeStorageScopedId(id))) ?? db.contactLogs.get(id);
}

async function getOwnerDocRow(id: string) {
  return (await db.ownerDocs.get(activeStorageScopedId(id))) ?? db.ownerDocs.get(id);
}

export async function loadOwnerWorkspaceData(
  workspaceId: string
): Promise<OwnerWorkspaceData> {
  const [owners, leases, contacts, docs] = await Promise.all([
    db.owners.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).sortBy('name'),
    db.leases.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
    db.contactLogs.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
    db.ownerDocs.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
  ]);

  return {
    owners: owners.map(stripStoredId),
    leases: leases.map((lease) => normalizeLease(stripStoredId(lease), { workspaceId })),
    contacts: contacts.map(stripStoredId),
    docs: docs.map(stripStoredId),
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
    db.owners.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).sortBy('name'),
    db.leases.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
    db.contactLogs.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
    db.ownerDocs.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
  ]);

  return {
    owners: owners.map(stripStoredId),
    leases: leases.map((lease) => normalizeLease(stripStoredId(lease), { workspaceId })),
    contacts: contacts.map(stripStoredId),
    docs: docs.map((doc) => stripOwnerDocBlob(stripStoredId(doc))),
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
  const docs = await db.ownerDocs
    .where('[dbKey+workspaceId]')
    .equals(activeWorkspaceScope(workspaceId))
    .toArray();
  return docs.map(stripStoredId);
}

/** Fetch a single owner document's file blob on demand (preview/download). */
export async function getOwnerDocBlob(id: string): Promise<Blob | undefined> {
  const doc = await getOwnerDocRow(id);
  if (!doc) return undefined;
  return doc.dbKey === activeWorkspaceScope(doc.workspaceId)[0] ? doc.blob : undefined;
}

export async function replaceOwnerWorkspaceData(
  workspaceId: string,
  data: OwnerWorkspaceData
): Promise<void> {
  await ensureWorkspaceWriteFence(workspaceId);
  await db.transaction(
    'rw',
    [
      db.workspaceWriteLeases,
      db.owners,
      db.leases,
      db.contactLogs,
      db.ownerDocs,
    ],
    async () => {
      await assertWorkspaceWriteFence(workspaceId);
      await Promise.all([
        db.owners.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).delete(),
        db.leases.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).delete(),
        db.contactLogs.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).delete(),
        db.ownerDocs.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).delete(),
      ]);

      if (data.owners.length > 0) {
        await db.owners.bulkPut(
          data.owners.map((owner) =>
            stampActiveDbKeyWithStorageId({ ...owner, workspaceId }, 'id')
          )
        );
      }
      if (data.leases.length > 0) {
        await db.leases.bulkPut(
          data.leases.map((lease) =>
            stampActiveDbKeyWithStorageId(
              normalizeLease(lease, { workspaceId, ownerId: lease.ownerId }),
              'id'
            )
          )
        );
      }
      if (data.contacts.length > 0) {
        await db.contactLogs.bulkPut(
          data.contacts.map((contact) =>
            stampActiveDbKeyWithStorageId({ ...contact, workspaceId }, 'id')
          )
        );
      }
      if (data.docs.length > 0) {
        await db.ownerDocs.bulkPut(
          data.docs.map((doc) =>
            stampActiveDbKeyWithStorageId({ ...doc, workspaceId }, 'id')
          )
        );
      }
    }
  );
}

export async function saveOwner(owner: Owner) {
  await ensureWorkspaceWriteFence(owner.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.owners, async () => {
    await assertWorkspaceWriteFence(owner.workspaceId);
    return db.owners.put(stampActiveDbKeyWithStorageId(owner, 'id'));
  });
}

export async function saveLease(lease: Lease) {
  await ensureWorkspaceWriteFence(lease.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.leases, async () => {
    await assertWorkspaceWriteFence(lease.workspaceId);
    return db.leases.put(
      stampActiveDbKeyWithStorageId(
        normalizeLease(lease, {
          workspaceId: lease.workspaceId,
          ownerId: lease.ownerId,
        }),
        'id'
      )
    );
  });
}

export async function saveContact(contact: ContactLog) {
  await ensureWorkspaceWriteFence(contact.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.contactLogs, async () => {
    await assertWorkspaceWriteFence(contact.workspaceId);
    return db.contactLogs.put(stampActiveDbKeyWithStorageId(contact, 'id'));
  });
}

export async function saveOwnerDoc(doc: OwnerDoc) {
  await ensureWorkspaceWriteFence(doc.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.ownerDocs, async () => {
    await assertWorkspaceWriteFence(doc.workspaceId);
    return db.ownerDocs.put(stampActiveDbKeyWithStorageId(doc, 'id'));
  });
}

/**
 * Update an owner document's editable metadata fields in place. The stored
 * file blob is left untouched, so a metadata edit never needs the bytes in
 * memory.
 */
export async function updateOwnerDocFields(id: string, fields: Partial<OwnerDoc>) {
  const { id: _id, blob: _blob, ...rest } = fields;
  const doc = await getOwnerDocRow(id);
  if (!doc || doc.dbKey !== activeWorkspaceScope(doc.workspaceId)[0]) return;
  await ensureWorkspaceWriteFence(doc.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.ownerDocs, async () => {
    await assertWorkspaceWriteFence(doc.workspaceId);
    await db.ownerDocs.update(doc.id, rest);
  });
}

export async function deleteOwner(id: string) {
  const owner = await getOwnerRow(id);
  if (!owner || owner.dbKey !== activeWorkspaceScope(owner.workspaceId)[0]) return;
  await ensureWorkspaceWriteFence(owner.workspaceId);
  return db.transaction(
    'rw',
    [
      db.workspaceWriteLeases,
      db.owners,
      db.leases,
      db.contactLogs,
      db.ownerDocs,
    ],
    async () => {
      await assertWorkspaceWriteFence(owner.workspaceId);
      const ownerId = stripStorageScopedId(owner.id, owner.dbKey);
      const workspaceScope = activeWorkspaceScope(owner.workspaceId);
      await db.owners.delete(owner.id);
      await Promise.all([
        db.leases
          .where('[dbKey+workspaceId+ownerId]')
          .equals([...workspaceScope, ownerId])
          .delete(),
        db.contactLogs
          .where('[dbKey+workspaceId+ownerId]')
          .equals([...workspaceScope, ownerId])
          .delete(),
        db.ownerDocs
          .where('[dbKey+workspaceId+ownerId]')
          .equals([...workspaceScope, ownerId])
          .delete(),
      ]);
    }
  );
}

export async function deleteLease(id: string) {
  const lease = await getLeaseRow(id);
  if (!lease || lease.dbKey !== activeWorkspaceScope(lease.workspaceId)[0]) return;
  await ensureWorkspaceWriteFence(lease.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.leases, db.ownerDocs, async () => {
    await assertWorkspaceWriteFence(lease.workspaceId);
    const leaseId = stripStorageScopedId(lease.id, lease.dbKey);
    const workspaceScope = activeWorkspaceScope(lease.workspaceId);
    await db.leases.delete(lease.id);
    await db.ownerDocs
      .where('[dbKey+workspaceId+leaseId]')
      .equals([...workspaceScope, leaseId])
      .modify({ leaseId: null });
  });
}

export async function deleteContact(id: string) {
  const contact = await getContactRow(id);
  if (!contact || contact.dbKey !== activeWorkspaceScope(contact.workspaceId)[0]) return;
  await ensureWorkspaceWriteFence(contact.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.contactLogs, async () => {
    await assertWorkspaceWriteFence(contact.workspaceId);
    await db.contactLogs.delete(contact.id);
  });
}

export async function deleteOwnerDoc(id: string) {
  const doc = await getOwnerDocRow(id);
  if (!doc || doc.dbKey !== activeWorkspaceScope(doc.workspaceId)[0]) return;
  await ensureWorkspaceWriteFence(doc.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.ownerDocs, async () => {
    await assertWorkspaceWriteFence(doc.workspaceId);
    await db.ownerDocs.delete(doc.id);
  });
}
