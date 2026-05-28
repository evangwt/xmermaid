---
doc_type: feature-acceptance
feature: 2026-05-25-edge-geometry-boundary-contract
status: accepted
accepted_at: 2026-05-25
roadmap: visual-rendering-readiness
roadmap_item: edge-geometry-boundary-contract
tags: [layout, renderer, edge-geometry, svg]
---

# edge-geometry-boundary-contract 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-05-25
> 关联方案 doc：.codestable/features/2026-05-25-edge-geometry-boundary-contract/edge-geometry-boundary-contract-design.md

## 1. 接口契约核对

**接口示例逐项核对**：
- [x] Rust `LayoutEdge` 包含 `source_boundary`、`target_boundary`、`path_end`、`final_tangent_angle`、`label_anchor`、`geometry_version`。
- [x] TS `LayoutEdge` 包含同名字段，接收侧保持 optional 以兼容旧 payload。
- [x] `cargo test -p xmermaid-layout test_layout_edge_geometry_contract_roundtrip --test roundtrip_test` 通过，JSON 中 geometry fields 存在并能 roundtrip。

**名词层“现状 → 变化”逐项核对**：
- [x] Rust layout 不再只输出 centerline `waypoints` 和 `label_position`，已输出 geometry v1 字段。
- [x] SVG renderer 不再只能在 renderer 端推断 arrow/path/label；完整 explicit geometry 存在时优先消费。
- [x] `waypoints` 和 `label_position` 保留，旧数据仍可 fallback。

**流程图核对**：
- [x] Rust flowchart layout → `LayoutEdge` geometry fields → serde/WASM layout result → TS `LayoutEdge` → renderer explicit/fallback 分支均有实际落点。

## 2. 行为与决策核对

**需求摘要逐项验证**：
- [x] Rust/TS 字段同步：`crates/xmermaid-layout/src/types.rs` 与 `src/types/layout.ts` 均有 geometry 字段。
- [x] layout JSON roundtrip：`test_layout_edge_geometry_contract_roundtrip` 覆盖字段存在性和反序列化一致性。
- [x] renderer explicit path：`tests/renderer.test.ts` 覆盖 `source_boundary` → `path_end` path、`target_boundary` arrow tip、`final_tangent_angle` arrow angle、`label_anchor` label position。
- [x] fallback：现有 renderer fallback label/path 测试仍通过。

**明确不做逐项核对**：
- [x] 未做完整 routing rewrite、obstacle avoidance、parallel edge bundling 或 port routing。
- [x] 未删除 `waypoints` / `label_position`。
- [x] 未修改 Mermaid parser AST 或语法。
- [x] 未修改主题 API 或箭头样式集合。
- [x] 未新增 npm/Rust dependency。

**关键决策落地**：
- [x] Rust `geometry_version` 固定输出 `1`。
- [x] TS `geometry_version?: 1` 兼容旧 payload。
- [x] renderer 只有在完整 v1 字段存在时走 explicit geometry，否则走 `computeEdgePath`。

**流程级约束核对**：
- [x] `target_boundary` 作为 arrow tip landing point 使用。
- [x] `path_end` 与 `target_boundary` 分离，path `d` 结束于 `path_end`。
- [x] `label_anchor` 优先于 `label_position`。
- [x] Rust/TS 字段同名。

**挂载点反向核对（可卸载性）**：
- [x] 挂载点 M1 `crates/xmermaid-layout/src/types.rs`：合同字段定义。
- [x] 挂载点 M2 `crates/xmermaid-layout/src/flowchart.rs`：geometry v1 产出。
- [x] 挂载点 M3 `crates/xmermaid-layout/tests/roundtrip_test.rs`：Rust roundtrip 守护。
- [x] 挂载点 M4 `src/types/layout.ts`：TS 合同字段。
- [x] 挂载点 M5 `src/renderer/svg.ts`：renderer explicit geometry 消费。
- [x] 挂载点 M6 `tests/renderer.test.ts`：renderer 行为守护。
- [x] 反向核查：`rg -n "source_boundary|target_boundary|path_end|final_tangent_angle|label_anchor|geometry_version" crates src tests` 命中均在上述合同/消费/测试面内。

## 3. 验收场景核对

- [x] **S1**：`cargo test -p xmermaid-layout test_layout_edge_geometry_contract_roundtrip --test roundtrip_test` → 1/1 通过。
- [x] **S2**：`npm test -- tests/renderer.test.ts` → 11/11 通过，包含 explicit geometry 用例。
- [x] **S3**：旧 layout fallback 测试仍通过；`uses final path geometry for fallback label position` 仍 green。
- [x] **S4**：`npm run typecheck` → exit 0。
- [x] **S5**：`npm run verify:release` → build、JS tests、typecheck、cargo test、diff whitespace 全部 PASS。

前端改动：无用户界面；SVG renderer DOM 行为由 jsdom 单测验证。

## 4. 术语一致性

- `source_boundary`、`target_boundary`、`path_end`、`final_tangent_angle`、`label_anchor`、`geometry_version` 在 Rust、TS、renderer tests 和 CodeStable 文档中命名一致。
- `label_position` 作为 legacy 字段保留，未和 `label_anchor` 混用；消费优先级已记录。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md`：新增 “Layout / Renderer Edge Geometry Contract” 小节，记录 layout 是 v1 edge geometry 字段来源，renderer 优先消费 explicit geometry 并保留 fallback。

## 6. requirement 回写

- [x] `requirement` 为空。本 feature 是内部 layout/renderer 合同治理，不新增终端用户可见 capability；无 requirement 回写。

## 7. roadmap 回写

- [x] `.codestable/roadmap/visual-rendering-readiness/visual-rendering-readiness-items.yaml` 中 `edge-geometry-boundary-contract` 已改为 `done`，feature 填 `2026-05-25-edge-geometry-boundary-contract`。
- [x] `.codestable/roadmap/visual-rendering-readiness/visual-rendering-readiness-roadmap.md` 子 feature 清单已同步为 `done` 并补充备注。

## 8. attention.md 候选盘点

- 候选 1：本环境运行 CodeStable validator 需使用 `python3`，`python` 命令不存在。已由上一 feature 记录为候选，本 feature 不重复新增。

## 9. 遗留

- 后续优化点：Rust layout 当前先用矩形 bounds 计算 geometry v1；非矩形 shape 的更精确边界仍需要后续视觉几何回归继续收紧。
- 已知限制：本 feature 不做完整 routing rewrite。
- 实现阶段顺手发现：无方案外代码问题。
