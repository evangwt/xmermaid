---
doc_type: feature-acceptance
feature: 2026-06-07-visual-edit-safety-gate
status: accepted
accepted_at: 2026-06-07
roadmap: multi-diagram-live-editor
roadmap_items:
  - visual-edit-safety-gate
tags: [editor, visual-editing, diagnostics, safety-gate]
---

# visual-edit-safety-gate 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-06-07
> 关联方案 doc：`.codestable/features/2026-06-07-visual-edit-safety-gate/visual-edit-safety-gate-design.md`

## 1. 接口契约核对

- [x] `analyzeFlowchartForVisualEdit(source, options?)`：source 含 support analyzer 命中的 unsupported syntax 时返回 `capability: 'read-only'`、`model: null` 和 `visual_unsupported_syntax`。
- [x] `VisualFlowchartParseOptions` 支持注入 `detectUnsupportedFeatures`，测试可绕开默认 analyzer。
- [x] `XMermaidLiveEditor` toolbar 新增 `data-xm-apply-source-direction`，source direction edit 有明确触发入口。

**流程图核对**：

- [x] visual edit trigger → safety gate → blocked diagnostic / AST analysis 的分支在 `src/editor/flowchart.ts` 落地。
- [x] direction dropdown → preview-only rerender 在 `src/editor/index.ts` 落地。
- [x] apply source direction → queued visual edit → validation → commit 在 `src/editor/index.ts` 落地。

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] unsupported source 的 visual rewrite 被阻断并显示诊断。
- [x] direction dropdown 只影响 preview layout，不修改 selected source/document。
- [x] Apply direction button 才执行 source direction edit，并复用 AST-backed validation。

**明确不做逐项核对**：

- [x] 未新增 Mermaid parser 支持面。
- [x] 未新增拖拽画布、shape/style 编辑 UI。
- [x] 未引入新 dependency、LLM 或网络调用。
- [x] 未实现完整 render/layout roundtrip fixture 矩阵。
- [x] 未改变手动编辑 selected source textarea 的行为。

**关键决策落地**：

- [x] Safety gate 复用 `detectUnsupportedFeatures(source)`，没有在 editor 内复制 unsupported scanner。
- [x] Gate fail-closed：unsupported features 非空时不调用 AST parser。
- [x] Direction dropdown 改为 preview-only；source edit 由 `Apply direction` 明确触发。
- [x] Source direction edit 进入已有 async visual edit queue。

**挂载点反向核对**：

- [x] `src/editor/index.ts`：新增 `data-xm-apply-source-direction` 控件。
- [x] `src/editor/flowchart.ts`：analysis 接入 support analyzer safety gate。
- [x] 反向 grep：新增挂载点只在 toolbar/test/example style expectations 中出现，无额外入口。
- [x] 拔除沙盘：删除 button 挂载和 flowchart analysis gate 后，本 feature 行为消失；没有残留后台任务、配置 key 或外部注册项。

## 3. 验收场景核对

- [x] **S1**：`classDef` source 的 visual edit 返回 `visual_unsupported_syntax`。
  - 证据：`tests/live-editor.test.ts` helper + live editor tests。
- [x] **S2**：unsupported source 被 visual edit 后 selected source 和 document text 保持原文。
  - 证据：`tests/live-editor.test.ts` live editor test。
- [x] **S3**：direction dropdown 改 LR 后 render request 用 LR，但 source 仍为 `flowchart TD`。
  - 证据：`tests/live-editor.test.ts` toolbar test；Playwright browser smoke。
- [x] **S4**：Apply source direction 后 selected source/document 变为 `flowchart LR`。
  - 证据：`tests/live-editor.test.ts` toolbar test；Playwright browser smoke。
- [x] **S5**：Apply source direction 遇到 unsupported source 时不改 source 并显示 diagnostic。
  - 证据：`tests/live-editor.test.ts` toolbar test；Playwright browser smoke。
- [x] **S6**：supported source 上普通 visual rename 仍能反写并保留 shape/style。
  - 证据：上一 feature 的 AST-backed rename test 仍在 full suite 中通过。

**浏览器验证**：

- [x] `npm run build` 后用 Vite 打开 `http://127.0.0.1:4173/examples/live-editor.html`。
- [x] Direction dropdown 从 TD 选 LR：snapshot 显示 selected source 仍为 `graph TD ...`，SVG 继续渲染。
- [x] 点击 Apply direction：selected source/document 改为 `flowchart LR ...`，diagnostics 为 `No diagnostics.`。
- [x] 手动输入 `flowchart TD\n  A --> B\n  classDef hot fill:#fff` 后点击 Apply direction：source 保持 TD + classDef，diagnostics 显示 `visual_unsupported_syntax`。

## 4. 术语一致性

- `Visual safety gate`：代码中由 `visualUnsupportedDiagnostics()` + `detectUnsupportedFeatures()` 实现。
- `Read-only visual state`：代码中为 `capability: 'read-only'` + `model: null`。
- `Preview-only direction`：代码中为 direction select change 只调用 `renderSelected()`。
- `Source direction edit`：代码中为 `data-xm-apply-source-direction` click 后调用 `set-direction` visual edit。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md` 已更新 live editor visual edit 段落，记录 support analyzer safety gate、preview-only direction、explicit source direction edit 和后续 roundtrip fixture 边界。

## 6. requirement 回写

- [x] `.codestable/requirements/production-support-contract.md` 已追加 `2026-06-07-visual-edit-safety-gate`、用户故事和变更日志。

## 7. roadmap 回写

- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-items.yaml`：`visual-edit-safety-gate` 已改为 `done`。
- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-roadmap.md`：第 5 节对应条目和变更日志已同步。
- [x] YAML 校验通过。

## 8. attention.md 候选盘点

- [x] 本 feature 未暴露需要补入 `.codestable/attention.md` 的环境、命令或路径陷阱。

## 9. 遗留

- `visual-roundtrip-contract-tests` 仍需把真实 Rust/WASM parse/render fixture 矩阵纳入回归证据。
- 当前 safety gate 依赖 production support analyzer 的覆盖面；support analyzer 没识别出的 parser-supported-but-serializer-risky 语法仍需由下一条 roundtrip contract tests 补证。
