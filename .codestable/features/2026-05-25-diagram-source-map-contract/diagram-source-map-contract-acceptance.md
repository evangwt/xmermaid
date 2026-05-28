---
doc_type: feature-acceptance
feature: 2026-05-25-diagram-source-map-contract
status: accepted
accepted_at: 2026-05-25
roadmap: multi-diagram-live-editor
roadmap_item: diagram-source-map-contract
tags: [editor, source-map, markdown, replacement]
---

# diagram-source-map-contract 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-05-25
> 关联方案 doc：`.codestable/features/2026-05-25-diagram-source-map-contract/diagram-source-map-contract-design.md`

## 1. 接口契约核对

**接口示例逐项核对**：

- [x] `extractDiagrams(text)`：fenced block 和 raw Mermaid block 均返回 `DiagramBlock.range`，测试可用原文 slice 验证 range。
- [x] `replaceDiagramSource(text, diagramId, nextSource, document)`：`src/editor/index.ts` 已导出，返回 `{ text, document }`。
- [x] Root public API：`src/index.ts` 导出 `replaceDiagramSource` 和 `ReplaceDiagramSourceResult` 类型。

**名词层“现状 → 变化”逐项核对**：

- [x] `SourceRange` 语义落地：`startOffset/endOffset` 是 JS string offset，`endOffset` exclusive；line number 为 1-based。
- [x] fenced content range：测试断言 `text.slice(range.startOffset, range.endOffset)` 只包含 fence 内源码，不包含 ``` fence 标记。
- [x] raw Mermaid range：测试断言前后空白不在 range 内。

**流程图核对**：

- [x] found path：按 diagram id 查找 → slice before range → insert nextSource → slice after range → `extractDiagrams(nextText)`。
- [x] missing path：`extractDiagrams(text)` → append `diagram_not_found` diagnostic → 返回原文。

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] Fenced replacement 保留 Markdown prose 和 fence 标记。
- [x] Raw replacement 保留原文 range 外的前后空白。
- [x] Missing id 不抛异常，返回原文并产生 diagnostic。

**明确不做逐项核对**：

- [x] 不做 diagnostics panel UI：没有新增 UI panel 或 DOM 挂载点。
- [x] 不做 repair API：没有新增 `suggestRepairs` / `applyRepair`。
- [x] 不做 export/share/hash API：没有新增 `exportDiagram`、hash 编解码或分享状态。
- [x] 不做 visual edit / graph model / serialize API：没有新增 graph model 或 serialize 函数。
- [x] 不新增 npm dependency：`package.json` dependency 列表未变化。

**关键决策落地**：

- [x] `replaceDiagramSource` 不信任外部 id 以外的输入；只从传入 `document.diagrams` 查找 matched diagram。
- [x] 替换后立即 fresh extraction；返回的 `document.text` 与 returned `text` 一致。
- [x] 找不到 id 使用 `code: 'diagram_not_found'`、`severity: 'error'`、`range: null`。

**挂载点反向核对**：

- [x] `src/editor/index.ts` 是实现挂载点。
- [x] `src/index.ts` 是 public export 挂载点。
- [x] 没有新增 UI 或 example 页面行为；当前 feature 是底层合同。

## 3. 验收场景核对

- [x] **S1**：fenced block 的 `range` 切片只覆盖 fence 内源码。
  - 证据：`tests/live-editor.test.ts` range test 通过。
- [x] **S2**：raw Mermaid 输入带前后空白时，`range` 指向 trim 后源码，替换后前后空白保留。
  - 证据：raw range test 和 raw replacement test 通过。
- [x] **S3**：`replaceDiagramSource` 替换 fenced diagram 后，Markdown prose 和 fence 标记保持不变，returned document 重新抽取到新源码。
  - 证据：fenced replacement test 通过。
- [x] **S4**：`replaceDiagramSource` 替换 raw Mermaid block 后，returned text 和 returned document 同步。
  - 证据：raw replacement test 通过。
- [x] **S5**：找不到 `diagramId` 时返回原文，不抛异常，并产生 `diagram_not_found` diagnostic。
  - 证据：missing id test 通过。
- [x] **S6**：替换第一张图不会改动同文档第二张图。
  - 证据：fenced replacement test 断言第二张图源码仍为原值。

## 4. 术语一致性

- [x] `SourceRange`、`DiagramBlock`、`DiagramDocument` 沿用 roadmap 和 MVP 命名。
- [x] `replaceDiagramSource` 沿用 roadmap 第 4.2 节命名。
- [x] 未引入 `source map` 的第二套类型名或 `XMermaidEditor`。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md` 的“当前静态 Live Editor MVP”段落已补入 range 合同和 `replaceDiagramSource` 行为。
- [x] 不需要更新 renderer/layout 架构：本 feature 只影响 editor document-extractor 合同。
- [x] `.codestable/attention.md` 不需要补：没有新增常驻环境、命令或路径约束。

## 6. requirement 回写

- [x] `requirement` 为空；本 feature 从 roadmap 起头，当前仓库没有对应 requirements 文档。能力事实已归并到 architecture，并保留 roadmap/feature acceptance 作为现状证据。

## 7. roadmap 回写

- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-items.yaml`：`diagram-source-map-contract` 从 `in-progress` 改为 `done`，保留 feature 目录名。
- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-roadmap.md`：子 feature 清单同步为 `done`，对应 feature 填入 `2026-05-25-diagram-source-map-contract`。

## 8. attention.md 候选盘点

- [x] 无候选：本 feature 未暴露需要补入 `.codestable/attention.md` 的常驻环境、命令或路径约束。

## 9. 遗留

- 后续优化点：`preview-diagnostics-panel` 可以基于 range contract 把 parse/layout/render 错误映射到 selected diagram 和 document 位置。
- 已知限制：不做 Markdown parser；fenced block 支持仍限定 `mermaid` / `xmermaid` code fence。
- 实现阶段顺手发现：无。

## 10. 验证命令

- [x] RED：`npm test -- tests/live-editor.test.ts` → 4 expected failures，均因 `replaceDiagramSource` 未导出。
- [x] GREEN：`npm test -- tests/live-editor.test.ts` → 13 tests passed。
- [x] `npm run typecheck` → exit 0。
- [x] `npm run verify:release` → build, JS tests, typecheck, cargo test, diff whitespace all passed。
