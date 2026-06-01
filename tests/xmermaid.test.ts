import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XMermaid } from '../src/xmermaid';
import { XMermaidError } from '../src/types/error';
import { DEFAULT_THEME } from '../src/types/theme';
import { getWasm } from '../src/wasm';

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('maps unsupported diagram failures from the real render path', async () => {
    vi.mocked(getWasm).mockReturnValueOnce({
      render: vi.fn(() => {
        throw new Error('Unsupported diagram type: sequence');
      }),
      render_with_config: vi.fn(),
      default_config: vi.fn(),
      parse_dsl: vi.fn(),
      get_diagram_type: vi.fn(),
      compute_layout: vi.fn(),
      default: vi.fn(),
    } as unknown as ReturnType<typeof getWasm>);
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    await expect(xm.render('graph TD\n  A-->B'))
      .rejects.toMatchObject<XMermaidError>({
        code: 'UNSUPPORTED_DIAGRAM',
      });
  });

  it('returns reusable SVG results without mutating the constructor container', async () => {
    const container = document.createElement('div');
    container.textContent = 'keep me';
    const xm = new XMermaid({ container });

    const result = await xm.renderToSVGElement('graph TD\n  A-->B');

    expect(result.diagramType).toBe('flowchart');
    expect(result.diagnostics).toEqual([]);
    expect(result.dimensions).toEqual({ width: 200, height: 240 });
    expect(result.svg).toBeInstanceOf(SVGSVGElement);
    expect(result.svg.classList.contains('xmermaid-diagram')).toBe(true);
    expect(container.textContent).toBe('keep me');
  });

  it('returns unsupported syntax diagnostics for partial flowchart renders', async () => {
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    const result = await xm.renderToSVGElement([
      'graph TD',
      '  A-->B',
      '  classDef hot fill:#fff',
    ].join('\n'));

    expect(result.svg).toBeInstanceOf(SVGSVGElement);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'unsupported_syntax',
      severity: 'warning',
      featureId: 'flowchart.classDef',
      range: expect.objectContaining({
        startLine: 3,
        startColumn: 3,
        endLine: 3,
      }),
    }));
  });

  it('rejects unsupported diagrams before WASM render with structured diagnostics', async () => {
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    await expect(xm.renderToSVGElement('sequenceDiagram\n  A->>B: Hi'))
      .rejects.toMatchObject<XMermaidError>({
        code: 'UNSUPPORTED_DIAGRAM',
        diagnostics: [
          expect.objectContaining({
            code: 'unsupported_diagram_type',
            severity: 'error',
            featureId: 'diagram.sequence',
            range: expect.objectContaining({
              startLine: 1,
              startColumn: 1,
              endLine: 1,
            }),
          }),
        ],
      });
  });

  it('attaches structured diagnostics when WASM parse errors are normalized', async () => {
    vi.mocked(getWasm).mockReturnValueOnce({
      render: vi.fn(() => {
        throw new Error('Parse error: Expected Arrow, got EOF at line 2');
      }),
      render_with_config: vi.fn(),
      default_config: vi.fn(),
      parse_dsl: vi.fn(),
      get_diagram_type: vi.fn(),
      compute_layout: vi.fn(),
      default: vi.fn(),
    } as unknown as ReturnType<typeof getWasm>);
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    await expect(xm.renderToSVGElement('graph TD\n  A'))
      .rejects.toMatchObject<XMermaidError>({
        code: 'PARSE_ERROR',
        diagnostics: [
          expect.objectContaining({
            code: 'parse_error',
            severity: 'error',
            range: null,
          }),
        ],
      });
  });

  it('blocks click callbacks and dangerous URLs by default with security diagnostics', async () => {
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    await expect(xm.renderToSVGElement('graph TD\n  A-->B\n  click A javascript:alert(1)'))
      .rejects.toMatchObject<XMermaidError>({
        code: 'RENDER_ERROR',
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'security_blocked_click',
            severity: 'error',
            featureId: 'flowchart.click',
            range: expect.objectContaining({ startLine: 3 }),
          }),
          expect.objectContaining({
            code: 'security_blocked_url',
            severity: 'error',
            range: expect.objectContaining({ startLine: 3 }),
          }),
        ]),
      });
  });

  it('blocks HTML labels by default with security diagnostics', async () => {
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    await expect(xm.renderToSVGElement('graph TD\n  A[<b>Hi</b>]'))
      .rejects.toMatchObject<XMermaidError>({
        code: 'RENDER_ERROR',
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'security_blocked_html',
            severity: 'error',
            featureId: 'flowchart.htmlLabel',
            range: expect.objectContaining({ startLine: 2 }),
          }),
        ]),
      });
  });

  it('keeps click and HTML as unsupported warnings in loose mode while still blocking dangerous URLs', async () => {
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    const looseHtml = await xm.renderToSVGElement('graph TD\n  A[<b>Hi</b>]', { securityLevel: 'loose' });
    expect(looseHtml.diagnostics).toContainEqual(expect.objectContaining({
      code: 'unsupported_syntax',
      featureId: 'flowchart.htmlLabel',
    }));
    expect(looseHtml.diagnostics).not.toContainEqual(expect.objectContaining({
      code: 'security_blocked_html',
    }));

    await expect(xm.renderToSVGElement('graph TD\n  A-->B\n  click A javascript:alert(1)', { securityLevel: 'loose' }))
      .rejects.toMatchObject<XMermaidError>({
        code: 'RENDER_ERROR',
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: 'security_blocked_url' }),
        ]),
      });
  });

  it('serializes SVG output through renderToSVGString', async () => {
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    const svg = await xm.renderToSVGString('graph TD\n  A-->B');

    expect(svg).toMatch(/^<svg\b/);
    expect(svg).toContain('xmermaid-diagram');
  });

  it('keeps render() as the DOM replacement compatibility path', async () => {
    const container = document.createElement('div');
    container.appendChild(document.createElement('span'));
    const xm = new XMermaid({ container });

    const result = await xm.render('graph TD\n  A-->B');

    expect(result).toBeUndefined();
    expect(container.querySelectorAll('svg.xmermaid-diagram')).toHaveLength(1);
    expect(container.querySelector('span')).toBeNull();
  });

  it('uses one-shot layoutConfig options without changing later renders', async () => {
    const wasm = {
      render: vi.fn(() => mockLayoutResult),
      render_with_config: vi.fn(() => mockLayoutResult),
      default_config: vi.fn(),
      parse_dsl: vi.fn(),
      get_diagram_type: vi.fn(),
      compute_layout: vi.fn(),
      default: vi.fn(),
    };
    vi.mocked(getWasm).mockReturnValue(wasm as unknown as ReturnType<typeof getWasm>);
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    await xm.renderToSVGElement('graph TD\n  A-->B', {
      layoutConfig: { direction: 'LR' },
    });
    await xm.renderToSVGElement('graph TD\n  A-->B');

    expect(wasm.render_with_config).toHaveBeenCalledTimes(1);
    expect(wasm.render_with_config).toHaveBeenCalledWith('graph TD\n  A-->B', JSON.stringify({ direction: 'LR' }));
    expect(wasm.render).toHaveBeenCalledTimes(1);
  });
});
