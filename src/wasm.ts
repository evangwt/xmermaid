let wasmModule: typeof import('../pkg/xmermaid_wasm') | null = null;

export async function initWasm(): Promise<void> {
  if (wasmModule) return;
  wasmModule = await import(/* @vite-ignore */ '../pkg/xmermaid_wasm.js');
  if (wasmModule?.default) {
    await wasmModule.default();
  }
}

export function isWasmReady(): boolean {
  return wasmModule !== null;
}

export function getWasm() {
  if (!wasmModule) {
    throw new Error('WASM module not initialized. Call initWasm() first.');
  }
  return wasmModule;
}
