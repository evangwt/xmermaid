import { SVGRenderer } from './renderer';
import { getWasm, initWasm, isWasmReady } from './wasm';
import type { XMermaidOptions, DiagramAst, LayoutResult, FlowchartAst } from './types';

export interface ParseResult {
  success: boolean;
  ast: DiagramAst;
  errors?: unknown[];
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
        errors: [{ code: 'PARSE_ERROR', type: 'syntax', message: String(error) }],
      };
    }
  }

  async renderToSVG(dsl: string): Promise<string> {
    const start = performance.now();
    const parseResult = await this.parse(dsl);
    if (!parseResult.success) {
      throw new Error(`Parse failed: ${JSON.stringify(parseResult.errors)}`);
    }

    const parseTime = performance.now() - start;
    const layoutResult = await this.computeLayout(parseResult.ast);
    const layoutTime = performance.now() - start - parseTime;

    if (parseResult.ast.type !== 'flowchart') {
      throw new Error('Only flowchart supported in MVP');
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
    const svg = doc.querySelector('svg')!;
    container.appendChild(svg);

    const total = performance.now() - start;
    return {
      success: true,
      output: svg,
      performance: { parse: 0, layout: 0, render: 0, total },
    };
  }

  /** Full pipeline via WASM: parse + layout in one call. Returns raw JSON. */
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
}
