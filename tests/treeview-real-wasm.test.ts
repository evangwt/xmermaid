import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, { get_diagram_type as getDiagramType, parse_dsl as parseDsl, render_with_config as renderWithConfig } from '../pkg/xmermaid_wasm.js';

const SOURCE = `tree
  Product
    Mobile
      iOS
      Android
    Web`;

describe('Treeview Diagram real WASM contract', () => {
  beforeAll(async () => { await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') }); });

  it('parses an indented tree hierarchy into native nodes and parent-child edges', () => {
    const astJson = parseDsl(SOURCE);
    const ast = JSON.parse(astJson) as { type: string; nodes: { label: string; parent: string | null }[] };
    const layout = renderWithConfig(SOURCE, null) as { nodes: { id: string; label: string }[]; edges: { from: string; to: string }[] };

    expect(ast).toMatchObject({ type: 'treeview' });
    expect(ast.nodes.map(node => node.label)).toEqual(['Product', 'Mobile', 'iOS', 'Android', 'Web']);
    expect(ast.nodes[1]?.parent).toBe(ast.nodes[0]?.id);
    expect(getDiagramType(astJson)).toBe('treeview');
    expect(layout.nodes).toHaveLength(5);
    expect(layout.edges).toHaveLength(4);
  });
});
