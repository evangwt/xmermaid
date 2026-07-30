import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

// Mermaid 11.16.0: https://mermaid.js.org/syntax/cynefin.html
const SOURCE = `cynefin-beta
title Incident Response

complex
"Investigate root cause"

complicated
"Expert review needed"

clear
"Restart service"

chaotic
"Page on-call immediately"

confusion
"Unknown failure mode"

complex --> complicated : "Pattern identified"
clear --> chaotic : "Complacency"`;

describe('Cynefin real WASM contract', () => {
  beforeAll(async () => {
    await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  });

  it('preserves fixed domains, quoted items, and labeled transitions', () => {
    const astJson = parseDsl(SOURCE);
    const ast = JSON.parse(astJson) as {
      type: string;
      title: string;
      domains: { id: string; items: string[] }[];
      transitions: { from: string; to: string; label: string }[];
    };
    const layout = renderWithConfig(SOURCE, null) as {
      cynefin: {
        title: string;
        domains: { id: string; items: { label: string }[] }[];
        transitions: { from: string; to: string; label: string }[];
      };
    };

    expect(ast).toMatchObject({ type: 'cynefin', title: 'Incident Response' });
    expect(ast.domains).toEqual(expect.arrayContaining([
      { id: 'complex', items: ['Investigate root cause'] },
      { id: 'clear', items: ['Restart service'] },
    ]));
    expect(ast.transitions).toEqual([
      { from: 'complex', to: 'complicated', label: 'Pattern identified' },
      { from: 'clear', to: 'chaotic', label: 'Complacency' },
    ]);
    expect(getDiagramType(astJson)).toBe('cynefin');
    expect(layout.cynefin.title).toBe('Incident Response');
    expect(layout.cynefin.domains).toHaveLength(5);
    expect(layout.cynefin.domains.find(domain => domain.id === 'confusion')?.items).toEqual([
      { label: 'Unknown failure mode' },
    ]);
    expect(layout.cynefin.transitions).toHaveLength(2);
  });
});
