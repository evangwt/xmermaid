import type { WasmInitOptions } from './types/options';

export interface XMermaidWasmModule {
  compute_layout(astJson: string): string;
  default?: (moduleOrPath?: WasmPackInitInput | { module_or_path?: WasmPackInitInput }) => Promise<unknown> | unknown;
  default_config(): string;
  get_diagram_type(astJson: string): string;
  init?: () => void;
  parse_dsl(input: string): string;
  render(input: string): unknown;
  render_with_config(input: string, configJson?: string | null): unknown;
}

type WasmPackInitInput =
  | string
  | URL
  | Request
  | Response
  | BufferSource
  | WebAssembly.Module
  | Promise<Response>;

let wasmModule: XMermaidWasmModule | null = null;
let wasmModuleLoader: (() => Promise<XMermaidWasmModule>) | null = null;

export async function initWasm(options: WasmInitOptions = {}): Promise<void> {
  if (wasmModule) return;
  const loadedModule = await loadWasmModule();
  if (loadedModule.default) {
    await loadedModule.default({ module_or_path: resolveWasmInitInput(options) });
  }
  wasmModule = loadedModule;
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

function loadWasmModule(): Promise<XMermaidWasmModule> {
  return wasmModuleLoader
    ? wasmModuleLoader()
    : import(/* @vite-ignore */ '../pkg/xmermaid_wasm.js');
}

function resolveWasmInitInput(options: WasmInitOptions): WasmPackInitInput | undefined {
  if (options.fetch && options.wasmUrl) {
    return options.fetch(options.wasmUrl);
  }
  return options.wasmUrl;
}

export function __setWasmModuleLoaderForTests(loader: (() => Promise<XMermaidWasmModule>) | null): void {
  wasmModule = null;
  wasmModuleLoader = loader;
}
