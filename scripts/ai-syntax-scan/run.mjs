#!/usr/bin/env node
/**
 * AI-syntax scan runner.
 *
 * The scan needs a DOM (the renderer builds SVG elements and the sanitizer
 * walks attributes) plus the real WASM artefact, so it runs inside vitest's
 * jsdom environment. This script is the single reproducible entry point.
 *
 * Usage:
 *   node scripts/ai-syntax-scan/run.mjs
 *
 * Output:
 *   docs/ai-syntax-scan.md   (regenerated on every run)
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'npx',
  ['vitest', 'run', 'tests/ai-syntax-scan.test.ts'],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

process.exit(result.status ?? 1);
