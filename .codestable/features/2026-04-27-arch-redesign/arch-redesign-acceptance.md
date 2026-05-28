---
doc_type: feature-acceptance
feature: 2026-04-27-arch-redesign
status: accepted
accepted_at: 2026-05-28
roadmap: null
roadmap_item: null
tags: [architecture, flowchart, layout, renderer]
---

# arch-redesign 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-05-28
> 关联方案 doc：`.codestable/features/2026-04-27-arch-redesign/arch-redesign-design.md`

## 1. 接口契约核对

**接口示例逐项核对**：

- [x] `new XMermaid({ container, theme, layoutConfig })`：`src/types/options.ts` 接收 `theme?: RenderTheme` 和 `layoutConfig?: Partial<LayoutConfig>`，`src/xmermaid.ts` 将 partial config 传给 WASM `render_with_config`。
- [x] `compute_layout(&ast, &config)`：`crates/xmermaid-layout/src/engine.rs` 直接把传入 config 交给 flowchart layout，不再用 AST 方向覆盖 config。
- [x] `render_with_config(input, configJson)`：`crates/xmermaid-wasm/src/lib.rs` 先从 AST 方向推导默认 config，再叠加 JSON patch；测试覆盖 direction omitted / explicit override。

**名词层"现状 → 变化"逐项核对**：

- [x] Parser AST：`Node` 含 `shape`，parser 支持 rect/rounded/circle/diamond/hexagon/parallelogram/trapezoid 等 shape。
- [x] Layout contract：`LayoutConfig`、`LayoutNode`、`LayoutEdge`、`LayoutResult`、`Bounds`、`Point` 已在 Rust 和 TS 侧同步。
- [x] Renderer contract：`RenderTheme`、built-in themes、edge path helpers、arrow styles 已落地并导出。
- [x] Geometry v1：`LayoutEdge` 含 `source_boundary`、`target_boundary`、`path_end`、`final_tangent_angle`、`label_anchor`、`geometry_version`，renderer 优先消费。

**流程图核对**：

- [x] `DSL -> parser AST -> WASM -> layout -> LayoutResult -> SVGRenderer -> SVG DOM` 均有代码落点，并由 Rust/JS/browser 验证覆盖。

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] Parser/layout/renderer 已通过 typed contracts 解耦，layout 输出 bounds/waypoints/geometry，renderer 不再负责图布局。
- [x] Edge/arrow 渲染由 geometry v1 和 TS fallback helper 共同保证，arrow tip、path end、label anchor 分离。
- [x] Flowchart refinement 覆盖方向、same-rank spacing、custom config、shape boundary 和复杂示例。

**明确不做逐项核对**：

- [x] 未新增 sequence/class/state/ER 等新图表类型。
- [x] 未新增 npm 或 Rust dependency。
- [x] 未把 SVG rendering 搬进 Rust。
- [x] 未修改 `src/editor/` live-editor 代码；`src/index.ts` 里已有 live-editor 导出是本轮开始前的未提交改动，未作为 arch-redesign 范围处理。
- [x] 未提交构建产物或 Playwright 临时资产。

**关键决策落地**：

- [x] `LayoutConfig` 是布局输入事实来源；显式 direction 可覆盖 DSL direction。
- [x] WASM partial config 语义保留 AST 默认方向，避免 `layoutConfig: { h_spacing: ... }` 把 LR 图误改成 TB。
- [x] Renderer 优先使用 layout geometry v1，缺字段才回退到 `computeEdgePath`。

**挂载点反向核对**：

- [x] 挂载点覆盖 parser AST/parser、layout types/engine/flowchart、WASM lib、TS types/options, renderer/edge/svg, XMermaid, examples/tests。
- [x] grep/review 未发现需要纳入 arch-redesign 的额外挂载点；live-editor 相关挂载点属于后续 feature，保持独立。

## 3. 验收场景核对

- [x] **S1 Rust tests**：`cargo test` 通过。新增/确认 coverage 包含 layout `test_custom_config`、`test_same_rank_uniform_spacing`、WASM partial config tests。
- [x] **S2 JS tests/typecheck**：`npm test` 通过 9 files / 92 tests；`npm run typecheck` 通过。
- [x] **S3 build/release**：`npm run build` 通过；`npm run verify:release` 通过（wasm-js-build、js-unit、ts-typecheck、rust-workspace、diff-whitespace 全 PASS）。
- [x] **S4 basic browser**：Playwright 加载 `examples/basic.html`，`svg.xmermaid-diagram = 1`，console errors = 0。
- [x] **S5 complex browser**：Playwright 加载 `examples/flowchart-complex.html`，`svg.xmermaid-diagram = 2`，error text = false，console errors = 0。
- [x] **S6 directions browser**：Playwright 加载 `examples/flowchart-directions.html`，`svg.xmermaid-diagram = 4`，h2 为 TB/LR/RL/BT，error text = false，console errors = 0。
- [x] **S7 theme comparison browser**：Playwright 加载 `examples/theme-comparison.html`，`svg.xmermaid-diagram = 3`，h2 为 Default/Dark/Minimal，error text = false，console errors = 0。

## 4. 术语一致性

- `LayoutConfig`、`LayoutResult`、`LayoutNode`、`LayoutEdge`、`RenderTheme`、`NodeShape` 与方案第 0/2.1 节一致。
- Parser AST 当前使用 `NodeShape::Rect/Rounded`，layout/TS contract 映射为 `Rectangle/RoundedRect`；这是跨层命名映射，不是同层术语冲突。
- `theme-comparison.html` 已按计划文件名补齐；旧 `flowchart-themes.html` 保留兼容。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md` 已新增“当前 Flowchart 解耦合同”小节，记录 parser/layout/renderer 数据流、partial config 语义、`LayoutResult`/geometry v1、`RenderTheme` 与 `XMermaidOptions`。
- [x] 该归并只追加 arch-redesign 架构事实，未改动既有 live-editor 未提交内容。

## 6. requirement 回写

- [x] `requirement: null`，本 feature 是架构解耦与 flowchart 渲染合同补强；当前 `.codestable/requirements/` 无对应能力文档。无 requirement 回写。

## 7. roadmap 回写

- [x] `roadmap: null` / `roadmap_item: null`，本 feature 非 roadmap 起头。无 roadmap 回写。

## 8. attention.md 候选盘点

- [x] 无新增 attention 候选。构建工具链细节已由已有 build-toolchain-gate feature 记录；本轮未发现每个 feature 都会重复踩的新环境约束。

## 9. 遗留

- 每任务 commit 未执行。原 batch plan 的逐步 commit 是 superpowers 计划遗留写法；CodeStable scoped-commit 需要用户明确确认后单独提交。
- `cargo fmt --check` 仍显示仓库既存 Rust 格式差异，范围包含 parser/token/tests 等非本次必须格式化文件；本轮未做全仓格式 churn。
