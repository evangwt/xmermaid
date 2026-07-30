import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

// Mermaid 11.16.0: https://mermaid.js.org/syntax/eventmodeling.html
const SOURCE = `eventmodeling
  tf 01 ui CartUI
  tf 02 cmd AddItem
  tf 03 evt ItemAdded
  rf 04 evt External.InventoryChanged
  timeframe 05 readmodel CartSummary`;

describe('Event Modeling real WASM contract', () => {
  beforeAll(async () => {
    await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  });

  it('preserves documented time frames, entity types, resets, and inferred swimlanes', () => {
    const astJson = parseDsl(SOURCE);
    const ast = JSON.parse(astJson) as {
      type: string;
      frames: { id: string; entity_type: string; entity: string; reset: boolean }[];
    };
    const layout = renderWithConfig(SOURCE, null) as {
      nodes: { id: string; label: string }[];
      edges: { from: string; to: string }[];
      swimlanes: { lanes: { id: string; label: string }[] };
    };

    expect(ast).toMatchObject({ type: 'eventmodeling' });
    expect(ast.frames).toEqual([
      { id: '01', entity_type: 'ui', entity: 'CartUI', reset: false },
      { id: '02', entity_type: 'cmd', entity: 'AddItem', reset: false },
      { id: '03', entity_type: 'evt', entity: 'ItemAdded', reset: false },
      { id: '04', entity_type: 'evt', entity: 'External.InventoryChanged', reset: true },
      { id: '05', entity_type: 'rmo', entity: 'CartSummary', reset: false },
    ]);
    expect(getDiagramType(astJson)).toBe('event-modeling');
    expect(layout.nodes).toHaveLength(5);
    expect(layout.swimlanes.lanes.map(lane => lane.id)).toEqual(['automation', 'command-readmodel', 'events']);
    expect(layout.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'frame-01', to: 'frame-02' }),
      expect.objectContaining({ from: 'frame-02', to: 'frame-03' }),
    ]));
    expect(layout.edges.some(edge => edge.from === 'frame-03' && edge.to === 'frame-04')).toBe(false);
  });
});
