import type { Owner } from '../../types/owner';

export interface OwnerLinkOption {
  id: string;
  label: string;
  detail: string;
}

export function buildOwnerLinkOptions(owners: Owner[]): OwnerLinkOption[] {
  return owners
    .map((owner) => ({
      id: owner.id,
      label: owner.name.trim() || 'Unnamed owner',
      detail: [owner.county, owner.prospect]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(' • '),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function resolveExistingOwnerSelection(
  options: OwnerLinkOption[],
  selectedOwnerId: string
): string | null {
  return options.some((option) => option.id === selectedOwnerId)
    ? selectedOwnerId
    : null;
}
