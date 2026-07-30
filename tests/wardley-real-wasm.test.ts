import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

// Mermaid 11.16.0: https://mermaid.js.org/syntax/wardley.html
const SOURCE = `wardley-beta
title Tea shop value chain
anchor Business [0.95, 0.63]
component Tea [0.63, 0.81]
component Kettle [0.43, 0.35]
Business -> Tea
Tea -> Kettle`;

describe('Wardley Map real WASM contract', () => {
  beforeAll(async () => {
    await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  });

  it('preserves coordinate-based anchors, components, and dependencies', () => {
    const astJson = parseDsl(SOURCE);
    const ast = JSON.parse(astJson) as {
      type: string;
      title: string;
      components: { id: string; label: string; x: number; y: number; anchor: boolean }[];
      dependencies: { from: string; to: string }[];
    };
    const layout = renderWithConfig(SOURCE, null) as {
      wardley: {
        title: string;
        components: { id: string; anchor: boolean; center: { x: number; y: number } }[];
        dependencies: { from: string; to: string }[];
      };
    };

    expect(ast).toMatchObject({ type: 'wardley', title: 'Tea shop value chain' });
    expect(ast.components).toEqual(expect.arrayContaining([
      { id: 'Business', label: 'Business', x: .95, y: .63, anchor: true },
      { id: 'Tea', label: 'Tea', x: .63, y: .81, anchor: false },
    ]));
    expect(ast.dependencies).toEqual([{ from: 'Business', to: 'Tea' }, { from: 'Tea', to: 'Kettle' }]);
    expect(getDiagramType(astJson)).toBe('wardley');
    expect(layout.wardley.title).toBe('Tea shop value chain');
    expect(layout.wardley.components).toHaveLength(3);
    expect(layout.wardley.dependencies).toHaveLength(2);
    expect(layout.wardley.components.find(component => component.id === 'Business')?.anchor).toBe(true);
  });
});
