import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XMermaid } from '../src/xmermaid';
import { DEFAULT_THEME } from '../src/types/theme';

// Mock WASM module
const mockLayoutResult = {
  nodes: [
    { id: 'A', center: { x: 100, y: 60 }, bounds: { x: 40, y: 40, width: 120, height: 40 }, shape: 'RoundedRect', label: 'Start' },
    { id: 'B', center: { x: 100, y: 180 }, bounds: { x: 40, y: 160, width: 120, height: 40 }, shape: 'RoundedRect', label: 'End' },
  ],
  edges: [
    { from: 'A', to: 'B', waypoints: [{ x: 100, y: 60 }, { x: 100, y: 180 }], label: null, label_position: null },
  ],
  dimensions: { width: 200, height: 240 },
};

vi.mock('../src/wasm', () => ({
  initWasm: vi.fn(async () => {}),
  isWasmReady: vi.fn(() => true),
  getWasm: vi.fn(() => ({
    render: vi.fn(() => mockLayoutResult),
    render_with_config: vi.fn(() => mockLayoutResult),
    default_config: vi.fn(() => JSON.stringify({ node_width: 120, node_height: 40, h_spacing: 60, v_spacing: 60, padding: 40, direction: 'TB' })),
    parse_dsl: vi.fn(() => JSON.stringify({ type: 'flowchart', direction: 'TD', nodes: [], edges: [], subgraphs: [] })),
    get_diagram_type: vi.fn(() => 'flowchart'),
    compute_layout: vi.fn(() => JSON.stringify(mockLayoutResult)),
    default: vi.fn(async () => {}),
  })),
}));

describe('XMermaid', () => {
  it('creates instance with default options', () => {
    const container = document.createElement('div');
    const xm = new XMermaid({ container });
    expect(xm).toBeInstanceOf(XMermaid);
  });

  it('creates instance with custom theme', () => {
    const container = document.createElement('div');
    const xm = new XMermaid({
      container,
      theme: { ...DEFAULT_THEME, edgeGap: 20 },
    });
    expect(xm).toBeInstanceOf(XMermaid);
  });

  it('creates instance with custom layout config', () => {
    const container = document.createElement('div');
    const xm = new XMermaid({
      container,
      layoutConfig: { h_spacing: 100, v_spacing: 80 },
    });
    expect(xm).toBeInstanceOf(XMermaid);
  });
});
