export function deriveCounty(landDesc: string): string {
  const match = landDesc.match(/([A-Za-z .'-]+?)\s+County\b/i);
  return match?.[1]?.trim() ?? '';
}
