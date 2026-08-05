#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const { existsSync, rmSync } = require('node:fs');
const { delimiter, join } = require('node:path');
const { homedir } = require('node:os');

const rustupBin = join(homedir(), '.cargo', 'bin');
const existingPath = process.env.PATH || '';
const pathParts = existingPath.split(delimiter).filter(Boolean);
const childPath = existsSync(rustupBin)
  ? [rustupBin, ...pathParts.filter(part => part !== rustupBin)].join(delimiter)
  : existingPath;

if (process.argv.includes('--clean-output')) {
  rmSync(join(process.cwd(), 'dist'), { recursive: true, force: true });
}

const args = [
  'build',
  'crates/xmermaid-wasm',
  '--out-dir',
  '../../pkg',
  '--target',
  'web',
];

const result = spawnSync('wasm-pack', args, {
  env: {
    ...process.env,
    PATH: childPath,
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error('[xmermaid build-wasm diagnostic] Failed to launch wasm-pack.');
  console.error(`[xmermaid build-wasm diagnostic] ${result.error.message}`);
  console.error('[xmermaid build-wasm diagnostic] Ensure wasm-pack is installed and available on PATH.');
  process.exit(1);
}

if (result.status !== 0) {
  console.error('[xmermaid build-wasm diagnostic] wasm-pack build failed.');
  console.error(`[xmermaid build-wasm diagnostic] rustup bin path preferred: ${rustupBin}`);
  console.error('[xmermaid build-wasm diagnostic] If the error mentions wasm32-unknown-unknown, install it with: rustup target add wasm32-unknown-unknown');
  process.exit(result.status ?? 1);
}
