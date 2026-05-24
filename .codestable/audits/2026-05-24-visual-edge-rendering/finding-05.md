---
doc_type: audit-finding
audit: 2026-05-24-visual-edge-rendering
finding_id: maintainability-05
nature: maintainability
severity: P2
confidence: medium
suggested_action: cs-refactor
status: open
---

# Finding 05: 边标签定位基于未渲染路径，容易与实际连线错位

## 速答

edge label 位置由 layout 的中心点 waypoints 或 renderer 的原始 waypoints 中点计算，但实际 SVG path 会经过 truncation、arrow shortening、curve/step 转换，标签不一定落在最终可见路径的合理位置。

## 关键证据

- `crates/xmermaid-layout/src/flowchart.rs:528` - layout 在构造 edge 时计算 `label_position`。
- `crates/xmermaid-layout/src/flowchart.rs:538` - 两点边 label 使用 `from` / `to` 中心点平均值。
- `src/renderer/svg.ts:231` - renderer 有 label 时直接绘制文本。
- `src/renderer/svg.ts:233` - 优先使用 layout 提供的 `edge.label_position`。
- `src/renderer/svg.ts:244` - label 背景基于该点测量后绘制。
- `src/renderer/svg.ts:264` - fallback 也只是取原始 waypoints 中段点。
- `src/renderer/svg.ts:170` - 实际 path 在 label 之前已经通过 `computeEdgePath` 重新生成，但 label 定位没有使用 `edgeResult.path`。

## 影响

在 bezier、step、back-edge、多 waypoint 和后续 edgeGap 修复场景下，label 可能偏离可见连线，或压到节点、箭头、折线转角。该问题不一定每张图都触发，所以置信度为 medium。

## 修复方向

标签定位应基于最终 route/path 的几何中心或显式 route metadata，而不是原始中心点平均值。

## 建议动作

`cs-refactor`，因为它涉及 edge route 数据模型和 renderer label 策略。
