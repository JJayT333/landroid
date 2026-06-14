/**
 * Precision policy guard (deep audit §3): derived interest/acre decimals must be
 * formatted through `src/engine/display-format.ts` (or the centralized
 * formula-tooltip helpers), never hand-rolled with `.toFixed(` inside a view or
 * component. This test fails when a new ad-hoc `.toFixed(` appears in
 * `src/views/**` or `src/components/**` outside the sanctioned allowlist, so the
 * policy can't silently erode (mirrors the theme-token guard).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(__dirname, '..', '..');
const SCAN_DIRS = ['views', 'components'];

/**
 * Files allowed to use `.toFixed(` directly:
 *  - the centralized formula-tooltip display helpers (their job is formatting);
 *  - non-interest numerics (canvas zoom stepper, byte-size humanization).
 * Derived interest/acre decimals everywhere else go through display-format.ts.
 */
const ALLOWLIST = new Set([
  'components/leasehold/leasehold-formulas.ts',
  'components/deskmap/deskmap-formulas.ts',
  'components/canvas/CanvasToolbar.tsx',
  'views/DocumentsView.tsx',
]);

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

describe('precision policy guard (§3)', () => {
  it('no ad-hoc .toFixed( in views/components outside the allowlist', () => {
    const offenders: string[] = [];
    for (const scanDir of SCAN_DIRS) {
      for (const file of listSourceFiles(join(SRC_ROOT, scanDir))) {
        const rel = file.slice(SRC_ROOT.length + 1).replaceAll('\\', '/');
        if (ALLOWLIST.has(rel)) continue;
        if (readFileSync(file, 'utf8').includes('.toFixed(')) {
          offenders.push(rel);
        }
      }
    }
    expect(
      offenders,
      `Ad-hoc .toFixed( found — route derived decimals through `
        + `src/engine/display-format.ts instead:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
