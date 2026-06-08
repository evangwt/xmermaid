---
doc_type: issue-fix
issue: 2026-06-08-wasm-init-retry-state
path: fast-track
fix_date: 2026-06-08
tags: [production, wasm, sdk]
---

# WASM Init Retry State 修复记录

## 1. 问题描述

`initWasm()` cached the imported module before calling the wasm-pack default initializer. If default initialization rejected, readiness state was still polluted.

## 2. 根因

The loader used one variable, `wasmModule`, both as "module imported" and "module initialized" state. That conflated two lifecycle phases.

## 3. 修复方案

- Load the module into a local variable.
- Run the wasm-pack default initializer with the optional `wasmUrl`.
- Assign `wasmModule` only after initialization succeeds.
- Add a narrow test hook so the retry/failure state can be tested without loading real WASM.

## 4. 改动文件清单

- `src/wasm.ts`
- `tests/wasm.test.ts`

## 5. 验证结果

- Red test observed before implementation:
  - `npm test -- tests/wasm.test.ts` failed because the test hook did not exist and the retry behavior was not testable.
- Targeted verification after implementation:
  - `npm test -- tests/wasm.test.ts` passed.
  - `npm test -- tests/wasm.test.ts tests/xmermaid.test.ts tests/consumer-smoke.test.ts` passed.
  - `npm run typecheck` passed.
  - `npm run verify:release` passed.

## 6. 遗留事项

No remaining blocker for this issue. The test hook is intentionally named `__setWasmModuleLoaderForTests` and should not become product API.
