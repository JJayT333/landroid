const fs = require('fs');
const path = require('path');
const mathEngine = require('../src/mathEngine.js');

const FRACTION_EPSILON = mathEngine.FRACTION_EPSILON;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  cells.push(current);
  return cells;
}

function parseCsv(content) {
  const normalized = String(content || '').replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0);
  assert(lines.length >= 2, 'CSV missing header or rows');
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] ?? '';
    });
    return row;
  });
  return { headers, rows };
}

function parseJsonField(row, field, filePath) {
  const raw = row[field];
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${filePath}: failed to parse ${field}: ${error.message}`);
  }
}

function validateDeskMaps(deskMaps, filePath) {
  assert(Array.isArray(deskMaps), `${filePath}: INTERNAL_DESKMAPS must be an array`);
  deskMaps.forEach((map) => {
    const nodes = map.nodes || [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    nodes.forEach((node) => {
      const frac = Number(node.fraction || 0);
      const initial = Number(node.initialFraction || 0);
      assert(Number.isFinite(frac), `${filePath}: non-finite fraction @ ${node.id}`);
      assert(Number.isFinite(initial), `${filePath}: non-finite initialFraction @ ${node.id}`);
      assert(frac >= -FRACTION_EPSILON, `${filePath}: negative fraction @ ${node.id}`);
      assert(initial >= -FRACTION_EPSILON, `${filePath}: negative initialFraction @ ${node.id}`);
      if (node.parentId !== null && node.parentId !== 'unlinked') {
        assert(byId.has(node.parentId), `${filePath}: missing parent ${node.parentId} @ ${node.id}`);
      }
    });
  });
}

function validateCsvFixture(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { headers, rows } = parseCsv(raw);
  const needed = [
    'INTERNAL_REMAINING_FRACTION',
    'INTERNAL_INITIAL_FRACTION',
    'INTERNAL_ID',
    'INTERNAL_PID',
    'INTERNAL_TYPE',
    'INTERNAL_DESKMAPS',
  ];
  needed.forEach((header) => {
    assert(headers.includes(header), `${filePath}: missing required header ${header}`);
  });

  const firstRow = rows[0] || {};
  const deskMaps = parseJsonField(firstRow, 'INTERNAL_DESKMAPS', filePath);
  validateDeskMaps(deskMaps, filePath);

  const rowCount = rows.length;
  if (filePath.endsWith('deskmap-stress-5x200.import.csv')) {
    assert(rowCount === 1000, `${filePath}: expected 1000 rows, got ${rowCount}`);
    assert(deskMaps.length === 5, `${filePath}: expected embedded 5 desk maps, got ${deskMaps.length}`);
  }


  if (filePath.endsWith('upload-assorted-200.import.csv')) {
    assert(rowCount >= 200 && rowCount <= 300, `${filePath}: expected 200-300 rows, got ${rowCount}`);
    assert(deskMaps.length === 1, `${filePath}: expected a single desk map, got ${deskMaps.length}`);
    const mapNodes = deskMaps[0].nodes || [];
    const total = mathEngine.rootOwnershipTotal(mapNodes);
    assert(Math.abs(total - 1) <= FRACTION_EPSILON, `${filePath}: expected root ownership total to equal 1, got ${total}`);

    const allowedFractions = new Set([0, 0.0625, 0.125, 0.25, 0.5, 1]);
    mapNodes
      .filter((node) => node.type === 'conveyance')
      .forEach((node) => {
        const initial = Number(node.initialFraction || 0);
        assert(allowedFractions.has(initial), `${filePath}: unexpected conveyance initial fraction ${initial} at ${node.id}`);
      });

    const rootNodes = mapNodes.filter((node) => node.type === 'conveyance' && node.parentId === null);
    assert(rootNodes.length === 1, `${filePath}: expected exactly one root conveyance node`);
    assert(Math.abs(Number(rootNodes[0].fraction || 0)) <= FRACTION_EPSILON, `${filePath}: expected root remaining fraction to be 0 after full conveyance`);
  }


  if (filePath.endsWith('upload-variant-1024.import.csv')) {
    assert(rowCount === 1099, `${filePath}: expected 1099 rows, got ${rowCount}`);
    assert(deskMaps.length === 1, `${filePath}: expected single desk map`);
    const mapNodes = deskMaps[0].nodes || [];
    const rootTotal = mathEngine.rootOwnershipTotal(mapNodes);
    assert(Math.abs(rootTotal - 1) <= FRACTION_EPSILON, `${filePath}: expected root ownership total 1, got ${rootTotal}`);
    const conveyance = mapNodes.filter((node) => node.type === 'conveyance');
    const leaves = conveyance.filter((node) => Math.abs(Number(node.fraction || 0)) > FRACTION_EPSILON);
    assert(leaves.length === 1024, `${filePath}: expected 1024 leaf holders, got ${leaves.length}`);
  }

  if (filePath.endsWith('upload-variant-512.import.csv')) {
    assert(rowCount === 587, `${filePath}: expected 587 rows, got ${rowCount}`);
    assert(deskMaps.length === 1, `${filePath}: expected single desk map`);
    const mapNodes = deskMaps[0].nodes || [];
    const rootTotal = mathEngine.rootOwnershipTotal(mapNodes);
    assert(Math.abs(rootTotal - 1) <= FRACTION_EPSILON, `${filePath}: expected root ownership total 1, got ${rootTotal}`);
    const conveyance = mapNodes.filter((node) => node.type === 'conveyance');
    const leaves = conveyance.filter((node) => Math.abs(Number(node.fraction || 0)) > FRACTION_EPSILON);
    assert(leaves.length === 512, `${filePath}: expected 512 leaf holders, got ${leaves.length}`);
  }
}

function walkCsvFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.csv')) out.push(full);
    });
  }
  return out.sort();
}

function run() {
  const cwd = process.cwd();
  const csvFiles = [];

  // Scan root-level realistic test CSVs
  fs.readdirSync(cwd).forEach((entry) => {
    if (entry.endsWith('.import.csv') && entry.startsWith('test-')) {
      csvFiles.push(path.join(cwd, entry));
    }
  });

  // Scan testdata/ if it exists
  const testdataDir = path.join(cwd, 'testdata');
  if (fs.existsSync(testdataDir)) {
    csvFiles.push(...walkCsvFiles(testdataDir));
  }

  assert(csvFiles.length > 0, 'No CSV fixtures found');
  csvFiles.sort().forEach((file) => validateCsvFixture(file));
  console.log(`CSV fixture checks passed (${csvFiles.length} files)`);
}

run();
