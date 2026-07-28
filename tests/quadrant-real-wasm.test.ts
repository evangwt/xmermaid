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

describe('Quadrant Chart real WASM contract', () => {
  it('parses, identifies, and emits quadrant-native layout geometry', () => {
    const source = 'quadrantChart\n  Campaign A: [0.25, 0.75]';
    const astJson = parseDsl(source);
    const ast = JSON.parse(astJson);
    const layout = renderWithConfig(source, null) as {
      nodes: unknown[];
      edges: unknown[];
      quadrant_chart: { points: { label: string; center: { x: number; y: number } }[] };
    };

    expect(ast).toMatchObject({ type: 'quadrant', points: [{ label: 'Campaign A', x: 0.25, y: 0.75 }] });
    expect(getDiagramType(astJson)).toBe('quadrant');
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.quadrant_chart.points).toEqual([
      expect.objectContaining({
        label: 'Campaign A',
        center: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      }),
    ]);
  });
});
