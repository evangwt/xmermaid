import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

// Mermaid 11.16.0: https://mermaid.js.org/syntax/swimlane.html
const SOURCE = `swimlane-beta LR
  subgraph Customer
    request[Request service]
    receive[Receive update]
  end

  subgraph Support
    triage[Triage request]
    answer[Send answer]
  end

  request --> triage
  triage -->|Known issue| answer
  answer --> receive`;

describe('Swimlane Diagram real WASM contract', () => {
  beforeAll(async () => {
    await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  });

  it('parses documented lanes, nodes, and labeled directed edges into native lane geometry', () => {
    const astJson = parseDsl(SOURCE);
    const ast = JSON.parse(astJson) as {
      type: string;
      direction: string;
      lanes: { id: string; label: string; nodes: string[] }[];
      nodes: { id: string; label: string }[];
      edges: { from: string; to: string; label?: string }[];
    };
    const layout = renderWithConfig(SOURCE, null) as {
      swimlanes: { direction: string; lanes: { id: string; label: string; bounds: { width: number; height: number } }[] };
      nodes: { id: string }[];
      edges: { from: string; to: string; label?: string }[];
    };

    expect(ast).toMatchObject({ type: 'swimlanes', direction: 'LR' });
    expect(ast.lanes).toEqual([
      { id: 'Customer', label: 'Customer', nodes: ['request', 'receive'] },
      { id: 'Support', label: 'Support', nodes: ['triage', 'answer'] },
    ]);
    expect(ast.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'request', label: 'Request service' }),
      expect.objectContaining({ id: 'answer', label: 'Send answer' }),
    ]));
    expect(ast.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'triage', to: 'answer', label: 'Known issue' }),
    ]));
    expect(getDiagramType(astJson)).toBe('swimlanes');
    expect(layout.swimlanes).toMatchObject({ direction: 'LR' });
    expect(layout.swimlanes.lanes).toHaveLength(2);
    expect(layout.swimlanes.lanes[0]?.bounds.width).toBeGreaterThan(0);
    expect(layout.nodes).toHaveLength(4);
    expect(layout.edges).toHaveLength(3);
  });
});
