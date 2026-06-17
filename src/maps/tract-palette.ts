/**
 * Shared muted tract palette for the colored unit plat (DA2-M). Lives outside
 * the React components so non-UI code (the PDF exhibit) can reuse it without
 * pulling in React.
 */
export const TRACT_PALETTE = [
  '#9caf88', // sage
  '#c0926a', // clay
  '#8fa3b8', // slate blue
  '#c4a55c', // ochre
  '#b08f99', // dusty rose
  '#a8a36a', // olive
  '#8aa9a3', // teal gray
  '#a88fa8', // mauve
  '#cbb487', // sand
  '#9aabb5', // stone blue
] as const;

export function tractColorAt(index: number): string {
  return TRACT_PALETTE[index % TRACT_PALETTE.length];
}

/** "#9caf88" → [0.612, 0.686, 0.533] (0..1 channels, for pdf-lib `rgb`). */
export function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const value = parseInt(
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean,
    16
  );
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}
