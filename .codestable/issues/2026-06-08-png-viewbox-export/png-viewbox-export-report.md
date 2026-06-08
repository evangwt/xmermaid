---
doc_type: issue-report
issue: 2026-06-08-png-viewbox-export
status: fixed
severity: P1
summary: PNG export collapsed viewBox-only SVGs to 1x1 when image natural size was unavailable.
tags: [production, live-editor, export, png]
---

# PNG ViewBox Export Issue Report

## 1. 问题现象

`exportDiagram({ format: 'png' })` accepted a public `SVGSVGElement`, but PNG sizing only used `Image.naturalWidth` / `naturalHeight` or explicit `width` / `height` attributes. A valid SVG with only `viewBox` dimensions could export through a 1x1 canvas when the decoded image did not report natural size.

## 2. 复现步骤

1. Create an `SVGSVGElement` with `viewBox="0 0 640 360"` and no `width` / `height` attributes.
2. Call `exportDiagram({ svg, format: 'png' })`.
3. Simulate or observe a browser path where `Image.naturalWidth` and `Image.naturalHeight` are unavailable or zero.
4. Observe the export canvas falls back to 1x1.

复现频率：稳定 under the unavailable-natural-size path.

## 3. 期望 vs 实际

**期望行为**：PNG export should use the SVG `viewBox` width and height when natural image size and explicit dimensions are unavailable.

**实际行为**：The helper ignored `viewBox` and collapsed the PNG canvas to 1x1.

## 4. 环境信息

- 涉及模块 / 功能：share/export helper, PNG export
- 相关文件 / 函数：`src/editor/share.ts`, `exportDiagram()`, `exportPng()`
- 运行环境：browser live editor/runtime helper
- 其他上下文：found while reviewing the completed share/export roadmap contract

## 5. 严重程度

**P1** — A successful-looking PNG export with a 1x1 canvas is a broken artifact, not a degraded export.
