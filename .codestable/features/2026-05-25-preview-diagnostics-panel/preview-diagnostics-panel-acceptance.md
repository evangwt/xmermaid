---
doc_type: feature-acceptance
feature: 2026-05-25-preview-diagnostics-panel
status: accepted
accepted_at: 2026-05-25
roadmap: multi-diagram-live-editor
roadmap_item: preview-diagnostics-panel
tags: [editor, diagnostics, preview, source-map]
---

# preview-diagnostics-panel 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-05-25
> 关联方案 doc：`.codestable/features/2026-05-25-preview-diagnostics-panel/preview-diagnostics-panel-design.md`

## 1. 接口契约核对

**接口示例逐项核对**：

- [x] `RenderDiagnostic` / `RenderDiagnosticCode`：`src/editor/index.ts` 定义，`src/index.ts` 公开类型导出。
- [x] Diagnostics panel：`XMermaidLiveEditor` 渲染 `[data-xm-diagnostics]`，成功时显示 `[data-xm-diagnostics-empty]`，失败时显示 `[data-xm-diagnostic-item]`。
- [x] Error normalization：普通 `Error` 映射 `render_error`；`XMermaidError('PARSE_ERROR')` 映射 `parse_error`；`XMermaidError('UNSUPPORTED_DIAGRAM')` 映射 `unsupported_diagram_type`。

**名词层“现状 → 变化”逐项核对**：

- [x] 现有 preview error 仍显示在 preview 区。
- [x] 新增结构化 diagnostics panel，不再只有字符串错误。
- [x] diagnostic `range` 默认使用 selected diagram `range`。

**流程图核对**：

- [x] select/edit diagram → `renderSelected()` → clear diagnostics。
- [x] render success → diagnostics empty state。
- [x] render throws → normalize error → preview error + diagnostics item。

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] 渲染失败进入 diagnostics panel，带 code/message/line range。
- [x] 切换图表或重新编辑后 diagnostics 刷新。
- [x] 无图表时 diagnostics panel 保持空状态，不抛异常。

**明确不做逐项核对**：

- [x] 未实现 repair suggestion 或 apply button。
- [x] 未实现 export/share/hash API。
- [x] 未实现 visual edit / graph model / serialize API。
- [x] 未新增 npm dependency。

**关键决策落地**：

- [x] `LiveEditorRenderRequest` 保持 `Promise<void>` 注入点，未要求 render callback 返回新结构。
- [x] `XMermaidError` code 映射集中在 `renderDiagnosticCode()`。
- [x] Diagnostics DOM 使用 `data-xm-diagnostics` / `data-xm-diagnostic-item`，测试和后续 UI 可稳定引用。

**挂载点反向核对**：

- [x] `src/editor/index.ts`：类型、normalization、panel DOM。
- [x] `src/index.ts`：`RenderDiagnostic` / `RenderDiagnosticCode` 类型导出。
- [x] `examples/live-editor.html`：diagnostics panel 样式。

## 3. 验收场景核对

- [x] **S1**：普通 `Error` 显示 `render_error`、message 和 selected range。
  - 证据：`tests/live-editor.test.ts` diagnostics test 通过。
- [x] **S2**：`XMermaidError('PARSE_ERROR')` 显示 `parse_error` 和 selected range。
  - 证据：`tests/live-editor.test.ts` parse mapping test 通过。
- [x] **S3**：渲染成功后 diagnostics panel 清空错误状态。
  - 证据：success rerender test 通过。
- [x] **S4**：第二张图失败时 range 指向第二张图。
  - 证据：clicked second diagram range test 通过，line range 为 second diagram source content。
- [x] **S5**：无图表输入显示无诊断状态。
  - 证据：empty diagnostics state test 通过。
- [x] **S6**：unsupported diagram error maps to `unsupported_diagram_type`，不伪装成 parse error。
  - 证据：unsupported mapping test 通过。

**浏览器验证**：

- [x] `http://127.0.0.1:4173/examples/live-editor.html`：Playwright console 0 errors / 0 warnings。
- [x] DOM evidence：`{"buttons":2,"svg":true,"diagnostics":true,"empty":"No diagnostics.","items":0,"errors":0}`。

## 4. 术语一致性

- [x] `RenderDiagnostic` / `RenderDiagnosticCode` 与 roadmap 第 4.3 节一致。
- [x] `DocumentDiagnostic` 仍保留给 document/extractor 诊断，未混用。
- [x] 未引入 repair/visual edit/export 相关术语。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md` 的“当前静态 Live Editor MVP”段落已补入 `RenderDiagnostic`、diagnostics panel 和 `XMermaidError` 映射事实。
- [x] 不需要更新 layout/renderer 架构：本 feature 只规范化 editor preview 层错误展示。
- [x] `.codestable/attention.md` 不需要补：没有新增常驻环境、命令或路径约束。

## 6. requirement 回写

- [x] `requirement` 为空；本 feature 从 roadmap 起头，当前仓库没有对应 requirements 文档。能力事实已归并到 architecture，并保留 roadmap/feature acceptance 作为现状证据。

## 7. roadmap 回写

- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-items.yaml`：`preview-diagnostics-panel` 从 `in-progress` 改为 `done`，保留 feature 目录名。
- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-roadmap.md`：子 feature 清单同步为 `done`，对应 feature 填入 `2026-05-25-preview-diagnostics-panel`。

## 8. attention.md 候选盘点

- [x] 无候选：本 feature 未暴露需要补入 `.codestable/attention.md` 的常驻环境、命令或路径约束。

## 9. 遗留

- 后续优化点：`syntax-repair-rules-v1` 可消费 `RenderDiagnostic`，生成确定性修复建议。
- 已知限制：没有 parser-level exact source span；当前 fallback range 是 selected diagram range。
- 实现阶段顺手发现：无。

## 10. 验证命令

- [x] RED：`npm test -- tests/live-editor.test.ts` → 7 expected failures，均因 diagnostics panel/types/styles 缺失。
- [x] GREEN：`npm test -- tests/live-editor.test.ts` → 20 tests passed。
- [x] `npm run typecheck` → exit 0。
- [x] `npm run verify:release` → build, JS tests, typecheck, cargo test, diff whitespace all passed。
- [x] Playwright browser check → console 0 errors / 0 warnings, diagnostics panel present, SVG preview present.
