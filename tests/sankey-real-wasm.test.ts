import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

beforeAll(async () => {
  await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
});

describe('Sankey real WASM contract', () => {
  it('parses, identifies, and emits weighted native geometry', () => {
    const source = 'sankey\nA,B,8\nA,C,4\nB,D,8\nC,D,4';
    const astJson = parseDsl(source);
    const ast = JSON.parse(astJson);
    const layout = renderWithConfig(source, null) as {
      nodes: unknown[];
      edges: unknown[];
      sankey: { nodes: unknown[]; links: { thickness: number }[] };
    };

    expect(ast).toMatchObject({ type: 'sankey', nodes: ['A', 'B', 'C', 'D'] });
    expect(getDiagramType(astJson)).toBe('sankey');
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.sankey.nodes).toHaveLength(4);
    expect(layout.sankey.links).toEqual(expect.arrayContaining([expect.objectContaining({ thickness: expect.any(Number) })]));
  });
});
