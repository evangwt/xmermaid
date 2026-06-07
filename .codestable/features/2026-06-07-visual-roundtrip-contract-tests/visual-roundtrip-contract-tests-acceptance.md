---
doc_type: feature-acceptance
feature: 2026-06-07-visual-roundtrip-contract-tests
status: accepted
accepted_at: 2026-06-07
roadmap: multi-diagram-live-editor
roadmap_items:
  - visual-roundtrip-contract-tests
tags: [editor, visual-editing, wasm, tests]
---

# visual-roundtrip-contract-tests 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-06-07
> 关联方案 doc：`.codestable/features/2026-06-07-visual-roundtrip-contract-tests/visual-roundtrip-contract-tests-design.md`

## 1. 接口契约核对

- [x] `tests/visual-roundtrip.test.ts` 直接读取 `pkg/xmermaid_wasm_bg.wasm` bytes，并用 `pkg/xmermaid_wasm.js` default init 初始化真实 wasm-bindgen module。
- [x] `parseWithRealWasm(source)` 调用真实 `parse_dsl()`；测试没有 mock `src/wasm.ts`。
- [x] `renderWithRealWasm(source)` 调用真实 `render_with_config(source, null)`，证明 next source 能走 parse + layout/render path。
- [x] `validateVisualEditResult(nextSource, options?)` 已从 parse-only validation 补成 parse + render/layout validation；render/layout 失败返回 `visual_render_failed` 并阻断 commit。
- [x] supported fixture 串起 `flowchartAstToGraph()` → `applyVisualEdit()` → `serializeFlowchart()` → `validateVisualEditResult()` → 真实 WASM parse/render。
- [x] blocked fixture 使用 `analyzeFlowchartForVisualEdit()` 证明 support analyzer safety gate 在 rewrite 前 fail-closed。

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] supported shape/style/label source visual rename 后，真实 WASM parse 保留 `rounded`、`diamond`、`circle`、`thick`、`dotted` 和 edge label。
- [x] subgraph source visual rename 后，真实 WASM parse 仍有 subgraph，且 render 成功。
- [x] source direction edit `TD -> LR` 后，真实 WASM parse direction 为 `LR`，且 render 成功。
- [x] `classDef` source 返回 `read-only` + `visual_unsupported_syntax`，不产生 rewrite。
- [x] parse 成功但 render/layout validation 失败时返回 `blocked` + `visual_render_failed`。

**明确不做逐项核对**：

- [x] 未新增新的 UI 控件或用户工作流；仅补齐 roadmap 4.5 已声明的 visual commit render/layout validation gate。
- [x] 未新增 Mermaid parser 支持面。
- [x] 未引入 Playwright 测试文件或截图/像素基线。
- [x] 未新增 npm dependency。
- [x] 未提交 generated `dist/` / `pkg/` 产物；它们仍是 build artifacts。

**挂载点反向核对**：

- [x] 产品挂载点 `src/editor/flowchart.ts`：`validateVisualEditResult()` 在 parse 成功后调用 render/layout validator。
- [x] 产品挂载点 `src/editor/index.ts` / `src/index.ts`：导出并接入 `FlowchartDslRenderer` / `renderFlowchartDsl` 注入点。
- [x] 测试挂载点 `tests/visual-roundtrip.test.ts`：真实 WASM roundtrip fixture。
- [x] 拔除沙盘：删除 render gate 会让 parse-ok/render-fail 的 source 被提交，违背 roadmap 4.5；删除测试文件只会移除回归证据。

## 3. 验收场景核对

- [x] **S1**：supported shape/style/label source 经过 rename-node 后真实 WASM parse 保留语义。
  - 证据：`npm test -- tests/visual-roundtrip.test.ts`，`preserves supported shapes, edge styles, and labels after a visual rename` 通过。
- [x] **S2**：subgraph source 经过 rename-node 后真实 WASM parse 保留 subgraph 且 render 成功。
  - 证据：`npm test -- tests/visual-roundtrip.test.ts`，`keeps subgraph syntax roundtrippable after a visual rename` 通过。
- [x] **S3**：direction edit `TD -> LR` 后真实 WASM parse direction 为 `LR` 且 render 成功。
  - 证据：`npm test -- tests/visual-roundtrip.test.ts`，`roundtrips explicit source direction edits through real WASM parse and render` 通过。
- [x] **S4**：blocked `classDef` source 返回 `read-only` + `visual_unsupported_syntax`。
  - 证据：`npm test -- tests/visual-roundtrip.test.ts`，`blocks unsupported classDef syntax before producing a visual rewrite` 通过。
- [x] **S5**：测试初始化真实 WASM bytes，不 mock `src/wasm.ts`。
  - 证据：测试 imports `../pkg/xmermaid_wasm.js`、读取 `pkg/xmermaid_wasm_bg.wasm`，且没有 `vi.mock()`。
- [x] **S6**：parse 成功但 render/layout validation 失败时不允许 visual commit。
  - 证据：`npm test -- tests/live-editor.test.ts tests/visual-roundtrip.test.ts`，`blocks visual validation when render/layout validation fails after parse succeeds` 通过。

**浏览器补充验证**：

- [x] `python3 -m http.server 4173` 打开 `http://127.0.0.1:4173/examples/live-editor.html`。
- [x] Playwright visual rename `B -> Checked` 后 selected source/document/preview 均更新，diagnostics 为空。
- [x] Direction dropdown 选 `LR` 后 source/document 保持 `flowchart TD`；点击 `Apply direction` 后 source/document 变为 `flowchart LR`。
- [x] `classDef` source 上 visual rename 被阻断，source/document 保持原文，diagnostic 为 `visual_unsupported_syntax`。

## 4. 术语一致性

- `Real WASM roundtrip`：测试中对应 `parseWithRealWasm()` 和 `renderWithRealWasm()`。
- `Visual edit roundtrip fixture`：测试中对应 supported rename、subgraph rename 和 direction edit 三类 fixture。
- `Blocked fixture`：测试中对应 `classDef` safety gate fixture。
- `Support semantics`：测试断言覆盖 shape、edge style、edge label、direction、subgraph 和 blocked unsupported syntax。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md` 已更新 live editor visual edit 段落：记录真实 WASM roundtrip contract tests 覆盖 supported AST semantics、source direction edit、subgraph 和 blocked unsupported syntax，并记录 runtime render/layout validation gate。

## 6. requirement 回写

- [x] `.codestable/requirements/production-support-contract.md` 已追加 `2026-06-07-visual-roundtrip-contract-tests`。
- [x] 用户故事未新增新工作流；变更日志已记录真实 WASM roundtrip regression gate 和 runtime render/layout validation gate。

## 7. roadmap 回写

- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-items.yaml`：`visual-roundtrip-contract-tests` 已改为 `done`。
- [x] `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-roadmap.md`：第 5 节对应条目已改为 `done`，frontmatter status 已改为 `completed`。
- [x] YAML 校验通过。

## 8. attention.md 候选盘点

- [x] 候选：本次发现 Cargo fingerprint 曾未及时识别 `crates/xmermaid-wasm/src/lib.rs` 新增单测，已用 `cargo clean -p xmermaid-wasm` 后重跑 `cargo test` 取得可信证据。该情况偏一次性验证异常，暂不写入 `.codestable/attention.md`。

## 9. 遗留

- 当前 visual editor 仍输出 normalized Mermaid，不保留注释、空白或原始排版。
- Parser 的 subgraph 支持仍是 partial；本测试只锁“subgraph 仍存在且 render 成功”，不伪造完整 subgraph membership 承诺。
