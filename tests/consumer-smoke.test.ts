import { createRequire } from 'node:module';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
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
      'package/dist/xmermaid.cjs',
      'package/dist/xmermaid_wasm_bg.wasm',
      'package/README.md',
      'package/package.json',
    ])).not.toThrow();

    expect(() => validatePackFiles([
      'package/dist/index.d.ts',
      'package/dist/xmermaid.esm.js',
      'package/dist/xmermaid.cjs',
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

  it('keeps the declared CommonJS package entry requireable after installation', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      exports?: { '.'?: { require?: string } };
    };
    const requirePath = packageJson.exports?.['.']?.require;
    expect(requirePath).toBeTypeOf('string');

    const tempRoot = mkdtempSync(join(tmpdir(), 'xmermaid-cjs-entry-'));
    try {
      const packageRoot = join(tempRoot, 'node_modules', 'xmermaid');
      mkdirSync(join(packageRoot, dirname(requirePath!)), { recursive: true });
      copyFileSync('package.json', join(packageRoot, 'package.json'));
      copyFileSync(requirePath!.replace(/^\.\//, ''), join(packageRoot, requirePath!));
      writeFileSync(join(tempRoot, 'consumer.cjs'), [
        "const xmermaid = require('xmermaid');",
        "if (typeof xmermaid.XMermaid !== 'function') {",
        "  throw new Error('XMermaid CommonJS export is unavailable');",
        '}',
      ].join('\n'));

      const result = spawnSync(process.execPath, [join(tempRoot, 'consumer.cjs')], {
        encoding: 'utf8',
      });

      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('keeps smoke-test WebSocket tooling out of runtime dependencies', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies ?? {}).not.toHaveProperty('ws');
    expect(packageJson.devDependencies ?? {}).toHaveProperty('ws');
  });
});
