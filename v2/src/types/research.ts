/** Research Hub domain types. */

export type InterestType = 'MI' | 'RI' | 'NRI' | 'ORRI';
export type ContactMethod = 'call' | 'email' | 'visit' | 'mail';
export type InterestStatus = 'confirmed' | 'pending' | 'disputed';

export interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
}

export interface Tract {
  id: string;
  code: string;
  name: string;
  acres: number;
  mapId: string;
}

export interface OwnershipInterest {
  id: string;
  contactId: string;
  tractId: string;
  interestType: InterestType;
  interestValue: string;       // Decimal-serialized
  leaseBurdenDecimal: string;  // Decimal-serialized
  royaltyDecimal: string;      // Decimal-serialized
  status: InterestStatus;
}

export interface ContactLog {
  id: string;
  contactId: string;
  tractId: string;
  method: ContactMethod;
  outcome: string;
  nextFollowupAt: string;
  contactAt: string;
  notes: string;
}
