---
doc_type: feature-acceptance
feature: 2026-05-25-syntax-repair-rules-v1
status: accepted
accepted_at: 2026-05-25
roadmap: multi-diagram-live-editor
roadmap_item: syntax-repair-rules-v1
tags: [editor, repair, diagnostics, mermaid]
---

# syntax-repair-rules-v1 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-05-25
> 关联方案 doc：`.codestable/features/2026-05-25-syntax-repair-rules-v1/syntax-repair-rules-v1-design.md`

## 1. 接口契约核对

**接口示例逐项核对**：

- [x] `RepairSuggestion` / `RepairConfidence`：`src/editor/repair.ts` 定义，`src/index.ts` 公开类型导出。
- [x] `suggestRepairs(source, diagnostics)`：根据 diagnostics 生成确定性建议。
- [x] `applyRepair(source, suggestion)`：只替换第一处 exact `before` 片段，找不到时返回原 source。

**名词层“现状 → 变化”逐项核对**：

- [x] 新增 repair engine：`src/editor/repair.ts` 是纯函数模块，未把规则写进 DOM class。
- [x] 新增 repair UI：`XMermaidLiveEditor` 在 diagnostics panel 内渲染 `[data-xm-repair-suggestion]`，high-confidence suggestion 带 `[data-xm-repair-apply]`。
- [x] Root public API 导出：`suggestRepairs`、`applyRepair`、`RepairSuggestion`、`RepairConfidence`。

**流程图核对**：

- [x] render failure → normalize `RenderDiagnostic` → `suggestRepairs`。
- [x] diagnostics panel → render suggestion。
- [x] apply high-confidence suggestion → update selected source textarea → rerun render.

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] High-confidence syntax problems produce diffable suggestions with `before` and `after`.
- [x] Static live editor can apply a high-confidence repair to selected source and rerender.
- [x] Unsupported diagram type gets a low-confidence hint without apply button.

**明确不做逐项核对**：

- [x] 不接 LLM / 网络：没有 fetch/API/client 相关逻辑。
- [x] 不实现 export/share/hash API。
- [x] 不实现 visual edit / graph model / serialize API。
- [x] 不新增 npm dependency。

**关键决策落地**：

- [x] `suggestRepairs` only runs when diagnostics exist.
- [x] UI applies only high-confidence suggestions.
- [x] Applying repair updates selected source only; it does not write back to document text.

**挂载点反向核对**：

- [x] `src/editor/repair.ts`：repair types and pure functions.
- [x] `src/editor/index.ts`：suggestion rendering and apply event.
- [x] `src/index.ts`：public repair API/types.
- [x] `examples/live-editor.html`：repair suggestion/apply styles.

## 3. 验收场景核对

- [x] **S1**：source 缺少 graph/flowchart header 且有 edge 语法 → high-confidence suggestion 添加 `flowchart TD`。
  - 证据：`tests/live-editor.test.ts` repair engine test 通过。
- [x] **S2**：header 方向拼写错误 → high-confidence suggestion 修为合法方向。
  - 证据：direction typo test 通过。
- [x] **S3**：常见 arrow typo → high-confidence suggestion 修为 `-->`。
  - 证据：arrow typo test 通过。
- [x] **S4**：简单未闭合 label bracket → high-confidence suggestion 补 `]`。
  - 证据：unclosed label bracket test 通过。
- [x] **S5**：unsupported diagram diagnostic → low-confidence unsupported hint, no apply rewrite。
  - 证据：unsupported repair-engine test and editor UI no-apply test 通过。
- [x] **S6**：点击 high-confidence apply button → selected source 更新并重新 render。
  - 证据：editor apply-flow test 通过。

**浏览器验证**：

- [x] `http://127.0.0.1:4173/examples/live-editor.html`：Playwright console 0 errors / 0 warnings。
- [x] Happy-path DOM evidence：`{"buttons":2,"svg":true,"diagnostics":true,"repairSuggestions":0,"repairApply":0,"errors":0}`。

## 4. 术语一致性

- [x] `RepairSuggestion`、`suggestRepairs`、`applyRepair` 与 roadmap 第 4.4 节一致。
- [x] `RenderDiagnostic` 仍是 repair engine 输入；未引入第二套 diagnostics 类型。
- [x] 未引入 LLM/visual edit/export/share 相关运行时概念。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md` 的“当前静态 Live Editor MVP”段落已补入 deterministic repair engine 和 no-LLM/no-network 边界。
- [x] 不需要更新 renderer/layout 架构：本 feature 只影响 editor repair layer。
- [x] `.codestable/attention.md` 不需要补：没有新增常驻环境、命令或路径约束。

## 6. requirement 回写

- [x] `requirement` 为空；本 feature 从 roadmap 起头，当前仓库没有对应 requirements 文档。能力事实已归并到 architecture，并保留 roadmap/feature acceptance 作为现状证据。

## 7. roadmap 回写

- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-items.yaml`：`syntax-repair-rules-v1` 从 `in-progress` 改为 `done`，保留 feature 目录名。
- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-roadmap.md`：子 feature 清单同步为 `done`，对应 feature 填入 `2026-05-25-syntax-repair-rules-v1`。

## 8. attention.md 候选盘点

- [x] 无候选：本 feature 未暴露需要补入 `.codestable/attention.md` 的常驻环境、命令或路径约束。

## 9. 遗留

- 后续优化点：更复杂的 parser source spans and repair confidence can be added after parser diagnostics mature.
- 已知限制：v1 rules are intentionally narrow and deterministic; no LLM repair.
- 实现阶段顺手发现：无。

## 10. 验证命令

- [x] RED：`npm test -- tests/live-editor.test.ts` → 9 expected failures, all missing repair API/UI/styles.
- [x] GREEN：`npm test -- tests/live-editor.test.ts` → 29 tests passed.
- [x] `npm run typecheck` → exit 0。
- [x] `npm run verify:release` → build, JS tests, typecheck, cargo test, diff whitespace all passed。
- [x] Playwright browser check → console 0 errors / 0 warnings, happy-path editor still renders with no repair suggestions.
