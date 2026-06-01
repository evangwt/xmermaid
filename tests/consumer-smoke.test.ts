import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('consumer smoke helpers', () => {
  it('requires the packed package to contain runtime bundles, declarations, wasm, and README', () => {
    const { validatePackFiles } = require('../scripts/consumer-smoke.cjs') as {
      validatePackFiles(files: string[]): void;
    };

    expect(() => validatePackFiles([
      'package/dist/index.d.ts',
      'package/dist/support.d.ts',
      'package/dist/xmermaid.esm.js',
      'package/dist/xmermaid.js',
      'package/dist/xmermaid_wasm_bg.wasm',
      'package/README.md',
      'package/package.json',
    ])).not.toThrow();

    expect(() => validatePackFiles([
      'package/dist/index.d.ts',
      'package/dist/xmermaid.esm.js',
      'package/dist/xmermaid.js',
      'package/dist/xmermaid_wasm_bg.wasm',
      'package/README.md',
      'package/package.json',
    ])).toThrow(/dist\/support\.d\.ts/);
  });

  it('does not silently fall back to jsdom when Chrome is unavailable', () => {
    const { resolveChromeExecutable } = require('../scripts/consumer-smoke.cjs') as {
      resolveChromeExecutable(env: NodeJS.ProcessEnv, candidates?: string[]): string;
    };

    expect(() => resolveChromeExecutable({ CHROME_BIN: '/not/a/chrome' }, []))
      .toThrow(/CHROME_BIN/);
  });

  it('keeps the built ESM entry importable in Node for bundlers and SSR parsing', async () => {
    await import('../dist/xmermaid.esm.js');
  });
});
