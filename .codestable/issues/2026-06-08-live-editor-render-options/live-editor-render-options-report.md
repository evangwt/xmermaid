---
doc_type: issue-report
issue: 2026-06-08-live-editor-render-options
status: confirmed
severity: P1
summary: Live editor default rendering ignored SDK render options.
tags: [production, live-editor, wasm, sdk]
---

# Live Editor Render Options Issue Report

## 1. 问题现象

`XMermaidLiveEditorOptions.xmermaidOptions` was documented by type as the way to pass SDK options into the default render path, but it only covered constructor options. Render-time SDK options such as `wasm.wasmUrl`, `securityLevel`, and `securityPolicy` could not reach `XMermaid.renderToSVGElement()`.

## 2. 复现步骤

1. Create an `XMermaidLiveEditor` without a custom `renderDiagram`.
2. Pass `xmermaidOptions: { wasm: { wasmUrl }, securityLevel: 'loose' }`.
3. Mount the editor.
4. Observe the default render path calls `renderToSVGElement(source)` without the render options.

复现频率：稳定。

## 3. 期望 vs 实际

**期望行为**：The live editor default render path should preserve the browser SDK render contract, including custom WASM asset URL and security options.

**实际行为**：The editor constructed `XMermaid` with constructor options but dropped render-time options during `renderToSVGElement()`.

## 4. 环境信息

- 涉及模块 / 功能：live editor default preview runtime
- 相关文件 / 函数：`src/editor/index.ts`, `XMermaidLiveEditor.defaultRenderDiagram`
- 运行环境：browser SDK and live editor integration
- 其他上下文：found after making `RenderOptions.wasm.wasmUrl` a real SDK contract

## 5. 严重程度

**P1** — Hosts using a non-default WASM asset base path could configure the SDK render API correctly but still have the live editor fail through its default renderer.
