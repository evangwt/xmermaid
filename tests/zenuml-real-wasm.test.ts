import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

beforeAll(async () => {
  await initWasmPackage({
    module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm'),
  });
});

describe('ZenUML real WASM contract', () => {
  it('parses, identifies, and lays out labeled calls and returns', () => {
    const source = 'zenuml\n  Alice->Bob: Authenticate\n  Bob-->Alice: Token';
    const astJson = parseDsl(source);
    const ast = JSON.parse(astJson);
    const layout = renderWithConfig(source, null) as {
      nodes: { id: string }[];
      edges: { from: string; to: string; label: string; style: string }[];
    };

    expect(ast).toMatchObject({
      type: 'zenuml',
      participants: ['Alice', 'Bob'],
      messages: [
        { from: 'Alice', to: 'Bob', label: 'Authenticate', kind: 'call' },
        { from: 'Bob', to: 'Alice', label: 'Token', kind: 'return' },
      ],
    });
    expect(getDiagramType(astJson)).toBe('zenuml');
    expect(layout.nodes.map(node => node.id)).toEqual(['Alice', 'Bob']);
    expect(layout.edges).toMatchObject([
      { from: 'Alice', to: 'Bob', label: 'Authenticate', style: 'arrow' },
      { from: 'Bob', to: 'Alice', label: 'Token', style: 'dotted' },
    ]);
  });
});
