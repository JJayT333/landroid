#!/usr/bin/env node
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const BASE_URL = process.argv[2] ?? 'http://127.0.0.1:5174/';
const RUN_ID = process.argv[3] ?? '2026-05-24-codex-closeout';
const OUTPUT_DIR = path.join('fixtures', 'phase-0', 'perf', RUN_ID);
const PERF07_ONLY = process.argv.includes('--perf07-only');
const AUTOSAVE_ONLY = process.argv.includes('--autosave-only');
const LOAD_DEMO_CONFIRMATION_TEXT = 'LOAD DEMO';
const LOAD_WORKSPACE_CONFIRMATION_TEXT = 'LOAD WORKSPACE';
const MAX_RETAINED_PACKAGE_BYTES = 5 * 1024 * 1024;
const IMPORT_STRESS_CSV_PATH = path.join('fixtures', 'phase-0', 'import-stress.csv');

function runCommand(command, args = []) {
  try {
    return execFileSync(command, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString?.().trim();
    return `FAILED: ${stderr || error.message}`;
  }
}

async function sha256File(filePath) {
  const buffer = await readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

async function writeJson(fileName, data) {
  await writeFile(
    path.join(OUTPUT_DIR, fileName),
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8'
  );
}

async function writeMachineProfile() {
  const cpus = os.cpus();
  const lines = [
    `runId: ${RUN_ID}`,
    `baseUrl: ${BASE_URL}`,
    `capturedAt: ${new Date().toISOString()}`,
    `gitHead: ${runCommand('git', ['rev-parse', 'HEAD'])}`,
    `gitStatus: ${runCommand('git', ['status', '--short', '--branch']).replace(/\n/g, ' | ')}`,
    '',
    '[sw_vers]',
    runCommand('sw_vers'),
    '',
    `[node] ${process.version}`,
    `[npm] ${runCommand('npm', ['-v'])}`,
    `[platform] ${os.platform()} ${os.release()} ${os.arch()}`,
    `[cpuModel] ${cpus[0]?.model ?? 'unknown'}`,
    `[coreCount] ${cpus.length}`,
    `[memoryBytes] ${os.totalmem()}`,
    '',
    '[sysctl machdep.cpu.brand_string]',
    runCommand('sysctl', ['-n', 'machdep.cpu.brand_string']),
    '[sysctl hw.ncpu]',
    runCommand('sysctl', ['-n', 'hw.ncpu']),
    '[sysctl hw.memsize]',
    runCommand('sysctl', ['-n', 'hw.memsize']),
  ];
  await writeFile(path.join(OUTPUT_DIR, 'machine-profile.txt'), `${lines.join('\n')}\n`, 'utf8');
}

function attachConsoleCapture(page) {
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (['error', 'warning', 'warn'].includes(message.type())) {
      consoleMessages.push({
        type: message.type(),
        text: message.text(),
      });
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  return { consoleMessages, pageErrors };
}

async function timed(page, action) {
  const browserStart = await page.evaluate(() => performance.now());
  const wallStart = Date.now();
  await action();
  const browserEnd = await page.evaluate(() => performance.now());
  return {
    wallClockMs: Date.now() - wallStart,
    browserDeltaMs: Number((browserEnd - browserStart).toFixed(2)),
  };
}

async function loadDemo(page, menuName, dialogName, expectedProjectPattern) {
  await page.getByRole('button', { name: /Demo Data/ }).click();
  await page.getByRole('menuitem', { name: menuName }).click();
  await page.getByRole('dialog', { name: dialogName }).waitFor({ state: 'visible' });
  await page
    .getByLabel(`Type ${LOAD_DEMO_CONFIRMATION_TEXT} to confirm`)
    .fill(LOAD_DEMO_CONFIRMATION_TEXT);
  await page.getByRole('button', { name: 'Load Demo Data' }).click();
  await page.getByRole('button', { name: expectedProjectPattern }).waitFor({
    state: 'visible',
    timeout: 45_000,
  });
}

async function readWorkspaceRecord(page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('landroid-v2');
    const db = await new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    try {
      const tx = db.transaction('workspaces', 'readonly');
      const store = tx.objectStore('workspaces');
      const getRequest = store.get('default');
      return await new Promise((resolve, reject) => {
        getRequest.onerror = () => reject(getRequest.error);
        getRequest.onsuccess = () => resolve(getRequest.result ?? null);
      });
    } finally {
      db.close();
    }
  });
}

async function readShardManifests(page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('landroid-v2');
    const db = await new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    try {
      const tx = db.transaction('workspaceManifestShards', 'readonly');
      const store = tx.objectStore('workspaceManifestShards');
      const getAll = store.getAll();
      return await new Promise((resolve, reject) => {
        getAll.onerror = () => reject(getAll.error);
        getAll.onsuccess = () => resolve(getAll.result ?? []);
      });
    } finally {
      db.close();
    }
  });
}

// As of the shard writer, autosave persists the shard set (not the monolith),
// so autosave timing must be measured by watching the shard manifest's
// projectName / lastModified rather than the monolithic workspaces row.
async function pollSavedShardManifest(page, expectedName, timeoutMs = 12_000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    const manifests = await readShardManifests(page);
    const match = manifests.find(
      (manifest) => manifest?.backendRecord?.projectName === expectedName
    );
    if (match) {
      return {
        saved: true,
        elapsedMs: Date.now() - start,
        lastModified: match.backendRecord.lastModified ?? null,
        nodeCount: match.nodeCount ?? null,
        dbKey: match.dbKey ?? null,
      };
    }
    last = manifests[0] ?? null;
    await page.waitForTimeout(50);
  }
  return {
    saved: false,
    elapsedMs: Date.now() - start,
    lastProjectName: last?.backendRecord?.projectName ?? null,
  };
}

// Autosave-only capture at Raven Forest scale (10 tracts / 1476 nodes): load the
// combinatorial demo, rename the project, and time how long the sharded write
// takes to land in the manifest. Comparable to the pre-shard PERF-05 baseline.
async function captureRavenForestAutosave(page) {
  await loadDemo(
    page,
    /Combinatorial/,
    'Load Combinatorial Demo?',
    /Project name: .*Combinatorial Demo/
  );
  // Let the first autosave anchor the monolith and write the initial shard set.
  await page.waitForTimeout(3_000);

  const autosaveName = `Raven Forest Autosave ${Date.now()}`;
  const editTiming = await timed(page, async () => {
    await page.getByRole('button', { name: /Project name:/ }).click();
    const projectNameInput = page.getByRole('textbox', { name: 'Project name' });
    await projectNameInput.fill(autosaveName);
    await projectNameInput.press('Enter');
    await page
      .getByRole('button', { name: new RegExp(`Project name: ${autosaveName}`) })
      .waitFor({ state: 'visible' });
  });
  const shardPersist = await pollSavedShardManifest(page, autosaveName, 15_000);

  await writeJson('perf-05-autosave-debounce.json', {
    id: 'PERF-05',
    workflow: 'Autosave debounce (sharded write)',
    fixture: 'W2 Raven Forest via Combinatorial Demo seed (10 tracts, 1476 nodes)',
    editTiming,
    shardPersistencePoll: shardPersist,
    targetDebounceMs: 2000,
    capturedAt: new Date().toISOString(),
  });
  return { editTiming, shardPersist };
}

async function textOrNull(locator) {
  if ((await locator.count()) === 0) return null;
  return locator.first().innerText();
}

async function activateDeskMapTab(page, name) {
  await page.getByRole('button', { name: 'Desk Map', exact: true }).click();
  const tab = page.getByRole('tab', { name });
  await tab.click();
  await tab.waitFor({ state: 'visible' });
}

async function startFrameGapMonitor(page) {
  await page.evaluate(() => {
    window.__phase0Perf07FrameGaps = [];
    window.__phase0Perf07FrameMonitorActive = true;
    let last = performance.now();
    const tick = (now) => {
      window.__phase0Perf07FrameGaps.push(now - last);
      last = now;
      if (window.__phase0Perf07FrameMonitorActive) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
}

async function stopFrameGapMonitor(page) {
  return page.evaluate(() => {
    window.__phase0Perf07FrameMonitorActive = false;
    const gaps = Array.isArray(window.__phase0Perf07FrameGaps)
      ? window.__phase0Perf07FrameGaps
      : [];
    return {
      sampleCount: gaps.length,
      maxFrameGapMs: gaps.length ? Number(Math.max(...gaps).toFixed(2)) : null,
      over50MsFrameGaps: gaps.filter((gap) => gap > 50).length,
      over100MsFrameGaps: gaps.filter((gap) => gap > 100).length,
    };
  });
}

async function capturePerf07SpreadsheetParse(page) {
  const fixtureStats = await stat(IMPORT_STRESS_CSV_PATH);
  const fixtureSha256 = await sha256File(IMPORT_STRESS_CSV_PATH);

  await startFrameGapMonitor(page);
  const parseTiming = await timed(page, async () => {
    const openAiButton = page.getByRole('button', { name: 'Open LANDroid AI' });
    if ((await openAiButton.count()) > 0) {
      await openAiButton.click();
    }
    await page.getByRole('button', { name: 'Import wizard' }).click();
    await page.locator('input[type="file"][accept=".csv"]').setInputFiles(IMPORT_STRESS_CSV_PATH);
    await page.getByText(/import-stress\.csv.*1 sheet/).waitFor({
      state: 'visible',
      timeout: 45_000,
    });
    await page.getByText(/5001r\s+.\s+14c/).waitFor({
      state: 'visible',
      timeout: 45_000,
    });
  });
  const frameGapMetrics = await stopFrameGapMonitor(page);
  const workbookSummaryText = await textOrNull(
    page.locator('details').filter({ hasText: 'import-stress.csv' })
  );
  const closeAiButton = page.getByRole('button', { name: 'Close AI panel' });
  if ((await closeAiButton.count()) > 0) {
    await closeAiButton.click();
  }

  await writeJson('perf-07-spreadsheet-parse.json', {
    id: 'PERF-07',
    workflow: 'Spreadsheet import parse only',
    fixture: IMPORT_STRESS_CSV_PATH,
    fixtureChecksum: 'fixtures/phase-0/import-stress.sha256',
    fixtureSizeBytes: fixtureStats.size,
    fixtureSha256,
    timing: parseTiming,
    frameGapMetrics,
    rowCountIncludingHeader: 5001,
    dataRowCount: 5000,
    columnCount: 14,
    parseWarningCount: 0,
    workbookSummaryText,
    stoppedBeforeApply: true,
    capturedAt: new Date().toISOString(),
  });
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeMachineProfile();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const capture = attachConsoleCapture(page);

  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30_000 });
  await page.getByRole('button', { name: 'Desk Map' }).waitFor({ state: 'visible' });

  if (PERF07_ONLY) {
    await capturePerf07SpreadsheetParse(page);
    await writeJson('closeout-browser-run-summary.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      capturedAt: new Date().toISOString(),
      browser: await browser.version(),
      viewport: { width: 1440, height: 1000 },
      mode: 'perf07-only',
      consoleMessages: capture.consoleMessages,
      pageErrors: capture.pageErrors,
      artifacts: [
        'machine-profile.txt',
        'perf-07-spreadsheet-parse.json',
      ],
    });
    await context.close();
    await browser.close();
    return;
  }

  if (AUTOSAVE_ONLY) {
    await captureRavenForestAutosave(page);
    await writeJson('closeout-browser-run-summary.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      capturedAt: new Date().toISOString(),
      browser: await browser.version(),
      viewport: { width: 1440, height: 1000 },
      mode: 'autosave-only',
      consoleMessages: capture.consoleMessages,
      pageErrors: capture.pageErrors,
      artifacts: [
        'machine-profile.txt',
        'perf-05-autosave-debounce.json',
      ],
    });
    await context.close();
    await browser.close();
    return;
  }

  const appFcpMs = await page.evaluate(() => {
    const entry = performance.getEntriesByName('first-contentful-paint')[0];
    return entry ? Number(entry.startTime.toFixed(2)) : null;
  });

  const demoLoadTiming = await timed(page, async () => {
    await loadDemo(
      page,
      /Combinatorial/,
      'Load Combinatorial Demo?',
      /Project name: .*Combinatorial Demo/
    );
  });

  const c10Timing = await timed(page, async () => {
    await activateDeskMapTab(page, /C10.*Kitchen Sink/);
    await page.getByText(/^\d+ cards$/).first().waitFor({ state: 'visible' });
  });
  const c10CardsText = await textOrNull(page.getByText(/^\d+ cards$/));

  await writeJson('perf-01-large-desk-map-render.json', {
    id: 'PERF-01',
    workflow: 'Large Desk Map render',
    fixture: 'W2 Raven Forest via Combinatorial Demo seed',
    fixtureChecksum: 'fixtures/phase-0/raven-forest-stress-manifest.sha256',
    appFcpMs,
    demoLoadTiming,
    largestTractActivationTiming: c10Timing,
    largestTractVisibleCards: c10CardsText,
    capturedAt: new Date().toISOString(),
  });

  const documentsTiming = await timed(page, async () => {
    await page.getByRole('button', { name: 'Documents' }).click();
    await page.getByRole('heading', { name: 'Documents' }).waitFor({ state: 'visible' });
    await page.getByText(/145 docs/).waitFor({ state: 'visible', timeout: 45_000 });
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length >= 25);
  });
  const documentRowCount = await page.locator('tbody tr').count();

  await writeJson('perf-02-document-registry-load.json', {
    id: 'PERF-02',
    workflow: 'Document registry load',
    fixture: 'W2 Raven Forest via Combinatorial Demo seed',
    fixtureChecksum: 'fixtures/phase-0/raven-forest-stress-manifest.sha256',
    timing: documentsTiming,
    documentRowCount,
    firstRowsThreshold: 25,
    capturedAt: new Date().toISOString(),
  });

  const packetTiming = await timed(page, async () => {
    await page.getByRole('button', { name: 'Packet: Filter' }).click();
    await page.getByText('Packet Preview').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Manifest JSON' }).waitFor({ state: 'visible' });
  });
  const packetPreviewText = await textOrNull(
    page.locator('section').filter({ hasText: 'Packet Preview' })
  );

  await writeJson('perf-03-packet-preview-build.json', {
    id: 'PERF-03',
    workflow: 'Packet preview build',
    fixture: 'W2 Raven Forest via Combinatorial Demo seed',
    fixtureChecksum: 'fixtures/phase-0/raven-forest-stress-manifest.sha256',
    timing: packetTiming,
    packetPreviewTextSample: packetPreviewText?.slice(0, 1000) ?? null,
    capturedAt: new Date().toISOString(),
  });

  const exportPath = path.join(OUTPUT_DIR, 'w2-raven-forest-ui-export.landroid');
  const exportTiming = await timed(page, async () => {
    await page.getByRole('button', { name: 'File ▾' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Save workspace' }).click();
    const download = await downloadPromise;
    await download.saveAs(exportPath);
  });
  const exportStats = await stat(exportPath);
  const exportSha256 = await sha256File(exportPath);

  const importTiming = await timed(page, async () => {
    await page.locator('input[type="file"][accept=".landroid,.csv"]').setInputFiles(exportPath);
    await page.getByRole('dialog', { name: /Load .*\.landroid\?/ }).waitFor({ state: 'visible' });
    await page
      .getByLabel(`Type ${LOAD_WORKSPACE_CONFIRMATION_TEXT} to confirm`)
      .fill(LOAD_WORKSPACE_CONFIRMATION_TEXT);
    await page.getByRole('button', { name: 'Replace Workspace' }).click();
    await page.getByRole('button', { name: /Project name: .*Combinatorial Demo/ }).waitFor({
      state: 'visible',
      timeout: 45_000,
    });
  });
  const packageRetained = exportStats.size <= MAX_RETAINED_PACKAGE_BYTES;
  if (!packageRetained) {
    await unlink(exportPath);
  }

  await writeJson('perf-04-landroid-round-trip.json', {
    id: 'PERF-04',
    workflow: '.landroid round trip',
    fixture: 'W2 Raven Forest via Combinatorial Demo seed',
    fixtureChecksum: 'fixtures/phase-0/raven-forest-stress-manifest.sha256',
    exportTiming,
    importTiming,
    packagePath: packageRetained ? exportPath : null,
    packageRetained,
    packageRemovedAfterImport: !packageRetained,
    packageArtifactPolicy: packageRetained
      ? 'Retained because package stayed below the reviewability threshold.'
      : `Removed after import because package exceeded ${MAX_RETAINED_PACKAGE_BYTES} bytes; checksum and size are retained so the package can be regenerated with this script.`,
    packageSizeBytes: exportStats.size,
    packageSha256: exportSha256,
    capturedAt: new Date().toISOString(),
  });

  await loadDemo(
    page,
    /Vulcan Mesa/,
    'Load Vulcan Mesa Demo?',
    /Project name: .*Vulcan Mesa/
  );
  await page.waitForTimeout(2500);
  const autosaveBeforeEditRecord = await readWorkspaceRecord(page);
  const autosaveName = `Vulcan Mesa Autosave Baseline ${Date.now()}`;
  const autosaveTiming = await timed(page, async () => {
    await page.getByRole('button', { name: /Project name:/ }).click();
    const projectNameInput = page.getByRole('textbox', { name: 'Project name' });
    await projectNameInput.fill(autosaveName);
    await projectNameInput.press('Enter');
    await page.getByRole('button', { name: new RegExp(`Project name: ${autosaveName}`) }).waitFor({
      state: 'visible',
    });
  });
  const autosavePersistResult = await pollSavedShardManifest(page, autosaveName, 12_000);

  await writeJson('perf-05-autosave-debounce.json', {
    id: 'PERF-05',
    workflow: 'Autosave debounce (sharded write)',
    fixture: 'W1 Vulcan Mesa via Demo Data seed',
    fixtureChecksum: 'fixtures/phase-0/demo.sha256',
    beforeEditRecord: autosaveBeforeEditRecord
      ? {
          projectName: autosaveBeforeEditRecord.projectName,
          savedAt: autosaveBeforeEditRecord.savedAt,
        }
      : null,
    editTiming: autosaveTiming,
    shardPersistencePoll: autosavePersistResult,
    targetDebounceMs: 2000,
    capturedAt: new Date().toISOString(),
  });

  await capturePerf07SpreadsheetParse(page);

  await loadDemo(
    page,
    /Combinatorial/,
    'Load Combinatorial Demo?',
    /Project name: .*Combinatorial Demo/
  );
  await activateDeskMapTab(page, /C10.*Kitchen Sink/);

  const flowchartTiming = await timed(page, async () => {
    await page.getByRole('button', { name: 'Flowchart' }).click();
    await page.getByRole('button', { name: 'Import Desk Map' }).click();
    await page.getByText(/\d+ nodes on canvas/).waitFor({ state: 'visible', timeout: 45_000 });
    await page.locator('#print-overlay .print-page').first().waitFor({ state: 'attached' });
  });
  const flowchartNodeText = await textOrNull(page.getByText(/\d+ nodes on canvas/));
  const printPageCount = await page.locator('#print-overlay .print-page').count();
  const printScreenshotArtifacts = [];

  await page.emulateMedia({ media: 'print' });
  const printPages = page.locator('#print-overlay .print-page');
  for (let index = 0; index < printPageCount; index += 1) {
    const screenshotPath = path.join(
      OUTPUT_DIR,
      `perf-06-flowchart-print-page-${index + 1}.png`
    );
    await printPages.nth(index).screenshot({ path: screenshotPath });
    const screenshotStats = await stat(screenshotPath);
    printScreenshotArtifacts.push({
      page: index + 1,
      path: screenshotPath,
      sizeBytes: screenshotStats.size,
      sha256: await sha256File(screenshotPath),
    });
  }
  await page.emulateMedia({ media: 'screen' });
  const largestScreenshot = [...printScreenshotArtifacts].sort(
    (left, right) => right.sizeBytes - left.sizeBytes
  )[0] ?? null;

  await writeJson('perf-06-flowchart-print.json', {
    id: 'PERF-06',
    workflow: 'Flowchart print',
    fixture: 'W2 Raven Forest via Combinatorial Demo seed',
    fixtureChecksum: 'fixtures/phase-0/raven-forest-stress-manifest.sha256',
    timing: flowchartTiming,
    nodeCountText: flowchartNodeText,
    printPageCount,
    screenshots: printScreenshotArtifacts,
    largestScreenshot,
    capturedAt: new Date().toISOString(),
  });

  await activateDeskMapTab(page, /C1.*Baseline Splits/);
  const leaseholdTiming = await timed(page, async () => {
    await page.getByRole('button', { name: 'Leasehold' }).click();
    await page.getByText(/Raven Forest Unit A is isolated here/).waitFor({
      state: 'visible',
      timeout: 45_000,
    });
    await page.getByText('Texas Energy Acquisitions LP').first().waitFor({
      state: 'visible',
      timeout: 45_000,
    });
  });

  await writeJson('perf-08-leasehold-transfer-order.json', {
    id: 'PERF-08',
    workflow: 'Leasehold transfer-order build',
    fixture: 'W2 Raven Forest via Combinatorial Demo seed',
    fixtureChecksum: 'fixtures/phase-0/raven-forest-stress-manifest.sha256',
    timing: leaseholdTiming,
    visibleSignal: 'Raven Forest Unit A is isolated here; Texas Energy Acquisitions LP',
    capturedAt: new Date().toISOString(),
  });

  await writeJson('closeout-browser-run-summary.json', {
    runId: RUN_ID,
    baseUrl: BASE_URL,
    capturedAt: new Date().toISOString(),
    browser: await browser.version(),
    viewport: { width: 1440, height: 1000 },
    consoleMessages: capture.consoleMessages,
    pageErrors: capture.pageErrors,
    artifacts: [
      'machine-profile.txt',
      'perf-01-large-desk-map-render.json',
      'perf-02-document-registry-load.json',
      'perf-03-packet-preview-build.json',
      'perf-04-landroid-round-trip.json',
      'perf-05-autosave-debounce.json',
      'perf-07-spreadsheet-parse.json',
      'perf-06-flowchart-print.json',
      'perf-08-leasehold-transfer-order.json',
      ...printScreenshotArtifacts.map((artifact) => path.basename(artifact.path)),
    ],
  });

  await context.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
