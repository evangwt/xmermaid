import type { LayoutConfig } from './layout';
import type { Dimensions } from './layout';
import type { RenderTheme } from './theme';
import type { DiagramType } from '../support';
import type { SecurityLevel, SecurityPolicy } from '../security';
import type { XMermaidDiagnostic } from './diagnostics';

export interface XMermaidOptions {
  container: HTMLElement;
  theme?: Partial<RenderTheme>;
  layoutConfig?: Partial<LayoutConfig>;
}

export interface WasmInitOptions {
  wasmUrl?: string | URL;
  fetch?: typeof globalThis.fetch;
}

export interface RenderOptions {
  theme?: Partial<RenderTheme>;
  layoutConfig?: Partial<LayoutConfig>;
  securityLevel?: SecurityLevel;
  securityPolicy?: Partial<SecurityPolicy>;
  wasm?: WasmInitOptions;
}

export interface RenderResult {
  diagramType: DiagramType;
  diagnostics: XMermaidDiagnostic[];
  dimensions: Dimensions;
  svg: SVGSVGElement;
}
