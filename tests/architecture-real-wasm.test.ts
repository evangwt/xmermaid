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

describe('Architecture Diagram real WASM contract', () => {
  it('parses, identifies, and lays out declared services with direct relationships', () => {
    const source = 'architecture-beta\n  service db(database)[Database]\n  service api(server)[API]\n  db:R --> L:api';
    const astJson = parseDsl(source);
    const ast = JSON.parse(astJson);
    const layout = renderWithConfig(source, null) as {
      nodes: { id: string; label: string }[];
      edges: { from: string; to: string; style: string }[];
    };

    expect(ast).toMatchObject({ type: 'architecture', services: [{ id: 'db' }, { id: 'api' }] });
    expect(getDiagramType(astJson)).toBe('architecture');
    expect(layout.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'db', label: 'Database' }),
      expect.objectContaining({ id: 'api', label: 'API' }),
    ]));
    expect(layout.edges).toEqual([expect.objectContaining({ from: 'db', to: 'api', style: 'arrow' })]);
  });
});
