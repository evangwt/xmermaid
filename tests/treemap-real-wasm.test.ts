import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

// Mermaid 11.16.0: https://mermaid.js.org/syntax/treemap.html
const SOURCE = `treemap-beta
"Category A"
    "Item A1": 10
    "Item A2": 20
"Category B"
    "Item B1": 15
    "Item B2": 25`;

describe('Treemap Diagram real WASM contract', () => {
  beforeAll(async () => {
    await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  });

  it('parses and lays out the documented nested-label and numeric-leaf syntax', () => {
    const astJson = parseDsl(SOURCE);
    const ast = JSON.parse(astJson) as {
      type: string;
      nodes: { label: string; value: number | null; parent: string | null }[];
    };
    const layout = renderWithConfig(SOURCE, null) as {
      treemap: { nodes: { label: string; value: number; bounds: { width: number; height: number } }[] };
      nodes: unknown[];
      edges: unknown[];
    };

    expect(ast).toMatchObject({ type: 'treemap' });
    expect(ast.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Category A', value: null, parent: null }),
      expect.objectContaining({ label: 'Item A1', value: 10, parent: 'Category A' }),
      expect.objectContaining({ label: 'Item B2', value: 25, parent: 'Category B' }),
    ]));
    expect(getDiagramType(astJson)).toBe('treemap');
    expect(layout.treemap.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Item A2', value: 20, bounds: expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }) }),
    ]));
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
  });
});
