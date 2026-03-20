/**
 * CSV import tests — verifies parsing of v1-format CSV files
 * and correct conversion to v2 OwnershipNode format.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { importCSV } from '../csv-io';
import { d } from '../../engine/decimal';
import { validateOwnershipGraph } from '../../engine/math-engine';
import { layoutOwnershipTree } from '../../engine/tree-layout';

function readTestCSV(filename: string): string {
  const path = resolve(__dirname, '..', '..', '..', '..', filename);
  return readFileSync(path, 'utf-8');
}

describe('importCSV — 200a (deep binary)', () => {
  it('imports and validates', () => {
    const csv = readTestCSV('test-200a-v2.import.csv');
    const result = importCSV(csv);

    expect(result.nodes.length).toBe(200);
    expect(result.deskMaps.length).toBe(1);
    expect(result.activeDeskMapId).toBeTruthy();

    const root = result.nodes.find(n => n.id === 'root');
    expect(root).toBeTruthy();
    expect(root!.initialFraction).toBe('1.000000000');

    for (const node of result.nodes) {
      expect(d(node.fraction).isFinite()).toBe(true);
      expect(d(node.initialFraction).isFinite()).toBe(true);
      expect(d(node.fraction).greaterThanOrEqualTo(0)).toBe(true);
    }

    expect(validateOwnershipGraph(result.nodes).valid).toBe(true);
  });

  it('layout produces correct node count', () => {
    const csv = readTestCSV('test-200a-v2.import.csv');
    const result = importCSV(csv);
    const layout = layoutOwnershipTree(result.nodes);

    expect(layout.flowNodes.length).toBe(result.nodes.length);
    for (const node of layout.flowNodes) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
  });
});

describe('importCSV — 200b (wide quaternary)', () => {
  it('imports and validates', () => {
    const csv = readTestCSV('test-200b-v2.import.csv');
    const result = importCSV(csv);

    expect(result.nodes.length).toBe(200);
    expect(validateOwnershipGraph(result.nodes).valid).toBe(true);
  });

  it('layout produces correct node count', () => {
    const csv = readTestCSV('test-200b-v2.import.csv');
    const result = importCSV(csv);
    const layout = layoutOwnershipTree(result.nodes);
    expect(layout.flowNodes.length).toBe(result.nodes.length);
  });
});

describe('importCSV — 500a (mixed realistic)', () => {
  it('imports and validates', () => {
    const csv = readTestCSV('test-500a-v2.import.csv');
    const result = importCSV(csv);

    expect(result.nodes.length).toBeGreaterThan(200);
    expect(result.nodes.length).toBeLessThanOrEqual(512);
    expect(validateOwnershipGraph(result.nodes).valid).toBe(true);
  });

  it('layout produces correct node count', () => {
    const csv = readTestCSV('test-500a-v2.import.csv');
    const result = importCSV(csv);
    const layout = layoutOwnershipTree(result.nodes);
    expect(layout.flowNodes.length).toBe(result.nodes.length);
  });
});

describe('importCSV — 500b (branchy partial)', () => {
  it('imports and validates', () => {
    const csv = readTestCSV('test-500b-v2.import.csv');
    const result = importCSV(csv);

    expect(result.nodes.length).toBeGreaterThan(200);
    expect(result.nodes.length).toBeLessThanOrEqual(512);
    expect(validateOwnershipGraph(result.nodes).valid).toBe(true);
  });

  it('layout produces correct node count', () => {
    const csv = readTestCSV('test-500b-v2.import.csv');
    const result = importCSV(csv);
    const layout = layoutOwnershipTree(result.nodes);
    expect(layout.flowNodes.length).toBe(result.nodes.length);
  });
});

describe('fraction format', () => {
  it('all fractions are valid 9-decimal-place strings', () => {
    const csv = readTestCSV('test-200a-v2.import.csv');
    const result = importCSV(csv);

    for (const node of result.nodes) {
      expect(node.fraction).toMatch(/^\d+\.\d{9}$/);
      expect(node.initialFraction).toMatch(/^\d+\.\d{9}$/);
    }
  });
});
