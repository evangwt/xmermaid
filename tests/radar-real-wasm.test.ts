import { readFileSync } from 'node:fs';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';
import { beforeAll, describe, expect, it } from 'vitest';

const SOURCE = `radar-beta
  title Restaurant Comparison
  axis food["Food Quality"], service["Service"], price["Price"], ambiance["Ambiance"]
  curve a["Restaurant A"]{4, 3, 2, 4}
  curve b["Restaurant B"]{3, 4, 3, 3}
  min 0
  max 5`;

describe('Radar Diagram real WASM contract', () => {
  beforeAll(async () => {
    await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  });

  it('parses official core syntax and emits normalized native curve geometry', () => {
    const astJson = parseDsl(SOURCE);
    const ast = JSON.parse(astJson) as { type: string; axes: unknown[]; curves: unknown[] };
    const layout = renderWithConfig(SOURCE, null) as {
      radar: { axes: { label: string }[]; curves: { label: string; points: { x: number; y: number }[] }[]; min: number; max: number };
    };

    expect(ast).toMatchObject({ type: 'radar' });
    expect(ast.axes).toHaveLength(4);
    expect(ast.curves).toHaveLength(2);
    expect(getDiagramType(astJson)).toBe('radar');
    expect(layout.radar).toMatchObject({ min: 0, max: 5 });
    expect(layout.radar.axes.map(axis => axis.label)).toEqual(['Food Quality', 'Service', 'Price', 'Ambiance']);
    expect(layout.radar.curves[0]).toMatchObject({ label: 'Restaurant A' });
    expect(layout.radar.curves[0]?.points).toHaveLength(4);
  });
});
