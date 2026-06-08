---
doc_type: issue-report
issue: 2026-06-08-wasm-init-retry-state
status: fixed
severity: P1
summary: Failed WASM initialization could poison loader readiness state.
tags: [production, wasm, sdk]
---

# WASM Init Retry State Issue Report

## 1. 问题现象

If WASM initialization failed after the module import succeeded, the loader stored the module before initialization finished. `isWasmReady()` could report ready even though wasm-pack initialization failed, and later calls to `initWasm()` would skip retrying.

## 2. 复现步骤

1. Configure the WASM module default initializer to reject once.
2. Call `initWasm({ wasmUrl: badUrl })`.
3. Observe the rejection.
4. Call `isWasmReady()` and then retry with a valid URL.

复现频率：稳定 in a mocked wasm-pack initialization failure path.

## 3. 期望 vs 实际

**期望行为**：Failed initialization should leave the loader unready, and a later call should retry initialization.

**实际行为**：The module was cached before default initialization completed, so a failed init could poison process-level state.

## 4. 环境信息

- 涉及模块 / 功能：browser SDK WASM loader
- 相关文件 / 函数：`src/wasm.ts`, `initWasm()`, `isWasmReady()`, `getWasm()`
- 运行环境：browser SDK runtime, covered by Vitest with mocked wasm-pack initializer
- 其他上下文：found during production-grade review after making `wasmUrl` a real public contract

## 5. 严重程度

**P1** — A transient bad asset URL or failed WASM fetch could leave a long-lived SDK instance unable to recover without a page reload.
