---
doc_type: issue-report
issue: 2026-06-08-live-editor-stale-export
status: fixed
severity: P1
summary: Live editor could export a stale preview after the current source failed to render.
tags: [production, live-editor, export, diagnostics]
---

# Live Editor Stale Export Issue Report

## 1. 问题现象

The live editor intentionally keeps the last successful preview visible after a later render failure. The export toolbar still looked for any preview SVG and could export that old SVG while the selected source currently had render diagnostics.

## 2. 复现步骤

1. Mount `XMermaidLiveEditor` with a valid flowchart.
2. Let the initial preview render successfully.
3. Edit the selected source so the current render fails.
4. Click `Export SVG`.
5. Observe that the export event can still fire using the previous SVG.

复现频率：稳定。

## 3. 期望 vs 实际

**期望行为**：A retained previous preview may remain visible for context, but export must only succeed when that preview matches the current selected diagram source.

**实际行为**：The export path treated the retained previous SVG as exportable current output and did not check whether the latest render had succeeded.

## 4. 环境信息

- 涉及模块 / 功能：live editor share/export workbench
- 相关文件 / 函数：`src/editor/index.ts`, `XMermaidLiveEditor.renderSelected()`, `XMermaidLiveEditor.exportCurrentDiagram()`
- 运行环境：browser live editor runtime
- 其他上下文：found while reviewing the completed `multi-diagram-live-editor` roadmap contract for share/export and stale-preview behavior

## 5. 严重程度

**P1** — Exporting the wrong diagram is worse than failing: it gives users a valid-looking artifact that does not represent the current source.
