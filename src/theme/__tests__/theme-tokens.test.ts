/**
 * DA-U1 guard: Tailwind v4 silently drops classes whose theme tokens don't
 * exist, which shipped invisible buttons and missing backgrounds. This test
 * extracts the `--color-*` tokens from the theme and fails when any source
 * file references a brand-color utility class with no backing token.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(__dirname, '..', '..');
const THEME_CSS = join(SRC_ROOT, 'theme', 'index.css');

/** Brand families owned by the theme; raw Tailwind palettes are out of scope. */
const BRAND_FAMILIES = ['parchment', 'ink', 'leather', 'gold', 'seal', 'ledger', 'canvas', 'line', 'connector', 'pin', 'tint'];
const UTILITY_PREFIXES = [
  'bg',
  'text',
  'border',
  'ring',
  'accent',
  'fill',
  'stroke',
  'from',
  'to',
  'via',
  'outline',
  'decoration',
  'divide',
  'placeholder',
  'caret',
  'shadow',
];

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(tsx|ts)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('theme token guard (DA-U1)', () => {
  const themeCss = readFileSync(THEME_CSS, 'utf8');
  const tokenNames = new Set(
    [...themeCss.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((match) => match[1])
  );

  it('declares the tokens that were previously referenced but missing', () => {
    expect(tokenNames.has('leather-dark')).toBe(true);
    expect(tokenNames.has('parchment-light')).toBe(true);
  });

  it('every brand-color utility class in src resolves to a theme token', () => {
    const family = BRAND_FAMILIES.join('|');
    const prefix = UTILITY_PREFIXES.join('|');
    // e.g. bg-leather-dark, text-ink-light/70, hover:border-gold — capture the
    // token portion (family plus optional -suffixes), ignore /opacity.
    const classPattern = new RegExp(
      `(?:${prefix})-((?:${family})(?:-[a-z0-9]+)*)(?:/|[^\\w/-]|$)`,
      'g'
    );
    const offenders: string[] = [];
    for (const file of listSourceFiles(SRC_ROOT)) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(classPattern)) {
        const token = match[1];
        if (!tokenNames.has(token)) {
          offenders.push(`${file.replace(SRC_ROOT, 'src')}: ${match[0].trim()} (token "${token}")`);
        }
      }
    }
    expect(
      offenders,
      `Classes referencing undefined theme tokens (Tailwind silently drops them):\n${[...new Set(offenders)].join('\n')}`
    ).toEqual([]);
  });
});
