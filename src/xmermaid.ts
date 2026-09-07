import type { XMermaidOptions, LayoutConfig, RenderOptions, RenderResult, RenderTheme } from './types';
import { DEFAULT_THEME, DARK_THEME, LIGHT_THEME, MINIMAL_THEME } from './types/theme';
import { SVGRenderer } from './renderer/svg';
import { initWasm, getWasm } from './wasm';
import type { LayoutResult, EdgeStyle, NodeShape } from './types/layout';
import { XMermaidError } from './types/error';
import { analyzeSupport } from './support';
import type { UnsupportedFeature } from './support';
import type { XMermaidDiagnostic, XMermaidDiagnosticCode } from './types/diagnostics';
import { detectSecurityDiagnostics, resolveSecurityPolicy } from './security';

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
    const result = await this.renderToSVGElement(input);
    this.container.innerHTML = '';
    this.container.appendChild(result.svg);
  }

  async renderToSVGElement(input: string, options: RenderOptions = {}): Promise<RenderResult> {
    const securityPolicy = resolveSecurityPolicy(options);
    const support = analyzeSupport(input);
    const supportDiagnostics = support.unsupportedFeatures.map(unsupportedFeatureToDiagnostic);
    const securityDiagnostics = detectSecurityDiagnostics(input, securityPolicy);
    const diagnostics = [...supportDiagnostics, ...securityDiagnostics];
    const unsupportedDiagramDiagnostic = diagnostics.find(diagnostic => diagnostic.code === 'unsupported_diagram_type');
    if (unsupportedDiagramDiagnostic) {
      throw new XMermaidError(
        'UNSUPPORTED_DIAGRAM',
        unsupportedDiagramDiagnostic.message,
        { diagnostics },
        diagnostics,
      );
    }
    const securityBlockingDiagnostic = diagnostics.find(diagnostic => diagnostic.code.startsWith('security_blocked_'));
    if (securityBlockingDiagnostic) {
      throw new XMermaidError(
        'RENDER_ERROR',
        'Render blocked by the active security policy.',
        { diagnostics },
        diagnostics,
      );
    }
    const unsupportedSyntaxBlockingDiagnostic = diagnostics.find(
      diagnostic => diagnostic.code === 'unsupported_syntax' && diagnostic.severity === 'error',
    );
    if (unsupportedSyntaxBlockingDiagnostic) {
      throw new XMermaidError(
        'RENDER_ERROR',
        unsupportedSyntaxBlockingDiagnostic.message,
        { diagnostics },
        diagnostics,
      );
    }

    const layout = await this.renderLayout(input, options.layoutConfig ?? this.layoutConfig, options.wasm);
    // The source-level %%{init}%% directive wins over an explicit theme,
    // matching Mermaid's directive-over-config precedence.
    const themeOverride = resolveSourceTheme(input) ?? options.theme;
    const renderer = themeOverride ? new SVGRenderer(themeOverride) : this.renderer;
    const svg = renderer.render(layout);
    if (securityPolicy.sanitizeSvg) {
      sanitizeSvgElement(svg);
    }

    return {
      diagramType: support.diagramType,
      diagnostics,
      dimensions: layout.dimensions,
      svg,
    };
  }

  async renderToSVGString(input: string, options: RenderOptions = {}): Promise<string> {
    const result = await this.renderToSVGElement(input, options);
    return new XMLSerializer().serializeToString(result.svg);
  }

  private async renderLayout(
    input: string,
    layoutConfig?: Partial<LayoutConfig>,
    wasmOptions?: RenderOptions['wasm'],
  ): Promise<LayoutResult> {
    try {
      await initWasm(wasmOptions);
    } catch (error) {
      throw normalizeWasmInitError(error);
    }

    let wasm;
    try {
      wasm = getWasm();
    } catch (error) {
      throw normalizeWasmInitError(error);
    }

    let layout: any;
    try {
      if (layoutConfig) {
        layout = wasm.render_with_config(input, JSON.stringify(layoutConfig));
      } else {
        layout = wasm.render(input);
      }
    } catch (error) {
      throw normalizeWasmRenderError(error);
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

    return layout as LayoutResult;
  }

  setTheme(theme: Partial<RenderTheme>): void {
    this.renderer.setTheme(theme);
  }

  /** Scan the DOM for elements with class "mermaid" and render them. */
  static async run(options: XMermaidOptions & RenderOptions): Promise<void> {
    const xm = new XMermaid(options);
    const elements = Array.from(document.querySelectorAll('.mermaid'));
    const renderOptions = renderOptionsFrom(options);

    for (const el of elements) {
      if (el instanceof HTMLElement) {
        const dsl = el.textContent?.trim();
        if (dsl) {
          xm.container = el;
          el.textContent = '';
          clearDomRunDiagnostics(el);
          try {
            const result = await xm.renderToSVGElement(dsl, renderOptions);
            el.appendChild(result.svg);
          } catch (e) {
            exposeDomRunDiagnostics(el, e);
            el.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
      }
    }
  }
}

function renderOptionsFrom(options: RenderOptions): RenderOptions {
  return {
    theme: options.theme,
    layoutConfig: options.layoutConfig,
    securityLevel: options.securityLevel,
    securityPolicy: options.securityPolicy,
    wasm: options.wasm,
  };
}

/**
 * Resolve the `%%{init: {'theme': 'name'}}%%` directive from the diagram
 * source into a render theme. The directive takes precedence over an explicit
 * `options.theme` (Mermaid treats source directives as strongest); an
 * unrecognized or missing directive leaves the ambient theme untouched.
 */
export function resolveSourceTheme(input: string): RenderTheme | undefined {
  const match = /%%\{\s*init\s*:\s*(\{[\s\S]*?)\}\s*\}%%/i.exec(input);
  if (!match) return undefined;
  // Anchor the theme key to the start of an object entry so keys merely
  // ending in "theme" (e.g. `footheme`) cannot match.
  const rawTheme = /[{,]\s*['"]?theme['"]?\s*:\s*['"]?([A-Za-z0-9_-]+)['"]?/.exec(match[1]);
  if (!rawTheme) return undefined;
  switch (rawTheme[1].toLowerCase()) {
    case 'dark':
      return DARK_THEME;
    case 'neutral':
    case 'light':
      return LIGHT_THEME;
    case 'forest':
    case 'base':
    case 'minimal':
      return MINIMAL_THEME;
    case 'default':
      return DEFAULT_THEME;
    default:
      return undefined;
  }
}

function clearDomRunDiagnostics(element: HTMLElement): void {
  element.removeAttribute('data-xmermaid-error-code');
  element.removeAttribute('data-xmermaid-diagnostics');
}

function exposeDomRunDiagnostics(element: HTMLElement, error: unknown): void {
  if (error instanceof XMermaidError) {
    element.dataset.xmermaidErrorCode = error.code;
    element.dataset.xmermaidDiagnostics = JSON.stringify(error.diagnostics);
    return;
  }

  element.dataset.xmermaidErrorCode = 'RENDER_ERROR';
  element.dataset.xmermaidDiagnostics = '[]';
}

function unsupportedFeatureToDiagnostic(feature: UnsupportedFeature): XMermaidDiagnostic {
  return {
    code: feature.id.startsWith('diagram.') ? 'unsupported_diagram_type' : 'unsupported_syntax',
    message: feature.message,
    severity: feature.severity,
    range: feature.range,
    featureId: feature.id,
  };
}

function sanitizeSvgElement(svg: SVGSVGElement): void {
  for (const element of Array.from(svg.querySelectorAll('script, foreignObject'))) {
    element.remove();
  }

  for (const element of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if ((name === 'href' || name === 'xlink:href') && hasDangerousProtocol(attribute.value)) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === 'style' && /url\s*\(\s*['"]?\s*(?:javascript|data|vbscript):/i.test(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

function hasDangerousProtocol(value: string): boolean {
  return /^(?:javascript|data|vbscript):/i.test(value.trim().replace(/[\t\r\n]/g, ''));
}

function normalizeWasmRenderError(error: unknown): XMermaidError {
  if (error instanceof XMermaidError) return error;

  const message = error instanceof Error ? error.message : String(error);
  if (/unsupported diagram type/i.test(message)) {
    return diagnosticError('UNSUPPORTED_DIAGRAM', 'unsupported_diagram_type', message, error);
  }
  if (/parse error/i.test(message)) {
    return diagnosticError('PARSE_ERROR', 'parse_error', message, error);
  }
  if (/layout/i.test(message)) {
    return diagnosticError('LAYOUT_ERROR', 'layout_error', message, error);
  }
  return diagnosticError('RENDER_ERROR', 'render_error', message, error);
}

function normalizeWasmInitError(error: unknown): XMermaidError {
  if (error instanceof XMermaidError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return diagnosticError('WASM_ERROR', 'wasm_init_error', message, error);
}

function diagnosticError(
  code: ConstructorParameters<typeof XMermaidError>[0],
  diagnosticCode: XMermaidDiagnosticCode,
  message: string,
  details: unknown,
): XMermaidError {
  const diagnostics: XMermaidDiagnostic[] = [{
    code: diagnosticCode,
    message,
    severity: 'error',
    range: null,
  }];
  return new XMermaidError(code, message, details, diagnostics);
}
