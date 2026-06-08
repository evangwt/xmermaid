import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XMermaid } from '../src/xmermaid';
import { XMermaidError } from '../src/types/error';
import { DEFAULT_THEME } from '../src/types/theme';
import { getWasm, initWasm } from '../src/wasm';
import { DEFAULT_SECURITY_POLICY } from '../src/security';
import { SVGRenderer } from '../src/renderer/svg';

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

  it('rejects error-severity unsupported flowchart syntax before WASM render', async () => {
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    await expect(xm.renderToSVGElement('graph XXX\n  A-->B'))
      .rejects.toMatchObject<XMermaidError>({
        code: 'RENDER_ERROR',
        diagnostics: [
          expect.objectContaining({
            code: 'unsupported_syntax',
            severity: 'error',
            featureId: 'flowchart.invalidDirection',
            range: expect.objectContaining({
              startLine: 1,
              startColumn: 1,
            }),
          }),
        ],
      });
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

  it('rejects unknown diagram sources before WASM render with structured diagnostics', async () => {
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

    await expect(xm.renderToSVGElement('not a diagram'))
      .rejects.toMatchObject<XMermaidError>({
        code: 'UNSUPPORTED_DIAGRAM',
        diagnostics: [
          expect.objectContaining({
            code: 'unsupported_diagram_type',
            severity: 'error',
            featureId: 'diagram.unknown',
            range: expect.objectContaining({
              startLine: 1,
              startColumn: 1,
              endLine: 1,
            }),
          }),
        ],
      });
    expect(wasm.render).not.toHaveBeenCalled();
    expect(wasm.render_with_config).not.toHaveBeenCalled();
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

  it('declares SVG sanitization as part of the default security policy', () => {
    expect(DEFAULT_SECURITY_POLICY).toMatchObject({
      securityLevel: 'strict',
      sanitizeSvg: true,
    });
  });

  it('sanitizes generated SVG output by default', async () => {
    const renderSpy = vi.spyOn(SVGRenderer.prototype, 'render').mockImplementation(() => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const script = document.createElementNS('http://www.w3.org/2000/svg', 'script');
      const link = document.createElementNS('http://www.w3.org/2000/svg', 'a');
      link.setAttribute('onclick', 'alert(1)');
      link.setAttribute('href', 'javascript:alert(1)');
      svg.setAttribute('onload', 'alert(1)');
      svg.append(script, link);
      return svg;
    });
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    try {
      const result = await xm.renderToSVGElement('graph TD\n  A-->B');

      expect(result.svg.querySelector('script')).toBeNull();
      expect(result.svg.getAttribute('onload')).toBeNull();
      expect(result.svg.querySelector('a')?.getAttribute('onclick')).toBeNull();
      expect(result.svg.querySelector('a')?.getAttribute('href')).toBeNull();
    } finally {
      renderSpy.mockRestore();
    }
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

  it('does not let a custom URL allowlist permit dangerous protocols', async () => {
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    await expect(xm.renderToSVGElement('graph TD\n  A-->B\n  click A javascript:alert(1)', {
      securityLevel: 'loose',
      securityPolicy: { allowedUrlProtocols: ['javascript:', 'https:'] },
    }))
      .rejects.toMatchObject<XMermaidError>({
        code: 'RENDER_ERROR',
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'security_blocked_url',
            message: expect.stringContaining('javascript:'),
          }),
        ]),
      });
  });

  it('blocks dangerous protocols inside Mermaid label delimiters', async () => {
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    await expect(xm.renderToSVGElement('graph TD\n  A[javascript:alert(1)] --> B'))
      .rejects.toMatchObject<XMermaidError>({
        code: 'RENDER_ERROR',
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'security_blocked_url',
            message: expect.stringContaining('javascript:'),
            range: expect.objectContaining({ startLine: 2 }),
          }),
        ]),
      });
  });

  it('blocks dangerous protocols split by ASCII control whitespace', async () => {
    const container = document.createElement('div');
    const xm = new XMermaid({ container });

    await expect(xm.renderToSVGElement('graph TD\n  A[java\tscript:alert(1)] --> B', {
      securityLevel: 'loose',
    }))
      .rejects.toMatchObject<XMermaidError>({
        code: 'RENDER_ERROR',
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'security_blocked_url',
            message: expect.stringContaining('javascript:'),
            range: expect.objectContaining({ startLine: 2 }),
          }),
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

  it('passes one-shot WASM init options to the loader', async () => {
    const container = document.createElement('div');
    const xm = new XMermaid({ container });
    const wasmUrl = new URL('https://cdn.example.com/xmermaid_wasm_bg.wasm');

    await xm.renderToSVGElement('graph TD\n  A-->B', {
      wasm: { wasmUrl },
    });

    expect(initWasm).toHaveBeenCalledWith({ wasmUrl });
  });

  it('passes SDK render options through the DOM scan run helper', async () => {
    document.body.innerHTML = '<div class="mermaid">graph TD\n  A-->B</div>';
    const renderSpy = vi.spyOn(XMermaid.prototype, 'renderToSVGElement').mockResolvedValue({
      diagramType: 'flowchart',
      diagnostics: [],
      dimensions: { width: 200, height: 240 },
      svg: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    });
    const container = document.createElement('div');
    const wasmUrl = new URL('https://cdn.example.com/xmermaid_wasm_bg.wasm');

    try {
      await XMermaid.run({
        container,
        wasm: { wasmUrl },
        securityLevel: 'loose',
      });

      expect(renderSpy).toHaveBeenCalledWith('graph TD\n  A-->B', {
        wasm: { wasmUrl },
        securityLevel: 'loose',
      });
      expect(document.querySelector('.mermaid svg')).not.toBeNull();
    } finally {
      renderSpy.mockRestore();
      document.body.innerHTML = '';
    }
  });

  it('exposes structured diagnostics on DOM scan render failures', async () => {
    document.body.innerHTML = '<div class="mermaid">sequenceDiagram\n  A->>B: Hi</div>';
    const container = document.createElement('div');

    try {
      await XMermaid.run({ container });

      const element = document.querySelector<HTMLElement>('.mermaid')!;
      const diagnostics = JSON.parse(element.dataset.xmermaidDiagnostics ?? '[]');
      expect(element.dataset.xmermaidErrorCode).toBe('UNSUPPORTED_DIAGRAM');
      expect(diagnostics).toEqual([
        expect.objectContaining({
          code: 'unsupported_diagram_type',
          severity: 'error',
          featureId: 'diagram.sequence',
        }),
      ]);
      expect(element.textContent).toContain('sequence diagrams are not supported yet.');
    } finally {
      document.body.innerHTML = '';
    }
  });
});
