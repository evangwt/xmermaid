import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

// Mermaid 11.16.0: https://mermaid.js.org/syntax/ishikawa.html
const SOURCE = `ishikawa-beta
  Blurry Photo
  Process
    Out of focus
    Shutter speed too slow
  Equipment
    Lens
      Dirty lens`;

describe('Ishikawa Diagram real WASM contract', () => {
  beforeAll(async () => {
    await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  });

  it('parses indented causes into a native fishbone layout', () => {
    const astJson = parseDsl(SOURCE);
    const ast = JSON.parse(astJson) as {
      type: string;
      effect: string;
      causes: { label: string; parent: string | null; depth: number }[];
    };
    const layout = renderWithConfig(SOURCE, null) as {
      ishikawa: {
        effect: string;
        spine_start: { x: number; y: number };
        spine_end: { x: number; y: number };
        causes: { label: string; parent: string | null; depth: number; position: { x: number; y: number } }[];
      };
    };

    expect(ast).toMatchObject({ type: 'ishikawa', effect: 'Blurry Photo' });
    expect(ast.causes).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Process', parent: null, depth: 0 }),
      expect.objectContaining({ label: 'Dirty lens', parent: 'Lens', depth: 2 }),
    ]));
    expect(getDiagramType(astJson)).toBe('ishikawa');
    expect(layout.ishikawa).toMatchObject({ effect: 'Blurry Photo' });
    expect(layout.ishikawa.spine_end.x).toBeGreaterThan(layout.ishikawa.spine_start.x);
    expect(layout.ishikawa.causes).toHaveLength(6);
  });
});
