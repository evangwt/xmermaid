---
doc_type: feature-acceptance
feature: 2026-06-02-render-svg-api
status: accepted
summary: 验收 renderToSVGElement、renderToSVGString 和 RenderResult 公开 API
tags: [production, sdk, render-api]
---

# render-svg-api 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-06-02
> 关联方案 doc：.codestable/features/2026-06-02-render-svg-api/render-svg-api-design.md

## 1. 接口契约核对

**接口示例逐项核对**：

- [x] `renderToSVGElement('graph TD\n  A-->B')` → 返回 `RenderResult`。
  - 代码实际行为：`tests/xmermaid.test.ts` 覆盖 `diagramType: 'flowchart'`、空 diagnostics、dimensions 和 `SVGSVGElement`。
- [x] `renderToSVGString('graph TD\n  A-->B')` → 返回 serialized SVG string。
  - 代码实际行为：`tests/xmermaid.test.ts` 覆盖字符串以 `<svg` 开头并包含 `xmermaid-diagram`。
- [x] root public API 导出 `RenderOptions`、`RenderResult`、`XMermaidDiagnostic`、`WasmInitOptions`。
  - 代码实际行为：`src/index.ts` 导出这些类型；`scripts/consumer-smoke.cjs` 的临时消费者 TypeScript fixture import 并使用它们。

**名词层"现状 → 变化"逐项核对**：

- [x] `RenderResult` / `RenderOptions` / `XMermaidDiagnostic` / `WasmInitOptions` 已新增：`src/types/options.ts`。
- [x] `XMermaid.renderToSVGElement()` / `renderToSVGString()` 已新增：`src/xmermaid.ts`。
- [x] `XMermaid.render()` 仍是 DOM replacement path：测试覆盖返回 `undefined`、清空旧 children、插入 SVG。

**流程图核对**：

- [x] `renderToSVGElement` → `initWasm` → `wasm.render/render_with_config` → enum normalize → `SVGRenderer.render` → `RenderResult`。
- [x] `render` 调用 `renderToSVGElement` 后写入 container。
- [x] `renderToSVGString` 调用 `renderToSVGElement` 后使用 `XMLSerializer`。

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] SVG element API 可复用，不修改 constructor container：`tests/xmermaid.test.ts` 覆盖 container 文本保持不变。
- [x] SVG string API 可用：目标测试覆盖。
- [x] 现有 `render(input)` 兼容：目标测试和 live editor tests 通过。
- [x] root public API 导出新类型：consumer smoke typecheck 通过。

**明确不做逐项核对**：

- [x] 未新增 PNG / Canvas / Blob export：代码只新增 SVG element/string API。
- [x] 未实现 custom `wasmUrl` 加载：`WasmInitOptions` 只是类型边界，loader 未改。
- [x] 未实现 source-range diagnostics：成功路径 diagnostics 为空，失败路径抛 `XMermaidError`。
- [x] 未新增 diagram type、security policy 或 unsupported syntax analyzer。

**关键决策落地**：

- [x] D1：三条 API 复用共享 render layout 管线：`src/xmermaid.ts` 的 `renderLayout`。
- [x] D2：单次 options 不污染实例：测试覆盖 one-shot `layoutConfig` 后下一次调用回到 `wasm.render`。
- [x] D3：失败继续抛 `XMermaidError`：unsupported diagram 测试继续通过。
- [x] D4：`renderToSVGString()` 是 element API 序列化包装。

**编排层"现状 → 变化"逐项核对**：

- [x] DOM replacement 和 SVG 输出解耦。
- [x] `diagramType` 先来自 `analyzeSupport(input)`；后续 structured diagnostics 可替换为更精确来源。
- [x] packed consumer smoke 已引用新 API 类型和方法。

**流程级约束核对**：

- [x] `render()` 仍返回 `Promise<void>`。
- [x] `renderToSVGElement()` 不修改 constructor container。
- [x] `renderToSVGString()` 不暴露额外 WASM 调用路径。
- [x] 成功路径 diagnostics 当前为空数组。
- [x] 单次 `RenderOptions` 不改变实例状态。

**挂载点反向核对（可卸载性）**：

- [x] `src/xmermaid.ts`：删除新方法和 `renderLayout` 调整后 feature 消失，旧 render 可回退原实现。
- [x] `src/types/options.ts` / `src/index.ts`：删除新类型导出后 public type contract 消失。
- [x] `scripts/consumer-smoke.cjs`：删除 typecheck fixture 新 API 引用后 packed declaration gate 不再覆盖 SVG API。
- [x] grep 反向核对：`renderToSVGElement` / `renderToSVGString` 命中均在 source、tests、consumer smoke 和 CodeStable specs。

## 3. 验收场景核对

- [x] **S1**：`renderToSVGElement` 返回 `RenderResult`。
  - 证据来源：`npm test -- tests/xmermaid.test.ts`。
  - 结果：通过。
- [x] **S2**：`renderToSVGString` 返回 serialized SVG。
  - 证据来源：`tests/xmermaid.test.ts`。
  - 结果：通过。
- [x] **S3**：现有 `render(input)` 仍替换 constructor container。
  - 证据来源：`tests/xmermaid.test.ts`、`tests/live-editor.test.ts`。
  - 结果：通过。
- [x] **S4**：one-shot `layoutConfig` 不污染后续调用。
  - 证据来源：`tests/xmermaid.test.ts`。
  - 结果：通过。
- [x] **S5**：unsupported diagram error 仍映射为 `XMermaidError('UNSUPPORTED_DIAGRAM')`。
  - 证据来源：`tests/xmermaid.test.ts`。
  - 结果：通过。
- [x] **S6**：packed consumer typecheck 能 import 新类型并调用新方法。
  - 证据来源：`npm run build && npm run smoke:consumer -- --json`。
  - 结果：通过，package size `231899` bytes，browser render duration `1375ms`。

## 4. 术语一致性

- RenderResult：仅指公开渲染结果对象。
- RenderOptions：仅指单次 SVG 输出 API options，不取代 `XMermaidOptions`。
- DOM replacement path：仅指现有 `render(input)` 兼容路径。
- 防冲突：未新增 `renderToSVG` 旧式别名，避免和历史文档中的旧计划名混淆。

## 5. 架构归并

- [x] `ARCHITECTURE.md`：已在当前 Flowchart 解耦合同中补入 SVG element/string API、`RenderResult`、成功 diagnostics 为空和 failure 抛 `XMermaidError` 的当前事实。
- [x] `ARCHITECTURE.md`：已在生产支持合同中记录 consumer smoke typecheck 会覆盖新 SVG API declarations。

## 6. requirement 回写

- [x] `production-support-contract` 已更新：新增 SDK 使用者希望直接拿 SVG element/string 的用户故事、解决方式和边界。

## 7. roadmap 回写

- [x] `.codestable/roadmap/production-readiness/production-readiness-items.yaml` 对应条目已从 `in-progress` 改为 `done`。
- [x] `.codestable/roadmap/production-readiness/production-readiness-roadmap.md` 第 5 节对应条目已同步为 done。

## 8. attention.md 候选盘点

- [x] 本 feature 未暴露新的每次都需要知道的环境约束。Chrome/`CHROME_BIN` 候选已在 `pack-install-render-smoke` 记录。

## 9. 遗留

- `WasmInitOptions` 只是类型边界，custom `wasmUrl` 加载仍未实现。
- `RenderResult.diagnostics` 成功路径当前为空；结构化 diagnostics 仍由后续 `structured-diagnostics-v1` 完成。
- PNG/Canvas/Blob export 仍不属于 production-readiness 第一阶段。
