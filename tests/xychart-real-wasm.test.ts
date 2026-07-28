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

describe('XY Chart real WASM contract', () => {
  it('parses, identifies, and emits chart-native layout geometry', () => {
    const source = 'xychart-beta\n  title "Quarterly revenue"\n  x-axis [Q1, Q2]\n  y-axis "Revenue" 0 --> 100\n  bar [20, 40]\n  line [30, 50]';
    const astJson = parseDsl(source);
    const ast = JSON.parse(astJson);
    const layout = renderWithConfig(source, null) as {
      nodes: unknown[];
      edges: unknown[];
      xy_chart: { x_labels: string[]; series: { kind: string; bars: unknown[]; points: unknown[] }[] };
    };

    expect(ast).toMatchObject({ type: 'xychart', title: 'Quarterly revenue', x_labels: ['Q1', 'Q2'] });
    expect(getDiagramType(astJson)).toBe('xychart');
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.xy_chart).toMatchObject({ x_labels: ['Q1', 'Q2'] });
    expect(layout.xy_chart.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'bar', bars: expect.any(Array) }),
      expect.objectContaining({ kind: 'line', points: expect.any(Array) }),
    ]));
  });
});
