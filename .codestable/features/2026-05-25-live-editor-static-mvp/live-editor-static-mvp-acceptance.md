---
doc_type: feature-acceptance
feature: 2026-05-25-live-editor-static-mvp
status: accepted
accepted_at: 2026-05-25
roadmap: multi-diagram-live-editor
roadmap_item: live-editor-static-mvp
tags: [editor, preview, markdown, multi-diagram]
---

# live-editor-static-mvp 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-05-25
> 关联方案 doc：`.codestable/features/2026-05-25-live-editor-static-mvp/live-editor-static-mvp-design.md`

## 1. 接口契约核对

**接口示例逐项核对**：

- [x] `extractDiagrams(markdownText)`：`src/editor/index.ts` 导出 `DiagramBlock` / `DiagramDocument` / `extractDiagrams(text)`；`tests/live-editor.test.ts` 覆盖两个 fenced blocks、纯 Mermaid 和无图表输入。
- [x] `new XMermaidLiveEditor({ root, initialText }).mount()`：`src/editor/index.ts` 导出 `XMermaidLiveEditor`；测试覆盖 mount 后列表、默认 selected source、切换和 preview render。

**名词层“现状 → 变化”逐项核对**：

- [x] 新增 document extractor：`extractDiagrams` 生成 `DiagramDocument`，含 `diagrams` 和 `diagnostics`。
- [x] 新增 static editor UI：`XMermaidLiveEditor` 组合 document textarea、diagram list、selected source textarea 和 preview container。
- [x] 公开入口：`src/index.ts` 导出 live editor、extractor 和相关类型。

**流程图核对**：

- [x] User paste / edit document → `extractDiagrams`：document textarea `input` 事件重新抽取。
- [x] Render diagram list → select first / clicked diagram：`renderList()` 和 `selectDiagram()` 落地。
- [x] Populate selected source → render selected source：`selectDiagram()` 写入 source textarea，`renderSelected()` 调用 render callback。
- [x] User edits selected source → render：selected source textarea `input` 事件触发 `renderSelected()`。

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] 静态页面存在：`examples/live-editor.html` 加载 `../dist/xmermaid.esm.js` 并 mount `XMermaidLiveEditor`。
- [x] 多图抽取和切换：浏览器快照显示 `Diagram 1` / `Diagram 2` 两个按钮，selected source 为第一张图。
- [x] 实时预览：浏览器 DOM 证据显示 preview 内有 SVG，`previewText` 包含第一张图节点文本。

**明确不做逐项核对**：

- [x] 未实现语法修复按钮或 repair API：`rg -n "repair|suggestRepairs|applyRepair" src examples tests` 仅命中设计文档范围外文字时才会出现；当前代码无 repair 模块。
- [x] 未实现导出、分享、URL hash API：当前 code diff 没有 `exportDiagram`、`encodeShareState` 或 URL hash 状态实现。
- [x] 未实现 visual edit / graph model / serialize API：当前 code diff 没有 `FlowchartGraphModel`、`VisualEdit`、`serializeFlowchart`。
- [x] 未新增 npm dependency：`package.json` dependencies/devDependencies 未因本 feature 变更。

**关键决策落地**：

- [x] 不引入前端框架：实现使用 DOM API。
- [x] 渲染入口复用 `XMermaid.render()`：默认 render callback 在 `defaultRenderDiagram` 中创建 `XMermaid` 并调用 `render(source)`。
- [x] 测试可注入 render callback：`XMermaidLiveEditorOptions.renderDiagram` 已落地，测试不需要真实 WASM。

**流程级约束核对**：

- [x] 无图表时列表为空且 preview 不渲染：`tests/live-editor.test.ts` 的 empty state 用例覆盖。
- [x] 重新抽取后默认选第一张：document input handler 调用 `selectDiagram(this.diagramDocument.diagrams[0]?.id ?? null)`。
- [x] Markdown fence 优先：`extractDiagrams` 先遍历 fenced blocks，只有没有 fenced diagrams 时才处理 raw Mermaid block。
- [x] 渲染失败只影响 preview：render callback 抛错时写入 `[data-xm-preview-error]`，列表仍保留。

**挂载点反向核对**：

- [x] `src/index.ts` 导出 live editor / extractor，与方案清单一致。
- [x] `examples/live-editor.html` 是静态 MVP 页面，与方案清单一致。
- [x] 拔除沙盘：移除 `src/index.ts` 两行导出和 `examples/live-editor.html` 后 feature 对外入口消失；`src/editor/index.ts` 与 `tests/live-editor.test.ts` 是内部实现与测试。

## 3. 验收场景核对

- [x] **S1**：输入两个 ```mermaid fenced blocks → 图表列表显示两项，默认选中第一项并渲染第一张。
  - 证据：`npm test -- tests/live-editor.test.ts` 7/7 passed；Playwright snapshot 显示 `Diagram 1` / `Diagram 2`，selected source 为第一张图，preview 有 SVG。
- [x] **S2**：点击第二个图表 → selected source 切换为第二张图源码并预览第二张。
  - 证据：`tests/live-editor.test.ts` 的 selection test 断言点击第二项后 source 与最后一次 render source 为第二张图。
- [x] **S3**：编辑 selected source → 使用编辑后源码预览。
  - 证据：`tests/live-editor.test.ts` 的 rerender test 断言 `renderDiagram` 最后一次收到编辑后的 source。
- [x] **S4**：纯 Mermaid 文本抽取为一张图。
  - 证据：`extractDiagrams('graph TD\n  A --> B')` 测试通过。
- [x] **S5**：无 Mermaid 内容 → 不抛异常，UI 显示无图表空状态。
  - 证据：empty state 测试通过，render callback 未被调用。
- [x] **S6**：渲染 callback 抛错 → preview 显示错误信息，输入和图表列表保留。
  - 证据：render error 测试通过，`[data-xm-preview-error]` 显示 `parse failed`，列表仍有 1 项。

**浏览器验证**：

- [x] `http://127.0.0.1:4173/examples/live-editor.html`：Playwright console 0 errors / 0 warnings。
- [x] DOM evidence：`{"buttons":2,"selected":"graph TD","svg":true,"previewText":"YesNoStartValid?RenderShow Error","errors":0}`。

## 4. 术语一致性

- [x] `XMermaidLiveEditor`：源码、导出、测试和示例命名一致。
- [x] `extractDiagrams`：源码、导出和测试命名一致。
- [x] `DiagramBlock` / `DiagramDocument`：类型与 roadmap 文档抽取协议兼容。
- [x] 防冲突：未引入 `XMermaidEditor`，保留给未来完整 Editor SDK。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md`：应用层补入“当前静态 Live Editor MVP”，说明 `XMermaidLiveEditor`、`extractDiagrams`、`examples/live-editor.html`、与完整 Editor SDK 的边界。
- [x] 不需要更新 renderer/layout 架构：本 feature 只消费现有 `XMermaid.render()`，没有改变渲染层或 WASM 合同。
- [x] `.codestable/attention.md` 不需要补：没有发现每个 feature 都会反复踩的环境或命令约束。

## 6. requirement 回写

- [x] `requirement` 为空；本 feature 从 roadmap 起头，当前仓库没有对应 requirements 文档。能力事实已归并到 architecture，并保留 roadmap/feature acceptance 作为现状证据。

## 7. roadmap 回写

- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-items.yaml`：`live-editor-static-mvp` 从 `in-progress` 改为 `done`，保留 feature 目录名。
- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-roadmap.md`：子 feature 清单同步为 `done`，对应 feature 填入 `2026-05-25-live-editor-static-mvp`。
- [x] YAML validation 使用 `python3 .codestable/tools/validate-yaml.py --file .codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-items.yaml --yaml-only`。

## 8. attention.md 候选盘点

- [x] 无候选：本 feature 未暴露需要补入 `.codestable/attention.md` 的常驻环境、命令或路径约束。

## 9. 遗留

- 后续优化点：继续 `multi-diagram-live-editor` roadmap 的 `diagram-source-map-contract`，补 source range、安全回写和 fence/raw 区分合同。
- 已知限制：MVP 不回写原文、不提供 diagnostics panel、不提供 repair/export/share/visual editing。
- 实现阶段顺手发现：浏览器自动请求 `/favicon.ico` 造成 console error；已通过 `examples/live-editor.html` inline favicon 和 regression test 修复。

## 10. 验证命令

- [x] `npm test -- tests/live-editor.test.ts` → 7 tests passed。
- [x] `npm run typecheck` → exit 0。
- [x] `npm run build` → exit 0，dist bundle regenerated。
- [x] `npm run verify:release` → build, JS tests, typecheck, cargo test, diff whitespace all passed。
- [x] Playwright browser check → console 0 errors / 0 warnings, 2 diagram buttons, SVG preview present.
