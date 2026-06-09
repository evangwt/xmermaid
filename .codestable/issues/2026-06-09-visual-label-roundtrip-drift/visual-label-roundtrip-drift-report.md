---
doc_type: issue-report
issue: 2026-06-09-visual-label-roundtrip-drift
status: fixed
severity: P1
summary: Visual edit validation accepted serialized flowchart source whose parsed label semantics differed from the intended edit model.
tags: [production, live-editor, visual-edit, roundtrip]
---

# Visual Label Roundtrip Drift Issue Report

## 1. 问题现象

The live editor visual edit path could rename a node with delimiter characters, serialize a valid-looking Mermaid source, and then accept that source even though real WASM parsing changed the node label.

Example: renaming rounded node `A` to `Bad)` serialized `A(Bad))`, which parsed back as label `Bad`.

## 2. 复现步骤

1. Start from `flowchart TD\n  A(Start) --> B`.
2. Convert the parsed AST to a `FlowchartGraphModel`.
3. Apply `{ type: 'rename-node', nodeId: 'A', label: 'Bad)' }`.
4. Serialize the model with `serializeFlowchart()`.
5. Validate the serialized source with real WASM parse/render.
6. Observe that validation returns `applied` while the parsed label is `Bad`, not `Bad)`.

复现频率：稳定。

## 3. 期望 vs 实际

**期望行为**：Visual edit may either preserve the intended model semantics or block the source commit with a diagnostic. It must not silently apply a lossy rewrite.

**实际行为**：`validateVisualEditResult()` only checked parse/render success. It did not compare the parsed AST-backed model with the intended post-edit model, so lossy rewrites could be committed.

## 4. 环境信息

- 涉及模块 / 功能：live editor visual edit safety gate
- 相关文件 / 函数：`src/editor/flowchart.ts`, `validateVisualEditResult()`, `serializeFlowchart()`, `src/editor/index.ts`, `XMermaidLiveEditor.applyVisualEditNow()`
- 运行环境：browser live editor runtime and real WASM visual roundtrip tests
- 其他上下文：found while reviewing the completed `visual-edit-safety-gate` and `visual-roundtrip-contract-tests` roadmap items

## 5. 严重程度

**P1** — This is silent user data corruption in the editor path. A failed edit is acceptable; an apparently successful edit that changes user content is not.
