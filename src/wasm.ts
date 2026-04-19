export interface WasmModule {
  parse_dsl(input: string): string;
  get_diagram_type(astJson: string): string;
  compute_layout(astJson: string): string;
}

let wasmModule: WasmModule | null = null;
let wasmInitialized = false;

export async function initWasm(): Promise<void> {
  if (wasmInitialized) return;

  try {
    // Dynamic import - resolved at build time by bundler
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = await import(/* @vite-ignore */ '../pkg/xmermaid_wasm.js');
    if (mod?.default) {
      await mod.default();
    }
    wasmModule = {
      parse_dsl: mod.parse_dsl,
      get_diagram_type: mod.get_diagram_type,
      compute_layout: mod.compute_layout,
    };
    wasmInitialized = true;
  } catch {
    throw new Error('Failed to initialize xmermaid WASM module. Ensure the WASM package is built.');
  }
}

export function isWasmReady(): boolean {
  return wasmInitialized && wasmModule !== null;
}

export function getWasm(): WasmModule {
  if (!wasmModule) {
    throw new Error('WASM not initialized. Call initWasm() first.');
  }
  return wasmModule;
}