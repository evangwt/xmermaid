---
doc_type: feature-acceptance
feature: 2026-05-29-live-editor-roadmap-completion
status: accepted
accepted_at: 2026-05-29
roadmap: multi-diagram-live-editor
roadmap_items:
  - share-export-workbench
  - visual-flowchart-model-v1
  - visual-flowchart-editor-v1
  - online-tool-polish
tags: [editor, roadmap-completion, export, visual-editing, polish]
---

# live-editor-roadmap-completion 验收回填

> 本文件回填同一批实现对 `multi-diagram-live-editor` 剩余 roadmap 条目的验收证据。它不是标准单条 feature design 流程产物；本次目标是“实现所有 roadmap”，因此以当前代码和 release gate 为权威证据归档。

## 1. Roadmap 条目核对

- [x] `share-export-workbench`：`src/editor/share.ts` 新增 `exportDiagram`、`encodeShareState`、`decodeShareState`；`XMermaidLiveEditor` toolbar 支持复制 selected source、复制整份 document、SVG/PNG 导出和 URL hash 分享，且 mount 时能从 `#xm=` hash 恢复 document text 和 selected diagram。
- [x] `visual-flowchart-model-v1`：`src/editor/flowchart.ts` 新增 `FlowchartGraphModel`、`VisualEdit`、`parseFlowchartToGraph`、`applyVisualEdit`、`serializeFlowchart`。
- [x] `visual-flowchart-editor-v1`：live editor 新增表单式 visual editor，支持重命名节点、增删节点、增删边、设置方向，并通过 `replaceDiagramSource` 回写当前选中 flowchart。
- [x] `online-tool-polish`：live editor toolbar 新增主题和方向控制；复制/导出错误进入 diagnostics；异步 render 使用 request sequencing；渲染失败保留上一张成功 preview。

## 2. 合同硬化核对

- [x] selected source 手动编辑会回写 `documentText` 和 document textarea，切换图表后不丢改动。
- [x] repair apply 会回写文档模型，而不是只改 selected source textarea。
- [x] `applyRepair` 优先使用精确 `SourceRange`，重复 `before` 文本不会误改第一处。
- [x] `XMermaid.render()` 将真实 WASM unsupported diagram 错误映射为 `XMermaidError('UNSUPPORTED_DIAGRAM')`，live editor diagnostics 显示 `unsupported_diagram_type`。
- [x] WASM 兼容 `compute_layout(ast_json)` 复用 AST-derived config，保留 flowchart direction。
- [x] Live editor render request 的 layout direction 跟随当前选中图表源码；切换到 `flowchart LR` 不会被 toolbar 旧默认值强制覆盖成 `TB`。
- [x] `npm run build` 会把最新 `pkg/xmermaid_wasm_bg.wasm` 同步到 `dist/xmermaid_wasm_bg.wasm`，避免示例页面加载过期 WASM。

## 3. 验收场景

- [x] selected source edit -> document textarea 包含更新内容 -> 切换回来仍保留。
- [x] slow render 请求晚于 fast render 返回时，不覆盖当前 preview。
- [x] render failure 后上一张成功 preview 仍可见，错误进入 preview error + diagnostics。
- [x] toolbar Share 写入可 decode 的 URL hash，包含当前 document text 和 selected diagram id。
- [x] 打开带 `#xm=` 的分享链接时，编辑器优先恢复 hash 内的 document text 和 selected diagram；无效 selected id 回退第一张图。
- [x] toolbar Export SVG/PNG 使用当前 preview SVG，不重新渲染。
- [x] toolbar Copy source / Copy document 调用 clipboard 写入对应文本。
- [x] 切换多图时，方向下拉和 `layoutConfig.direction` 同步到选中源码方向。
- [x] visual editor rename/add/remove node、add/remove edge、set direction 均反写 Mermaid。
- [x] 浏览器打开 `examples/live-editor.html`：初始图和第二张 `flowchart LR` 均渲染 SVG，diagnostics 为 `No diagnostics`，console 0 error/0 warning。
- [x] 浏览器点击 Share 后 reload 带 `#xm=` 的 URL：恢复第二张图、方向为 `LR`、预览正常。

## 4. 回写结果

- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-items.yaml`：剩余 4 条 planned 标为 done，feature 指向本回填目录。
- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-roadmap.md`：状态更新为 `completed`，子 feature 清单和变更日志同步。
- [x] `.codestable/architecture/ARCHITECTURE.md`：当前静态 Live Editor 段落同步 share/export、visual edit、request sequencing、stale preview、repair range 合同和 WASM unsupported 映射事实。

## 5. 验证命令

- [x] `npm test -- tests/live-editor.test.ts` -> 50 tests passed.
- [x] `npm test -- tests/xmermaid.test.ts` -> 4 tests passed.
- [x] `npm test -- tests/build-wasm.test.ts` -> 2 tests passed.
- [x] `npm run build` -> passed; `pkg/xmermaid_wasm_bg.wasm` 与 `dist/xmermaid_wasm_bg.wasm` SHA-256 一致。
- [x] `cargo test -p xmermaid-wasm compute_layout_compat_preserves_ast_direction` -> passed.
- [x] `npm run typecheck` -> passed.
- [x] `npm run verify:release` -> build, JS tests, typecheck, cargo test, diff whitespace all passed.
- [x] `python3 .codestable/tools/validate-yaml.py --file .codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-items.yaml --yaml-only` -> passed.
- [x] Playwright browser check on `http://127.0.0.1:4173/examples/live-editor.html?rebuilt=1` -> initial render, diagram switch, share reload passed.

## 6. 遗留

- Flowchart visual edit v1 intentionally serializes to normalized Mermaid and does not preserve comments, whitespace, or original formatting.
- Full Mermaid diagram coverage remains out of scope; current visual edit path supports flowchart only.
