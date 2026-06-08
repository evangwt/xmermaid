import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('CodeStable current evidence docs', () => {
  it('describes the current live editor browser gate as packed Chrome/CDP smoke', () => {
    const harshReview = readFileSync(
      '.codestable/roadmap/multi-diagram-live-editor/harsh-review-2026-06-07.md',
      'utf8',
    );

    expect(harshReview).not.toMatch(/Playwright browser smoke/i);
    expect(harshReview).toMatch(/packed Chrome\/CDP consumer smoke/i);
  });

  it('describes explicit WASM asset URL loading as current SDK behavior', () => {
    const architecture = readFileSync('.codestable/architecture/ARCHITECTURE.md', 'utf8');

    expect(architecture).not.toMatch(/WasmInitOptions.*后续自定义 WASM 加载/);
    expect(architecture).not.toMatch(/current loader 行为未改变/i);
    expect(architecture).toMatch(/`wasm\.wasmUrl`/);
    expect(architecture).toMatch(/传给 wasm-pack 初始化/);
  });
});
