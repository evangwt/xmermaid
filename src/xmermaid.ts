import type { XMermaidOptions, LayoutConfig, RenderTheme } from './types';
import { DEFAULT_THEME } from './types/theme';
import { SVGRenderer } from './renderer/svg';
import { initWasm, getWasm } from './wasm';
import type { LayoutResult, EdgeStyle, NodeShape } from './types/layout';

export class XMermaid {
  private container: HTMLElement;
  private renderer: SVGRenderer;
  private layoutConfig?: Partial<LayoutConfig>;

  constructor(options: XMermaidOptions) {
    this.container = options.container;
    this.renderer = new SVGRenderer(options.theme);
    this.layoutConfig = options.layoutConfig;
  }

  async render(input: string): Promise<void> {
    await initWasm();
    const wasm = getWasm();

    let layout: any;
    if (this.layoutConfig) {
      const defaultConfig = JSON.parse(wasm.default_config());
      const merged = { ...defaultConfig, ...this.layoutConfig };
      const configJson = JSON.stringify(merged);
      layout = wasm.render_with_config(input, configJson);
    } else {
      layout = wasm.render(input);
    }

    // serde_wasm_bindgen may serialize enums as Map objects; convert to strings
    for (const edge of layout.edges) {
      const style = edge.style;
      if (style instanceof Map) {
        edge.style = [...style.keys()][0] as EdgeStyle;
      } else if (typeof style === 'object' && style !== null) {
        edge.style = Object.keys(style)[0] as EdgeStyle;
      }
    }
    for (const node of layout.nodes) {
      const shape = node.shape;
      if (shape instanceof Map) {
        node.shape = [...shape.keys()][0] as NodeShape;
      } else if (typeof shape === 'object' && shape !== null) {
        node.shape = Object.keys(shape)[0] as NodeShape;
      }
    }

    const svg = this.renderer.render(layout as LayoutResult);
    this.container.innerHTML = '';
    this.container.appendChild(svg);
  }

  setTheme(theme: Partial<RenderTheme>): void {
    this.renderer.setTheme(theme);
  }

  /** Scan the DOM for elements with class "mermaid" and render them. */
  static async run(options: XMermaidOptions): Promise<void> {
    const xm = new XMermaid(options);
    const elements = Array.from(document.querySelectorAll('.mermaid'));

    for (const el of elements) {
      if (el instanceof HTMLElement) {
        const dsl = el.textContent?.trim();
        if (dsl) {
          xm.container = el;
          el.textContent = '';
          try {
            await xm.render(dsl);
          } catch (e) {
            el.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
      }
    }
  }
}
