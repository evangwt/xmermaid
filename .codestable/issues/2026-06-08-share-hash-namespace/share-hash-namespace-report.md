---
doc_type: issue-report
issue: 2026-06-08-share-hash-namespace
status: confirmed
severity: P1
summary: Live editor restored state from non-xmermaid URL hashes.
tags: [production, live-editor, share-state, url-hash]
---

# Share Hash Namespace Issue Report

## 1. 问题现象

`decodeShareState()` accepted any URL hash payload that decoded to JSON with a `documentText` string. `XMermaidLiveEditor` used that helper on mount, so a host page hash that was not created by `encodeShareState()` could override the editor's configured `initialText`.

## 2. 复现步骤

1. Set `window.location.hash` to an encoded JSON object containing `documentText` and `selectedDiagramId`, without the `#xm=` prefix.
2. Mount `XMermaidLiveEditor` with its own `initialText`.
3. Observe the editor restores from the unrelated hash instead of using `initialText`.

复现频率：稳定。

## 3. 期望 vs 实际

**期望行为**：Live editor share restore should only consume hashes produced by the xmermaid share encoder.

**实际行为**：The decoder treated un-prefixed JSON hashes as xmermaid share state.

## 4. 环境信息

- 涉及模块 / 功能：live editor URL hash sharing
- 相关文件 / 函数：`src/editor/share.ts`, `decodeShareState()`, `XMermaidLiveEditor` constructor
- 运行环境：browser live editor runtime embedded in host pages
- 其他上下文：found while reviewing the completed share/export roadmap contract

## 5. 严重程度

**P1** — A host page hash collision can silently replace the editor document before the user does anything.
