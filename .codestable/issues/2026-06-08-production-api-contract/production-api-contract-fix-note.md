---
doc_type: issue-fix
issue: 2026-06-08-production-api-contract
path: fast-track
fix_date: 2026-06-08
tags: [production, api-contract, packaging, wasm]
---

# Production API Contract 修复记录

## 1. 问题描述

Production review found that the browser SDK's public API and package manifest were broader than the real implementation:

- `RenderOptions.wasm.wasmUrl` existed in public types but was not passed to the WASM loader.
- `RenderOptions.wasm.fetch` existed in public types but had no supported runtime path.
- `ws` was a runtime dependency even though only the smoke-test script uses it.

## 2. 根因

The release gate checked default browser rendering and public type resolution, but did not assert that the `wasm` render option affected initialization. The package manifest also classified the smoke-test WebSocket client as runtime dependency.

## 3. 修复方案

- Pass `RenderOptions.wasm` from `XMermaid.renderToSVGElement()` into `initWasm()`.
- Let `initWasm()` pass `wasmUrl` to the wasm-pack generated default initializer.
- Remove unsupported `fetch` from `WasmInitOptions` instead of pretending to support it.
- Move `ws` from `dependencies` to `devDependencies`.
- Extend the packed browser smoke page to explicitly render once with the installed package's `dist/xmermaid_wasm_bg.wasm` URL before the default render path.

## 4. 改动文件清单

- `src/types/options.ts`
- `src/xmermaid.ts`
- `src/wasm.ts`
- `scripts/consumer-smoke.cjs`
- `tests/xmermaid.test.ts`
- `tests/consumer-smoke.test.ts`
- `package.json`
- `package-lock.json`
- `README.md`

## 5. 验证结果

- Red test observed before implementation:
  - `npm test -- tests/xmermaid.test.ts tests/consumer-smoke.test.ts` failed because `initWasm` was called without options and `ws` was still in runtime dependencies.
- Targeted verification after implementation:
  - `npm test -- tests/xmermaid.test.ts tests/consumer-smoke.test.ts` passed.
  - `npm test -- tests/xmermaid.test.ts tests/consumer-smoke.test.ts tests/verify-release.test.ts` passed.
  - `npm run typecheck` passed.
  - `node scripts/verify-release.cjs --check-docs` passed.
  - `npm run verify:release` passed, including build, packed consumer smoke, docs sync, JS tests, typecheck, Rust tests, and whitespace diff check.

## 6. 遗留事项

No remaining blocker for this issue. A richer custom fetch pipeline is intentionally not implemented because the current production contract only needs an explicit WASM asset URL.
