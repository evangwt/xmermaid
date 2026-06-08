---
doc_type: issue-report
issue: 2026-06-08-production-api-contract
status: fixed
severity: P1
summary: Public production API claims exceeded the implementation and package dependency boundary.
tags: [production, api-contract, packaging, wasm]
---

# Production API Contract Issue Report

## 1. 问题现象

Production review found two contract gaps in the shipped browser SDK surface:

- `RenderOptions.wasm` exposed a configurable WASM initialization contract, but rendering ignored it.
- `ws` was listed as a runtime dependency even though it is only used by the local packed-consumer smoke test.

## 2. 复现步骤

1. Read `src/types/options.ts` and observe `RenderOptions.wasm`.
2. Render with `renderToSVGElement(source, { wasm: { wasmUrl } })`.
3. Observe that `src/xmermaid.ts` calls `initWasm()` without passing the option.
4. Read `package.json` and observe `ws` under `dependencies`.

复现频率：稳定。

## 3. 期望 vs 实际

**期望行为**：公开 TypeScript API 暴露的 WASM asset path option should affect runtime initialization, and smoke-test tooling should not be installed as browser SDK runtime dependency.

**实际行为**：`wasmUrl` was type-only API, and `ws` leaked into the package runtime dependency set.

## 4. 环境信息

- 涉及模块 / 功能：browser SDK render API, WASM loader, packed consumer smoke test, package manifest
- 相关文件 / 函数：`src/types/options.ts`, `src/xmermaid.ts`, `src/wasm.ts`, `scripts/consumer-smoke.cjs`, `package.json`
- 运行环境：repository release verification
- 其他上下文：found during production-readiness harsh review on 2026-06-08

## 5. 严重程度

**P1** — This undermines production trust: users can compile against an API that does not work, and the package installs test-only tooling as runtime surface.
