---
doc_type: audit-finding
audit: 2026-05-24-visual-edge-rendering
finding_id: arch-drift-04
nature: arch-drift
severity: P1
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 04: layout 仍输出粗粒度中心点，renderer 承担路由几何

## 速答

架构设计要求 layout 计算 edge paths/waypoints，renderer 只按 waypoints + theme 绘制；当前 layout 多数情况下只输出 `from` / `to` 中心点，renderer 继续根据节点 bounds 和 shape 计算截断和曲线。

## 关键证据

- `.codestable/features/2026-04-27-arch-redesign/arch-redesign-design.md:95` - Key Changes 写明 layout layer computes edge paths。
- `.codestable/features/2026-04-27-arch-redesign/arch-redesign-design.md:99` - renderer 应只从 waypoints + theme 绘制，不知道 layout algorithm。
- `crates/xmermaid-layout/src/flowchart.rs:486` - layout 构造 waypoints 时以 `from_center` / `to_center` 为基础。
- `crates/xmermaid-layout/src/flowchart.rs:513` - 只有跨 rank edge 才插入一个几何 midpoint。
- `crates/xmermaid-layout/src/flowchart.rs:521` - 普通 edge 直接 `vec![from, to]`。
- `src/renderer/svg.ts:169` - renderer 调用 `computeEdgePath` 做 gap truncation。
- `src/renderer/svg.ts:172` - renderer 传入 source bounds。
- `src/renderer/svg.ts:177` - renderer 还需要 source/target shape 才能完成几何。
- `crates/xmermaid-layout/tests/layout_deep_test.rs:365` - 多条相同边测试只断言 node 数量，没有要求平行边分流或 offset。

## 影响

连线美观度上限被 layout contract 限制：普通边缺少避障、平行边分流、端口选择、正交 routing 等信息，renderer 只能根据中心点事后猜测。后续每种曲线风格都会继续在 renderer 中堆几何逻辑。

## 修复方向

重新明确 contract：layout 输出可绘制的 routed waypoints 或 edge route metadata；renderer 只做主题化 path/marker 绘制和必要的 SVG 元素生成。

## 建议动作

`cs-refactor`，因为这是职责边界和数据契约偏离，不是单点 bug。
