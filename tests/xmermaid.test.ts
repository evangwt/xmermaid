import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XMermaid } from '../src/xmermaid';
import type { WasmModule } from '../src/wasm';

// Mock WASM module
const mockWasm: WasmModule = {
  parse_dsl: vi.fn((input: string) => {
    if (input.startsWith('graph') || input.startsWith('flowchart')) {
      return JSON.stringify({
        type: 'flowchart',
        direction: 'TD',
        nodes: [
          { id: 'A', label: 'Start', shape: 'rect', classes: [], styles: [] },
          { id: 'B', label: 'End', shape: 'rect', classes: [], styles: [] },
        ],
        edges: [{ from: 'A', to: 'B', style: 'arrow', label: null, min_length: 1 }],
        subgraphs: [],
      });
    }
    throw new Error('Parse error: invalid input');
  }),
  get_diagram_type: vi.fn((astJson: string) => {
    const ast = JSON.parse(astJson);
    return ast.type;
  }),
  compute_layout: vi.fn((_astJson: string) => {
    return JSON.stringify({
      positions: [['A', { x: 40, y: 40 }], ['B', { x: 40, y: 140 }]],
      dimensions: { width: 200, height: 200 },
    });
  }),
  render_pipeline: vi.fn((_input: string) => {
    return JSON.stringify({
      ast: {
        type: 'flowchart',
        direction: 'TD',
        nodes: [
          { id: 'A', label: 'Start', shape: 'rect', classes: [], styles: [] },
          { id: 'B', label: 'End', shape: 'rect', classes: [], styles: [] },
        ],
        edges: [{ from: 'A', to: 'B', style: 'arrow', label: null, min_length: 1 }],
        subgraphs: [],
      },
      layout: {
        positions: [['A', { x: 40, y: 40 }], ['B', { x: 40, y: 140 }]],
        dimensions: { width: 200, height: 200 },
      },
    });
  }),
};

vi.mock('../src/wasm', () => ({
  initWasm: vi.fn(async () => {}),
  isWasmReady: vi.fn(() => true),
  getWasm: vi.fn(() => mockWasm),
}));

describe('XMermaid', () => {
  let xm: XMermaid;

  beforeEach(() => {
    vi.clearAllMocks();
    xm = new XMermaid({ theme: 'default' });
  });

  it('creates instance with default options', () => {
    const instance = new XMermaid();
    expect(instance).toBeInstanceOf(XMermaid);
  });

  it('creates instance with custom theme', () => {
    const instance = new XMermaid({ theme: 'dark' });
    expect(instance).toBeInstanceOf(XMermaid);
  });

  it('parses a valid flowchart', async () => {
    const result = await xm.parse('graph TD\n  A-->B');
    expect(result.success).toBe(true);
    expect(result.ast.type).toBe('flowchart');
  });

  it('returns error for invalid input', async () => {
    const result = await xm.parse('not a diagram');
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('renders to SVG string', async () => {
    const svg = await xm.renderToSVG('graph TD\n  A-->B');
    expect(svg).toContain('<svg');
    expect(svg).toContain('node-A');
    expect(svg).toContain('node-B');
  });

  it('renders into a container element', async () => {
    const container = document.createElement('div');
    const result = await xm.render('graph TD\n  A-->B', container);
    expect(result.success).toBe(true);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('uses pipeline API', async () => {
    const result = await xm.pipeline('graph TD\n  A-->B');
    expect(result.ast.type).toBe('flowchart');
    expect(result.layout.positions).toBeDefined();
    expect(result.layout.dimensions).toBeDefined();
  });

  it('throws for non-flowchart diagrams', async () => {
    // Mock parse to return a sequence diagram
    vi.mocked(mockWasm.parse_dsl).mockImplementationOnce(() => {
      return JSON.stringify({ type: 'sequence', participants: ['A'] });
    });
    await expect(xm.renderToSVG('sequenceDiagram\n  A->>B')).rejects.toThrow('Only flowchart');
  });
});
