/** Dexie CRUD for owner database tables. */
import db from './db';
import type { Owner, Lease, ContactLog, OwnerDoc } from '../types/owner';

// ── Owners ────────────────────────────────────────────────

export async function loadAllOwners(): Promise<Owner[]> {
  return (db as any).owners.toArray();
}

export async function saveOwner(owner: Owner): Promise<void> {
  await (db as any).owners.put(owner);
}

export async function deleteOwner(id: string): Promise<void> {
  await Promise.all([
    (db as any).owners.delete(id),
    (db as any).leases.where('ownerId').equals(id).delete(),
    (db as any).contactLogs.where('ownerId').equals(id).delete(),
    (db as any).ownerDocs.where('ownerId').equals(id).delete(),
  ]);
}

// ── Leases ────────────────────────────────────────────────

export async function loadLeasesForOwner(ownerId: string): Promise<Lease[]> {
  return (db as any).leases.where('ownerId').equals(ownerId).toArray();
}

export async function saveLease(lease: Lease): Promise<void> {
  await (db as any).leases.put(lease);
}

export async function deleteLease(id: string): Promise<void> {
  await Promise.all([
    (db as any).leases.delete(id),
    (db as any).ownerDocs.where('leaseId').equals(id).delete(),
  ]);
}

// ── Contact Logs ──────────────────────────────────────────

export async function loadContactsForOwner(ownerId: string): Promise<ContactLog[]> {
  const logs: ContactLog[] = await (db as any).contactLogs.where('ownerId').equals(ownerId).toArray();
  return logs.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

export async function saveContact(entry: ContactLog): Promise<void> {
  await (db as any).contactLogs.put(entry);
}

export async function deleteContact(id: string): Promise<void> {
  await (db as any).contactLogs.delete(id);
}

// ── Owner Docs ────────────────────────────────────────────

export async function loadDocsForOwner(ownerId: string): Promise<OwnerDoc[]> {
  return (db as any).ownerDocs.where('ownerId').equals(ownerId).toArray();
}

export async function saveOwnerDoc(doc: OwnerDoc): Promise<void> {
  await (db as any).ownerDocs.put(doc);
}

export async function deleteOwnerDoc(id: string): Promise<void> {
  await (db as any).ownerDocs.delete(id);
}
