---
doc_type: issue-report
issue: 2026-06-08-run-render-options
status: fixed
severity: P1
summary: XMermaid.run dropped SDK render options during DOM scan rendering.
tags: [production, sdk, wasm, security]
---

# XMermaid.run Render Options Issue Report

## 1. 问题现象

`XMermaid.run()` is a public DOM scan helper for `.mermaid` elements, but it only accepted constructor options and called `render()` internally. Render-time SDK options such as `wasm.wasmUrl`, `securityLevel`, and `securityPolicy` could not reach the actual render call.

## 2. 复现步骤

1. Add a `.mermaid` element to the DOM.
2. Call `XMermaid.run({ container, wasm: { wasmUrl }, securityLevel: 'loose' })`.
3. Observe that `renderToSVGElement()` is called without the render options.

复现频率：稳定。

## 3. 期望 vs 实际

**期望行为**：The DOM scan helper should preserve the same SDK render-time contract as `renderToSVGElement()`.

**实际行为**：The helper dropped render-time options and only used constructor options.

## 4. 环境信息

- 涉及模块 / 功能：browser SDK DOM scan helper
- 相关文件 / 函数：`src/xmermaid.ts`, `XMermaid.run()`
- 运行环境：browser SDK runtime
- 其他上下文：found after fixing `wasmUrl` propagation in direct SDK and live editor paths

## 5. 严重程度

**P1** — Users embedding static Mermaid blocks through the public helper could not use the same production WASM asset path and security configuration as direct SDK renders.
