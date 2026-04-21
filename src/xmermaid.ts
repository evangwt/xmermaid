import { SVGRenderer } from './renderer';
import { getWasm, initWasm, isWasmReady } from './wasm';
import { XMermaidError } from './types/error';
import type { XMermaidOptions, DiagramAst, LayoutResult, FlowchartAst } from './types';

export interface ParseResult {
  success: boolean;
  ast: DiagramAst;
  errors?: XMermaidError[];
}

export interface RenderResult {
  success: boolean;
  output: SVGElement;
  performance: { parse: number; layout: number; render: number; total: number };
}

export class XMermaid {
  private options: Required<XMermaidOptions>;
  private svgRenderer: SVGRenderer;

  constructor(options: XMermaidOptions = {}) {
    this.options = {
      renderer: options.renderer ?? 'svg',
      theme: options.theme ?? 'default',
      themeConfig: options.themeConfig ?? {},
      securityLevel: options.securityLevel ?? 'strict',
      performance: options.performance ?? {},
    };
    this.svgRenderer = new SVGRenderer(this.options.theme);
  }

  async parse(dsl: string): Promise<ParseResult> {
    await this.ensureWasmReady();
    const wasm = getWasm();

    try {
      const json = wasm.parse_dsl(dsl);
      const ast: DiagramAst = JSON.parse(json);
      return { success: true, ast };
    } catch (error) {
      return {
        success: false,
        ast: {} as DiagramAst,
        errors: [new XMermaidError('PARSE_ERROR', String(error), { error })],
      };
    }
  }

  async renderToSVG(dsl: string): Promise<string> {
    const start = performance.now();
    const parseResult = await this.parse(dsl);
    if (!parseResult.success) {
      throw parseResult.errors![0];
    }

    const parseTime = performance.now() - start;
    const layoutResult = await this.computeLayout(parseResult.ast);
    const layoutTime = performance.now() - start - parseTime;

    if (parseResult.ast.type !== 'flowchart') {
      throw new XMermaidError('UNSUPPORTED_DIAGRAM', 'Only flowchart diagrams are supported in MVP');
    }

    const svg = this.svgRenderer.render(parseResult.ast as FlowchartAst, layoutResult);
    const renderTime = performance.now() - start - parseTime - layoutTime;

    return svg.outerHTML;
  }

  async render(dsl: string, container: HTMLElement): Promise<RenderResult> {
    const start = performance.now();
    const svgString = await this.renderToSVG(dsl);

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) {
      throw new XMermaidError('RENDER_ERROR', 'Failed to parse generated SVG');
    }
    container.appendChild(svg);

    const total = performance.now() - start;
    return {
      success: true,
      output: svg,
      performance: { parse: 0, layout: 0, render: 0, total },
    };
  }

  async pipeline(dsl: string): Promise<{ ast: DiagramAst; layout: LayoutResult }> {
    await this.ensureWasmReady();
    const wasm = getWasm();
    const json = wasm.render_pipeline(dsl);
    const result = JSON.parse(json);
    return { ast: result.ast, layout: result.layout };
  }

  private async computeLayout(ast: DiagramAst): Promise<LayoutResult> {
    await this.ensureWasmReady();
    const wasm = getWasm();
    const json = wasm.compute_layout(JSON.stringify(ast));
    return JSON.parse(json);
  }

  private async ensureWasmReady(): Promise<void> {
    if (!isWasmReady()) {
      await initWasm();
    }
  }

  /** Scan the DOM for elements with class "mermaid" and render them. */
  static async run(options: XMermaidOptions = {}): Promise<void> {
    const xm = new XMermaid(options);
    const elements = document.querySelectorAll('.mermaid');

    for (const el of elements) {
      if (el instanceof HTMLElement) {
        const dsl = el.textContent?.trim();
        if (dsl) {
          el.textContent = '';
          try {
            await xm.render(dsl, el);
          } catch (e) {
            el.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
      }
    }
  }
}
