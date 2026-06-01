#!/usr/bin/env node

const { copyFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const source = join(process.cwd(), 'pkg', 'xmermaid_wasm_bg.wasm');
const targetDir = join(process.cwd(), 'dist');
const target = join(targetDir, 'xmermaid_wasm_bg.wasm');

try {
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(source, target);
} catch (error) {
  console.error(`[xmermaid copy-wasm diagnostic] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
