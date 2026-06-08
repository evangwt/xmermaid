import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWasm, initWasm, isWasmReady, __setWasmModuleLoaderForTests } from '../src/wasm';

describe('WASM loader', () => {
  afterEach(() => {
    __setWasmModuleLoaderForTests(null);
  });

  it('does not cache a module as ready when wasm-pack initialization fails', async () => {
    const defaultInit = vi.fn()
      .mockRejectedValueOnce(new Error('bad wasm url'))
      .mockResolvedValueOnce(undefined);
    const module = {
      compute_layout: vi.fn(),
      default: defaultInit,
      default_config: vi.fn(),
      get_diagram_type: vi.fn(),
      init: vi.fn(),
      parse_dsl: vi.fn(),
      render: vi.fn(),
      render_with_config: vi.fn(),
    };
    __setWasmModuleLoaderForTests(async () => module);

    await expect(initWasm({ wasmUrl: new URL('https://cdn.example.com/missing.wasm') }))
      .rejects.toThrow('bad wasm url');
    expect(isWasmReady()).toBe(false);
    expect(() => getWasm()).toThrow(/not initialized/i);

    const goodUrl = new URL('https://cdn.example.com/xmermaid_wasm_bg.wasm');
    await initWasm({ wasmUrl: goodUrl });

    expect(isWasmReady()).toBe(true);
    expect(getWasm()).toBe(module);
    expect(defaultInit).toHaveBeenNthCalledWith(1, new URL('https://cdn.example.com/missing.wasm'));
    expect(defaultInit).toHaveBeenNthCalledWith(2, goodUrl);
  });

  it('uses a custom fetch implementation when a WASM URL is provided', async () => {
    const defaultInit = vi.fn().mockResolvedValue(undefined);
    const module = {
      compute_layout: vi.fn(),
      default: defaultInit,
      default_config: vi.fn(),
      get_diagram_type: vi.fn(),
      init: vi.fn(),
      parse_dsl: vi.fn(),
      render: vi.fn(),
      render_with_config: vi.fn(),
    };
    const wasmUrl = new URL('https://cdn.example.com/xmermaid_wasm_bg.wasm');
    const response = new Response(new Uint8Array([0]));
    const fetch = vi.fn(async () => response);
    __setWasmModuleLoaderForTests(async () => module);

    await initWasm({ wasmUrl, fetch });

    expect(fetch).toHaveBeenCalledWith(wasmUrl);
    const initInput = defaultInit.mock.calls[0]?.[0];
    await expect(initInput).resolves.toBe(response);
    expect(isWasmReady()).toBe(true);
  });
});
