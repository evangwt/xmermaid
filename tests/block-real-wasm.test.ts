import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

const SOURCE = `block-beta
  columns 3
  A B C
  Wide:2 D
  A --> B`;

describe('Block Diagram real WASM contract', () => {
  beforeAll(async () => {
    await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  });

  it('parses, identifies, and lays out a flat grid with spans and relationships', () => {
    const astJson = parseDsl(SOURCE);
    const ast = JSON.parse(astJson) as {
      type: string;
      columns: number;
      blocks: { id: string; label: string; span: number }[];
      relationships: { from: string; to: string; arrow_at_target: boolean }[];
    };

    expect(ast).toMatchObject({ type: 'block', columns: 3 });
    expect(ast.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'A', label: 'A', span: 1 }),
      expect.objectContaining({ id: 'Wide', label: 'Wide', span: 2 }),
    ]));
    expect(ast.relationships).toEqual([{ from: 'A', to: 'B', arrow_at_target: true }]);
    expect(getDiagramType(astJson)).toBe('block');

    const layout = renderWithConfig(SOURCE, null) as {
      block_diagram: { columns: number; blocks: { id: string; bounds: { width: number } }[] };
      edges: { from: string; to: string }[];
    };
    expect(layout.block_diagram.columns).toBe(3);
    expect(layout.block_diagram.blocks.find(block => block.id === 'Wide')!.bounds.width)
      .toBeGreaterThan(layout.block_diagram.blocks.find(block => block.id === 'A')!.bounds.width);
    expect(layout.edges).toContainEqual(expect.objectContaining({ from: 'A', to: 'B' }));
  });
});
