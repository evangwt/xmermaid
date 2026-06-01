import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('build-wasm script', () => {
  it('runs wasm-pack with rustup bin first in PATH and preserves build arguments', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'xmermaid-build-wasm-'));
    const binDir = join(tempRoot, 'bin');
    const rustupBinDir = join(tempRoot, '.cargo', 'bin');
    const outputPath = join(tempRoot, 'wasm-pack-output.json');
    const fakeWasmPack = join(binDir, 'wasm-pack');

    mkdirSync(binDir, { recursive: true });
    mkdirSync(rustupBinDir, { recursive: true });
    writeFileSync(fakeWasmPack, [
      '#!/bin/sh',
      `printf '{"path":"%s","args":"%s"}' "$PATH" "$*" > "${outputPath}"`,
    ].join('\n'), { mode: 0o755 });

    const result = spawnSync(
      process.execPath,
      ['scripts/build-wasm.cjs'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          HOME: tempRoot,
          PATH: binDir,
        },
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
    const captured = JSON.parse(readFileSync(outputPath, 'utf8'));
    expect(captured.path.split(':')[0]).toBe(rustupBinDir);
    expect(captured.args).toBe('build crates/xmermaid-wasm --out-dir ../../pkg --target web');
  });
});

describe('copy-wasm-dist script', () => {
  it('copies the current pkg wasm binary into dist for browser bundles', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'xmermaid-copy-wasm-'));
    mkdirSync(join(tempRoot, 'pkg'), { recursive: true });
    mkdirSync(join(tempRoot, 'dist'), { recursive: true });
    writeFileSync(join(tempRoot, 'pkg', 'xmermaid_wasm_bg.wasm'), 'new wasm');
    writeFileSync(join(tempRoot, 'dist', 'xmermaid_wasm_bg.wasm'), 'old wasm');

    const result = spawnSync(
      process.execPath,
      [join(process.cwd(), 'scripts', 'copy-wasm-dist.cjs')],
      {
        cwd: tempRoot,
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
    expect(readFileSync(join(tempRoot, 'dist', 'xmermaid_wasm_bg.wasm'), 'utf8'))
      .toBe('new wasm');
  });
});
