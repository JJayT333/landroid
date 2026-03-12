const mathEngine = require('../src/mathEngine.js');
const fs = require('fs');
const path = require('path');

const FRACTION_EPSILON = mathEngine.FRACTION_EPSILON;
const OWNERSHIP_TOTAL_TOLERANCE = mathEngine.OWNERSHIP_TOTAL_TOLERANCE || 0.05;
const clampFraction = mathEngine.clampFraction;
const collectDescendantIds = mathEngine.collectDescendantIds;
const applyBranchScale = mathEngine.applyBranchScale;
const MAP_COUNT = 5;
const NODES_PER_MAP = 200;

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeIdFactory(prefix) {
  let index = 0;
  return () => `${prefix}-${++index}`;
}

function randomDate(rng) {
  const year = 1980 + Math.floor(rng() * 45);
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function makeNode(id, parentId, fraction, grantor, grantee, type, mapLabel, rng, remarks) {
  const date = randomDate(rng);
  return {
    id,
    parentId,
    instrument: type === 'related' ? 'Affidavit of Heirship' : 'Warranty Deed',
    vol: String(100 + Math.floor(rng() * 900)),
    page: String(1 + Math.floor(rng() * 500)),
    docNo: `${mapLabel.replace(/\s+/g, '')}-${Math.floor(rng() * 1_000_000)}`,
    fileDate: date,
    date,
    grantor,
    grantee,
    landDesc: `${mapLabel} / Tract ${1 + Math.floor(rng() * 40)}`,
    remarks: remarks || '',
    fraction: clampFraction(fraction),
    initialFraction: clampFraction(fraction),
    docData: '',
    type,
    isDeceased: false,
    obituary: '',
    graveyardLink: '',
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateMap(map) {
  const nodes = map.nodes || [];
  assert(nodes.length === NODES_PER_MAP, `${map.code}: expected ${NODES_PER_MAP} nodes, got ${nodes.length}`);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  assert(byId.size === nodes.length, `${map.code}: duplicate IDs`);

  for (const node of nodes) {
    assert(Number.isFinite(node.fraction), `${map.code}: non-finite fraction @ ${node.id}`);
    assert(Number.isFinite(node.initialFraction), `${map.code}: non-finite initialFraction @ ${node.id}`);
    assert(node.fraction >= -FRACTION_EPSILON, `${map.code}: negative fraction @ ${node.id}`);
    assert(node.initialFraction >= -FRACTION_EPSILON, `${map.code}: negative initialFraction @ ${node.id}`);
    if (node.parentId !== null && node.parentId !== 'unlinked') {
      assert(byId.has(node.parentId), `${map.code}: missing parent ${node.parentId}`);
      assert(node.parentId !== node.id, `${map.code}: self-parent at ${node.id}`);
    }
  }

  // cycle detection
  const visiting = new Set();
  const visited = new Set();
  function dfs(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`${map.code}: cycle detected at ${id}`);
    visiting.add(id);
    for (const child of nodes) {
      if (child.parentId === id) dfs(child.id);
    }
    visiting.delete(id);
    visited.add(id);
  }
  nodes.filter((n) => n.parentId === null).forEach((n) => dfs(n.id));

  const rootSums = new Map();
  for (const node of nodes) {
    if (node.type === 'related' || node.fraction <= FRACTION_EPSILON) continue;
    if (node.parentId === 'unlinked') continue;
    let cursor = node;
    while (cursor.parentId !== null) {
      cursor = byId.get(cursor.parentId);
      if (!cursor) throw new Error(`${map.code}: missing ancestor for ${node.id}`);
    }
    rootSums.set(cursor.id, (rootSums.get(cursor.id) || 0) + node.fraction);
  }
  for (const [rootId, sum] of rootSums.entries()) {
    assert(sum <= 1 + OWNERSHIP_TOTAL_TOLERANCE, `${map.code}: root ${rootId} > 100% (${sum})`);
    assert(sum >= -FRACTION_EPSILON, `${map.code}: root ${rootId} negative (${sum})`);
  }
}

function normalizeLinkedConveyanceTotal(map) {
  const nodes = map.nodes || [];
  const scoped = nodes.filter(
    (node) => node.type === 'conveyance' && node.parentId !== 'unlinked' && Number(node.fraction || 0) > FRACTION_EPSILON
  );
  const total = scoped.reduce((sum, node) => sum + Number(node.fraction || 0), 0);
  if (!Number.isFinite(total) || total <= FRACTION_EPSILON) return;

  const scale = 1 / total;
  map.nodes = nodes.map((node) => {
    if (node.type !== 'conveyance' || node.parentId === 'unlinked') return node;
    return {
      ...node,
      fraction: clampFraction((node.fraction || 0) * scale),
      initialFraction: clampFraction((node.initialFraction || 0) * scale),
    };
  });
}

function buildDeskMap(mapIndex) {
  const seed = 1000 + mapIndex * 97;
  const rng = createRng(seed);
  const makeId = makeIdFactory(`m${mapIndex}`);
  const code = `STRESS-${mapIndex}`;
  const name = `Stress Map ${mapIndex}`;
  const mapLabel = `${code}-${name}`;

  const nodes = [];
  const map = {
    id: `deskmap-stress-${mapIndex}`,
    code,
    name,
    tractId: `tract-stress-${mapIndex}`,
    pz: { x: 0, y: 0, z: 1 },
    nodes,
  };

  // Canonical root
  const root = makeNode(makeId(), null, 1, 'Origin', `RootOwner-${mapIndex}`, 'conveyance', mapLabel, rng, 'root');
  nodes.push(root);

  // Grow to ~175 nodes with mixed conveyance modes and occasional related docs.
  while (nodes.length < 175) {
    const conveyanceNodes = nodes.filter((n) => n.type === 'conveyance');
    const parentCandidates = conveyanceNodes.filter((n) => n.fraction > 0.0005);
    if (!parentCandidates.length) break;
    const parent = parentCandidates[Math.floor(rng() * parentCandidates.length)];

    const modePick = rng();
    const splitPick = rng();
    let share;
    let modeLabel;
    if (modePick < 0.2) {
      modeLabel = 'all';
      share = parent.fraction;
    } else if (modePick < 0.45) {
      modeLabel = 'fixed';
      share = parent.fraction * (0.05 + rng() * 0.25);
    } else {
      modeLabel = 'fraction';
      const ratio = 0.08 + rng() * 0.55;
      // Simulate splitBasis variants while preserving realistic outcomes.
      if (splitPick < 0.33) {
        share = 1 * ratio * Math.min(1, parent.fraction);
      } else if (splitPick < 0.66) {
        share = (parent.initialFraction || parent.fraction) * ratio;
      } else {
        share = parent.fraction * ratio;
      }
    }

    share = clampFraction(Math.min(share, parent.fraction));
    if (share <= FRACTION_EPSILON) continue;

    parent.fraction = clampFraction(parent.fraction - share);
    const child = makeNode(
      makeId(),
      parent.id,
      share,
      parent.grantee,
      `Owner-${mapIndex}-${nodes.length}`,
      'conveyance',
      mapLabel,
      rng,
      `[mode:${modeLabel}]`
    );
    nodes.push(child);

    // add related records occasionally
    if (nodes.length < 175 && rng() < 0.14) {
      nodes.push(makeNode(
        makeId(),
        child.id,
        0,
        '',
        child.grantee,
        'related',
        mapLabel,
        rng,
        '[related]'
      ));
    }
  }

  // Add loose/unlinked records for attach coverage.
  while (nodes.length < 182) {
    const looseFraction = 0.01 + rng() * 0.03;
    nodes.push(makeNode(
      makeId(),
      'unlinked',
      looseFraction,
      `Unknown-${mapIndex}`,
      `Loose-${mapIndex}-${nodes.length}`,
      'conveyance',
      mapLabel,
      rng,
      '[unlinked]'
    ));
  }

  // Attach several loose roots into valid destinations with branch scaling.
  for (let i = 0; i < 6; i += 1) {
    const source = nodes.find((n) => n.parentId === 'unlinked' && n.type === 'conveyance' && n.fraction > 0);
    const destinations = nodes.filter((n) => n.type === 'conveyance' && n.parentId !== 'unlinked' && n.id !== source?.id && n.fraction > 0.002);
    if (!source || !destinations.length) break;
    const destination = destinations[Math.floor(rng() * destinations.length)];
    const descendants = collectDescendantIds(nodes, source.id);
    if (descendants.has(destination.id)) continue;

    const oldRoot = Math.max(source.fraction, FRACTION_EPSILON);
    const newRoot = clampFraction(Math.min(source.fraction, destination.fraction * (0.25 + rng() * 0.5)));
    const scaleFactor = newRoot / oldRoot;

    const scaled = applyBranchScale(nodes, source.id, scaleFactor);
    for (let idx = 0; idx < scaled.length; idx += 1) {
      const n = scaled[idx];
      if (n.id === destination.id) {
        scaled[idx] = { ...n, fraction: clampFraction((n.fraction || 0) - newRoot) };
      } else if (n.id === source.id) {
        scaled[idx] = {
          ...n,
          parentId: destination.id,
          fraction: newRoot,
          initialFraction: newRoot,
          remarks: `${n.remarks} [attached]`.trim(),
        };
      }
    }

    nodes.length = 0;
    nodes.push(...scaled);
  }

  // Insert predecessor-style records and rebalance-style branch scales.
  let predecessorOps = 0;
  while (predecessorOps < 8) {
    const targetCandidates = nodes.filter((n) => n.type === 'conveyance' && n.parentId && n.parentId !== 'unlinked');
    if (!targetCandidates.length) break;
    const active = targetCandidates[Math.floor(rng() * targetCandidates.length)];
    const parent = nodes.find((n) => n.id === active.parentId);
    if (!parent) {
      predecessorOps += 1;
      continue;
    }

    const oldInitial = Math.max(active.initialFraction || 0, FRACTION_EPSILON);
    const maxAllowed = oldInitial + Math.max(parent.fraction || 0, 0);
    const newInitial = clampFraction(Math.min(oldInitial * (0.6 + rng() * 1.2), maxAllowed));
    const scaleFactor = newInitial / oldInitial;

    const scaled = applyBranchScale(nodes, active.id, scaleFactor);
    const predecessorId = makeId();
    for (let idx = 0; idx < scaled.length; idx += 1) {
      const n = scaled[idx];
      if (n.id === parent.id) {
        scaled[idx] = { ...n, fraction: clampFraction((n.fraction || 0) + oldInitial - newInitial) };
      }
      if (n.id === active.id) {
        scaled[idx] = { ...n, parentId: predecessorId, remarks: `${n.remarks} [preceded]`.trim() };
      }
    }

    scaled.push(makeNode(
      predecessorId,
      parent.id,
      0,
      'Predecessor',
      `${active.grantor || 'Pred'}-${predecessorOps}`,
      'conveyance',
      mapLabel,
      rng,
      '[predecessor]'
    ));

    nodes.length = 0;
    nodes.push(...scaled);
    predecessorOps += 1;
  }

  // Pad to exactly 200 nodes with balanced low-impact records.
  while (nodes.length < NODES_PER_MAP) {
    const parentCandidates = nodes.filter((n) => n.type === 'conveyance' && n.parentId !== 'unlinked' && n.fraction > 0.0008);
    if (!parentCandidates.length) break;
    const parent = parentCandidates[Math.floor(rng() * parentCandidates.length)];
    const share = clampFraction(Math.min(parent.fraction, 0.0005 + rng() * 0.003));
    if (share <= FRACTION_EPSILON) continue;
    parent.fraction = clampFraction(parent.fraction - share);
    nodes.push(makeNode(
      makeId(),
      parent.id,
      share,
      parent.grantee,
      `Tail-${mapIndex}-${nodes.length}`,
      'conveyance',
      mapLabel,
      rng,
      '[tail-convey]'
    ));
  }

  // If overshot due predecessor insertion, trim from end (prefer related/tail records).
  while (nodes.length > NODES_PER_MAP) {
    const removableIdx = nodes.findLastIndex((n) => n.type === 'related' || /tail-convey/.test(n.remarks || ''));
    if (removableIdx <= 0) break;
    const [removed] = nodes.splice(removableIdx, 1);
    if (removed.parentId && removed.parentId !== 'unlinked') {
      const parent = nodes.find((n) => n.id === removed.parentId);
      if (parent && removed.type === 'conveyance') {
        parent.fraction = clampFraction((parent.fraction || 0) + (removed.initialFraction || removed.fraction || 0));
      }
    }
  }

  if (nodes.length !== NODES_PER_MAP) {
    throw new Error(`${code}: unable to finalize exactly ${NODES_PER_MAP} nodes; got ${nodes.length}`);
  }

  normalizeLinkedConveyanceTotal(map);
  validateMap(map);
  return map;
}

function buildWorkspace() {
  const deskMaps = [];
  for (let i = 1; i <= MAP_COUNT; i += 1) {
    deskMaps.push(buildDeskMap(i));
  }

  const tracts = deskMaps.map((map, index) => ({
    id: map.tractId,
    code: `TRACT-${index + 1}`,
    name: `Stress Tract ${index + 1}`,
    acres: 40 + (index * 7),
    mapId: map.code,
  }));

  return {
    generatedAt: new Date().toISOString(),
    profile: {
      mapCount: MAP_COUNT,
      nodesPerMap: NODES_PER_MAP,
      totalNodes: MAP_COUNT * NODES_PER_MAP,
      description: 'Deterministic stress dataset with mixed conveyance/precede/attach/related/unlinked patterns',
    },
    activeDeskMapId: deskMaps[0].id,
    tracts,
    deskMaps,
  };
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  return `"${String(val).replace(/"/g, '""')}"`;
}

function workspaceToImportCsv(workspace) {
  const headers = [
    'Documents Hyperlinked', 'Instrument', 'Order by Date', 'Image Path', 'Vol', 'Page', 'Inst No.',
    'File Date', 'Inst Date', 'Grantor / Assignor', 'Grantee / Assignee', 'Land Desc.', 'Remarks',
    'INTERNAL_REMAINING_FRACTION', 'INTERNAL_INITIAL_FRACTION', 'INTERNAL_ID', 'INTERNAL_PID',
    'INTERNAL_DOC', 'INTERNAL_TYPE', 'INTERNAL_DECEASED', 'INTERNAL_OBITUARY', 'INTERNAL_GRAVEYARD_LINK',
    'INTERNAL_TRACTS', 'INTERNAL_CONTACTS', 'INTERNAL_INTERESTS', 'INTERNAL_CONTACT_LOGS', 'INTERNAL_DESKMAPS',
    'INTERNAL_ACTIVE_DESKMAP_ID'
  ];

  const rows = [];
  const flatNodes = workspace.deskMaps.flatMap((map) => map.nodes);
  flatNodes.forEach((n, index) => {
    rows.push([
      index + 1,
      n.instrument,
      index + 1,
      `TORS_Documents\\${n.docNo}.pdf`,
      n.vol,
      n.page,
      n.docNo,
      n.fileDate,
      n.date,
      n.grantor,
      n.grantee,
      n.landDesc,
      n.remarks,
      n.fraction,
      n.initialFraction,
      n.id,
      n.parentId === null ? 'NULL' : n.parentId,
      '',
      n.type,
      n.isDeceased ? 'true' : 'false',
      n.obituary || '',
      n.graveyardLink || '',
      index === 0 ? JSON.stringify(workspace.tracts || []) : '',
      index === 0 ? '[]' : '',
      index === 0 ? '[]' : '',
      index === 0 ? '[]' : '',
      index === 0 ? JSON.stringify(workspace.deskMaps) : '',
      index === 0 ? workspace.activeDeskMapId : '',
    ]);
  });

  const body = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  return `\uFEFF${headers.join(',')}\n${body}\n`;
}


function mapToImportCsv(map, tract) {
  const headers = [
    'Documents Hyperlinked', 'Instrument', 'Order by Date', 'Image Path', 'Vol', 'Page', 'Inst No.',
    'File Date', 'Inst Date', 'Grantor / Assignor', 'Grantee / Assignee', 'Land Desc.', 'Remarks',
    'INTERNAL_REMAINING_FRACTION', 'INTERNAL_INITIAL_FRACTION', 'INTERNAL_ID', 'INTERNAL_PID',
    'INTERNAL_DOC', 'INTERNAL_TYPE', 'INTERNAL_DECEASED', 'INTERNAL_OBITUARY', 'INTERNAL_GRAVEYARD_LINK',
    'INTERNAL_TRACTS', 'INTERNAL_CONTACTS', 'INTERNAL_INTERESTS', 'INTERNAL_CONTACT_LOGS', 'INTERNAL_DESKMAPS',
    'INTERNAL_ACTIVE_DESKMAP_ID'
  ];

  const rows = (map.nodes || []).map((n, index) => [
    index + 1,
    n.instrument,
    index + 1,
    `TORS_Documents\\${n.docNo}.pdf`,
    n.vol,
    n.page,
    n.docNo,
    n.fileDate,
    n.date,
    n.grantor,
    n.grantee,
    n.landDesc,
    n.remarks,
    n.fraction,
    n.initialFraction,
    n.id,
    n.parentId === null ? 'NULL' : n.parentId,
    '',
    n.type,
    n.isDeceased ? 'true' : 'false',
    n.obituary || '',
    n.graveyardLink || '',
    index === 0 ? JSON.stringify([tract]) : '',
    index === 0 ? '[]' : '',
    index === 0 ? '[]' : '',
    index === 0 ? '[]' : '',
    index === 0 ? JSON.stringify([{ ...map, nodes: map.nodes || [] }]) : '',
    index === 0 ? map.id : '',
  ]);

  const body = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  return `\uFEFF${headers.join(',')}\n${body}\n`;
}

function writeSplitImportCsvs(workspace, outDir) {
  const splitDir = path.join(outDir, 'split-tract-imports-5x200');
  if (!fs.existsSync(splitDir)) fs.mkdirSync(splitDir, { recursive: true });

  workspace.deskMaps.forEach((map, idx) => {
    const tract = (workspace.tracts || [])[idx] || { id: map.tractId, code: `TRACT-${idx + 1}`, name: `Stress Tract ${idx + 1}` };
    const csv = mapToImportCsv(map, tract);
    const file = path.join(splitDir, `deskmap-stress-tract-${idx + 1}-200.import.csv`);
    fs.writeFileSync(file, csv, 'utf8');
  });

  const readme = [
    '# Split tract import files (5 x 200)',
    '',
    'These files allow importing one 200-record tract at a time.',
    'Each file includes full internal columns and mixed feature combinations',
    '(conveyance modes, related docs, unlinked records, predecessor inserts, attach/rebalance patterns, deceased metadata fields).',
    '',
    'Files:',
    ...workspace.deskMaps.map((_, idx) => `- deskmap-stress-tract-${idx + 1}-200.import.csv`),
  ].join('\n');
  fs.writeFileSync(path.join(splitDir, 'README.md'), readme, 'utf8');

  return splitDir;
}

function summarize(workspace) {
  const summary = workspace.deskMaps.map((map) => {
    const byType = map.nodes.reduce((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1;
      return acc;
    }, {});
    const unlinked = map.nodes.filter((n) => n.parentId === 'unlinked').length;
    const roots = map.nodes.filter((n) => n.parentId === null).length;
    return {
      id: map.id,
      code: map.code,
      name: map.name,
      totalNodes: map.nodes.length,
      conveyances: byType.conveyance || 0,
      related: byType.related || 0,
      rootCount: roots,
      unlinkedCount: unlinked,
    };
  });
  return summary;
}

function run() {
  const t0 = process.hrtime.bigint();
  const workspace = buildWorkspace();
  const t1 = process.hrtime.bigint();

  const jsonStart = process.hrtime.bigint();
  const jsonOutput = JSON.stringify(workspace, null, 2);
  const jsonEnd = process.hrtime.bigint();

  const csvStart = process.hrtime.bigint();
  const csvOutput = workspaceToImportCsv(workspace);
  const csvEnd = process.hrtime.bigint();

  const outDir = path.join(process.cwd(), 'testdata');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'deskmap-stress-5x200.workspace.json');
  const csvPath = path.join(outDir, 'deskmap-stress-5x200.import.csv');
  const summaryPath = path.join(outDir, 'deskmap-stress-5x200.summary.json');

  fs.writeFileSync(jsonPath, jsonOutput, 'utf8');
  fs.writeFileSync(csvPath, csvOutput, 'utf8');
  fs.writeFileSync(summaryPath, JSON.stringify({ generatedAt: workspace.generatedAt, summary: summarize(workspace) }, null, 2));
  const splitDir = writeSplitImportCsvs(workspace, outDir);

  const toMs = (start, end) => Number(end - start) / 1_000_000;
  const buildMs = toMs(t0, t1);
  const jsonMs = toMs(jsonStart, jsonEnd);
  const csvMs = toMs(csvStart, csvEnd);

  console.log('Large desk-map stress dataset created successfully.');
  console.log(`Maps: ${MAP_COUNT}, nodes per map: ${NODES_PER_MAP}, total nodes: ${MAP_COUNT * NODES_PER_MAP}`);
  console.log(`Build/validate time: ${buildMs.toFixed(2)}ms`);
  console.log(`JSON serialization time: ${jsonMs.toFixed(2)}ms`);
  console.log(`CSV generation time: ${csvMs.toFixed(2)}ms`);
  console.log(`Workspace file: ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`Import CSV file: ${path.relative(process.cwd(), csvPath)}`);
  console.log(`Summary file: ${path.relative(process.cwd(), summaryPath)}`);
  console.log(`Split import directory: ${path.relative(process.cwd(), splitDir)}`);
}

run();
