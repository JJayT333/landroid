import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const scriptPath = resolve(repoRoot, 'scripts/generate-test-csv.ts');
const expectedFiles = [
  'test-200a-v2.import.csv',
  'test-200b-v2.import.csv',
  'test-500a-v2.import.csv',
  'test-500b-v2.import.csv',
];

const cleanupDirs: string[] = [];

function makeTempDirInsideRepo(): string {
  const dir = mkdtempSync(join(repoRoot, '.tmp-generate-test-csv-'));
  cleanupDirs.push(dir);
  return dir;
}

function makeTempDirOutsideRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'landroid-generate-test-csv-'));
  cleanupDirs.push(dir);
  return dir;
}

function isInsideRepo(path: string): boolean {
  const rel = relative(repoRoot, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function generatorArgs(args: string[]): string[] {
  return ['--import', 'tsx', scriptPath, ...args];
}

function runGenerator(args: string[]) {
  return spawnSync(process.execPath, generatorArgs(args), {
    cwd: repoRoot,
    encoding: 'utf-8',
  });
}

afterEach(() => {
  while (cleanupDirs.length > 0) {
    rmSync(cleanupDirs.pop()!, { recursive: true, force: true });
  }
});

describe('generate-test-csv', () => {
  it('writes all generated CSV files under an explicit in-repo output dir', () => {
    const outDir = makeTempDirInsideRepo();

    execFileSync(process.execPath, generatorArgs(['--out', outDir]), {
      cwd: repoRoot,
      encoding: 'utf-8',
    });

    const files = readdirSync(outDir).sort();
    expect(files).toEqual(expectedFiles);
    for (const file of files) {
      expect(isInsideRepo(resolve(outDir, file))).toBe(true);
    }
  });

  it('refuses an out-of-repo output dir without writing CSV files there', () => {
    const outDir = makeTempDirOutsideRepo();
    const result = runGenerator(['--out', outDir]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Output path must stay inside the repo');
    expect(readdirSync(outDir)).toEqual([]);
  });

  it('requires an explicit output dir', () => {
    const result = runGenerator([]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Usage:');
  });
});
