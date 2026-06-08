import type { WasmInitOptions } from './types/options';

export interface XMermaidWasmModule {
  compute_layout(astJson: string): string;
  default?: (moduleOrPath?: string | URL | { module_or_path?: string | URL }) => Promise<unknown> | unknown;
  default_config(): string;
  get_diagram_type(astJson: string): string;
  init?: () => void;
  parse_dsl(input: string): string;
  render(input: string): unknown;
  render_with_config(input: string, configJson?: string | null): unknown;
}

let wasmModule: XMermaidWasmModule | null = null;

export async function initWasm(options: WasmInitOptions = {}): Promise<void> {
  if (wasmModule) return;
  wasmModule = await import(/* @vite-ignore */ '../pkg/xmermaid_wasm.js');
  if (wasmModule?.default) {
    await wasmModule.default(options.wasmUrl);
  }
}

export function isWasmReady(): boolean {
  return wasmModule !== null;
}

export function getWasm(): XMermaidWasmModule {
  if (!wasmModule) {
    throw new Error('WASM module not initialized. Call initWasm() first.');
  }
  return wasmModule;
}
