/**
 * dbKey scope-discipline guard (LLA-H01 forward guard).
 *
 * Every workspace-scoped side-store query MUST key on the compound
 * `[dbKey+workspaceId]` index (via `activeWorkspaceScope`), never a bare
 * `.where('workspaceId')`. A bare workspaceId query omits the per-profile `dbKey`
 * prefix, so on a shared browser profile (hosted multi-user, or legacy `'default'`
 * rows beside `user-{sub}` rows) it can match a DIFFERENT profile's rows that
 * happen to share the same `workspaceId` — a cross-profile data leak.
 *
 * The schema is already compliant (all `*-persistence.ts` files use
 * `[dbKey+workspaceId]`); this test is a forward regression guard so a
 * copy-pasted bare query can't silently reintroduce the leak. Mirrors the
 * `precision-policy` / `theme-token` source-grep guards.
 *
 * NOT flagged: `.where('dbKey')` (a deliberate dbKey-WIDE op like
 * `clearTitleLedgerRowsForActiveKey`, scoped to one profile across its
 * workspaces) and unique-key lookups (`id`, `contentHash`, …).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const STORAGE_ROOT = join(__dirname, '..');

/** A `.where('workspaceId')` / `.where('projectId')` with no `[dbKey+...]` compound prefix. */
const BARE_SCOPE_QUERY = /\.where\(\s*['"](?:workspaceId|projectId)['"]\s*\)/;

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('dbKey scope-discipline guard (LLA-H01)', () => {
  it('no bare workspaceId/projectId Dexie query in src/storage — use [dbKey+workspaceId]', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(STORAGE_ROOT)) {
      const content = readFileSync(file, 'utf8');
      content.split('\n').forEach((line, i) => {
        if (BARE_SCOPE_QUERY.test(line)) {
          offenders.push(`${file.slice(STORAGE_ROOT.length + 1).replaceAll('\\', '/')}:${i + 1}`);
        }
      });
    }
    expect(
      offenders,
      'Bare workspaceId/projectId Dexie query found — scope it to the active profile via '
        + "`.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId))` "
        + `instead (active-workspace-key.ts), or a row could leak across profiles:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
