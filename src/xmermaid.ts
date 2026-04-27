import type { XMermaidOptions, LayoutConfig, RenderTheme } from './types';
import { DEFAULT_THEME } from './types/theme';
import { SVGRenderer } from './renderer/svg';
import { initWasm, getWasm } from './wasm';
import type { LayoutResult } from './types/layout';

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

    let layout: LayoutResult;
    if (this.layoutConfig) {
      const defaultConfig = JSON.parse(wasm.default_config());
      const merged = { ...defaultConfig, ...this.layoutConfig };
      const configJson = JSON.stringify(merged);
      layout = wasm.render_with_config(input, configJson);
    } else {
      layout = wasm.render(input);
    }

    const svg = this.renderer.render(layout);
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
