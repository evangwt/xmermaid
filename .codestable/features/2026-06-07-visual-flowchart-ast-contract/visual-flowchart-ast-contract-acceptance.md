---
doc_type: feature-acceptance
feature: 2026-06-07-visual-flowchart-ast-contract
status: accepted
accepted_at: 2026-06-07
roadmap: multi-diagram-live-editor
roadmap_items:
  - visual-flowchart-ast-contract
tags: [editor, visual-editing, wasm, ast-contract]
---

# visual-flowchart-ast-contract 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-06-07
> 关联方案 doc：`.codestable/features/2026-06-07-visual-flowchart-ast-contract/visual-flowchart-ast-contract-design.md`

## 1. 接口契约核对

**接口示例逐项核对**：

- [x] `flowchartAstToGraph(ast)`：`FlowchartAst` 输入 → `FlowchartGraphModel` 输出。代码实际行为一致：`src/editor/flowchart.ts` 将 AST direction、node label/shape、edge label/style/min_length 和 subgraphs 转入 graph model；`tests/live-editor.test.ts` 覆盖 shape、edge metadata 和 subgraph。
- [x] `analyzeFlowchartForVisualEdit(source, options?)`：source → AST-backed analysis。代码实际行为一致：默认走 `initWasm()` + `getWasm().parse_dsl()`，测试可注入 `parseDsl`；parse 成功返回 `editable + model`，parse 失败返回 diagnostic。
- [x] `validateVisualEditResult(nextSource, options?)`：next source → parse-level validation result。代码实际行为一致：parse 成功返回 `applied`，失败返回 `blocked`。

**名词层“现状 → 变化”逐项核对**：

- [x] `FlowchartGraphNode.shape` 已从 optional 变成合同字段。
- [x] `FlowchartGraphEdge.style` / `min_length` 已从 optional/缺失变成合同字段。
- [x] `FlowchartGraphModel.subgraphs` 已新增，并由 AST 转换保留。
- [x] `VisualSourceCapability` / `VisualEditDiagnostic` / `VisualSourceAnalysis` / `VisualEditApplyResult` 已新增并导出。

**流程图核对**：

- [x] analysis → model → edit → serialize → validation → commit 在 `XMermaidLiveEditor.applyVisualEditNow()` 中有实际落点。
- [x] validation blocked 分支保留原 source 并显示 diagnostics。

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] visual editor 的可信 model 来源改为 AST-backed analysis；live editor 不再调用 legacy regex helper 作为 rewrite 语义权威。
- [x] graph model 和 serializer 保留支持字段：shape、edge style、edge label、direction、min_length、subgraphs。
- [x] public helper contract 从 `src/editor/index.ts` 和 root `src/index.ts` 导出。

**明确不做逐项核对**：

- [x] 未新增拖拽画布、坐标编辑或 visual UI 控件。
- [x] 未新增 Rust parser 对 Mermaid 未支持语法的实现。
- [x] 未引入 LLM、网络调用或新 npm dependency。
- [x] 未承诺保留原始注释、空白或格式；serializer 仍输出 normalized Mermaid。
- [x] 未把完整 render/layout roundtrip fixture 矩阵塞进本 feature。

**关键决策落地**：

- [x] 新增节点默认 `rect`，新增边默认 `arrow` + `min_length: 1`。
- [x] `parseFlowchartToGraph()` 保留为 legacy/simple helper，但 visual rewrite 改用 `analyzeFlowchartForVisualEdit()`。
- [x] Serializer 覆盖 supported shape/style/subgraph 语义。
- [x] validation 先做 parser-level parse success；完整 render/layout gate 保持为后续 roadmap item。

**编排层变化核对**：

- [x] visual edit 入口已从同步 regex pipeline 改为 async AST-backed pipeline。
- [x] async visual edits 已串行化，连续点击 add node / add edge 按顺序应用，避免第二个操作读旧 source。

**挂载点反向核对**：

- [x] `src/editor/index.ts`：visual edit rewrite 编排接入 AST-backed analysis/validation。
- [x] `src/editor/index.ts` / `src/index.ts`：新增 helper 和类型导出。
- [x] 反向 grep：本 feature 的新增 helper 引用集中在 `src/editor/flowchart.ts`、`src/editor/index.ts`、`src/index.ts` 和 `tests/live-editor.test.ts`，无额外挂载点。
- [x] 拔除沙盘：删除这两个 export 挂载点和 live editor 调用点后，feature 对用户/系统视角消失，内部纯 helper 不构成额外挂载点。

## 3. 验收场景核对

- [x] **S1**：AST supported shape 转 graph 后保留 shape，label null 时用 id。
  - 证据：`tests/live-editor.test.ts` helper-level test。
- [x] **S2**：AST edge style、label、min_length 转 graph 后保留。
  - 证据：`tests/live-editor.test.ts` helper-level test。
- [x] **S3**：subgraph AST 转 graph 后保留，并可 serialize 为 `subgraph/end`。
  - 证据：`tests/live-editor.test.ts` serializer test。
- [x] **S4**：rename-node 不丢 non-rect shape 和 non-arrow edge style。
  - 证据：`tests/live-editor.test.ts` live editor visual rename test；浏览器 smoke 也验证 `A(Begin) ==>|yes| B{End}`。
- [x] **S5**：parse 成功的 flowchart source analysis 返回 editable + model。
  - 证据：`tests/live-editor.test.ts` injected parse test。
- [x] **S6**：parse 失败或非 flowchart AST 返回 diagnostic 且不提交 rewrite。
  - 证据：`tests/live-editor.test.ts` parse failure diagnostic test。
- [x] **S7**：`validateVisualEditResult` parse 成功 applied，parse 失败 blocked。
  - 证据：`tests/live-editor.test.ts` validation failure test；success path由 live editor rename/add/remove tests 覆盖。

**浏览器验证**：

- [x] `npm run build` 后用 Vite 打开 `http://127.0.0.1:4173/examples/live-editor.html`。
- [x] Playwright 把 selected source 改为 `flowchart TD\n  A(Start) ==>|yes| B{End}`，打开 Visual panel，rename `A` 为 `Begin`。
- [x] 结果：selected source 和 document textarea 均为 `A(Begin) ==>|yes| B{End}`，SVG 仍渲染，diagnostics 为 `No diagnostics.`。

## 4. 术语一致性

- `Visual graph model`：代码中对应 `FlowchartGraphModel`，无冲突。
- `AST-backed analysis`：代码中对应 `analyzeFlowchartForVisualEdit()`，命名一致。
- `Visual validation`：代码中对应 `validateVisualEditResult()`，命名一致。
- legacy helper：`parseFlowchartToGraph()` 仍存在，但 live editor visual rewrite 不再使用它作为语义权威。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md` 已更新当前静态 Live Editor MVP 段落：记录 AST-backed visual graph model、analysis/validation helper、model 保留字段、legacy helper 边界、async visual edit 串行化和后续 safety gate 边界。

## 6. requirement 回写

- [x] `production-support-contract` 为 current req，本 feature 改变了 live editor 用户可见的支持合同边界。
- [x] `.codestable/requirements/production-support-contract.md` 已追加 implemented_by、用户故事和 2026-06-07 变更日志。

## 7. roadmap 回写

- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-items.yaml`：`visual-flowchart-ast-contract` 已从 `in-progress` 改为 `done`，feature 指向 `2026-06-07-visual-flowchart-ast-contract`。
- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-roadmap.md`：第 5 节对应条目改为 `done` 并补充备注；变更日志追加本次完成记录。
- [x] YAML 校验通过。

## 8. attention.md 候选盘点

- [x] 本 feature 未暴露需要补入 `.codestable/attention.md` 的环境、命令或路径陷阱。`dist/`、`pkg/` 仍是 ignored build artifacts，已是仓库现状，不需要追加注意事项。

## 9. 遗留

- `visual-edit-safety-gate` 仍需区分 preview-only direction 和 source direction edit，并对不能可靠 roundtrip 的 source 阻断反写。
- `visual-roundtrip-contract-tests` 仍需用真实 Rust/WASM parse/render fixture 矩阵覆盖 supported shapes、edge styles、subgraph 和 blocked unsupported syntax。
- Serializer 输出 normalized Mermaid，仍不保留注释、空白或用户原始排版。
