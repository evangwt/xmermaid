import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

// Mermaid 11.16.0: https://mermaid.js.org/syntax/venn.html
const SOURCE = `venn-beta
  title "Team overlap"
  set Frontend
  set Backend
  union Frontend,Backend["APIs"]`;

describe('Venn Diagram real WASM contract', () => {
  beforeAll(async () => {
    await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  });

  it('parses documented sets and labeled unions into native circle geometry', () => {
    const astJson = parseDsl(SOURCE);
    const ast = JSON.parse(astJson) as { type: string; title: string; sets: { id: string; label: string }[]; unions: { sets: string[]; label: string }[] };
    const layout = renderWithConfig(SOURCE, null) as {
      venn: { title: string; sets: { id: string; label: string; center: { x: number; y: number }; radius: number }[]; unions: { label: string; position: { x: number; y: number } }[] };
    };

    expect(ast).toMatchObject({ type: 'venn', title: 'Team overlap' });
    expect(ast.sets).toEqual([{ id: 'Frontend', label: 'Frontend' }, { id: 'Backend', label: 'Backend' }]);
    expect(ast.unions).toEqual([{ sets: ['Frontend', 'Backend'], label: 'APIs' }]);
    expect(getDiagramType(astJson)).toBe('venn');
    expect(layout.venn).toMatchObject({ title: 'Team overlap' });
    expect(layout.venn.sets).toHaveLength(2);
    expect(layout.venn.unions).toEqual([expect.objectContaining({ label: 'APIs' })]);
    expect(layout.venn.sets[0]!.center.x).not.toBe(layout.venn.sets[1]!.center.x);
  });
});
