---
doc_type: audit-finding
audit: 2026-05-24-visual-edge-rendering
finding_id: bug-01
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
status: resolved
resolved_by: 2026-05-25-edge-geometry-boundary-contract, 2026-05-25-svg-geometry-regression-suite
---

# Finding 01: 箭头尖端被 `edgeGap` 推离目标节点边界

## 速答

当前实现把目标端的 arrow tip 放在节点边界外侧 `edgeGap` 处，和设计文档中“箭头尖端接触目标边界”的规则相反，视觉上会出现箭头悬空或端点距离不自然。

## 关键证据

- `.codestable/features/2026-04-27-arch-redesign/arch-redesign-design.md:104` - 设计原则写明 edges 终止于目标节点边界，arrow tip touches the target border。
- `.codestable/features/2026-04-27-arch-redesign/arch-redesign-design.md:116` - 算法要求先计算目标 bounding box 交点，再把 arrow tip 放在 intersection point。
- `src/renderer/edge.ts:441` - source 端通过 `truncateAtBounds(..., gap, ...)` 推出边界，适合作为 edge start。
- `src/renderer/edge.ts:442` - target 端也用同一个 `gap` 计算 `end`，导致 arrow tip 不是边界交点而是边界外侧点。
- `src/renderer/edge.ts:493` - 返回值把 `arrowTip` 直接设为这个已经加过 gap 的 `end`。
- `tests/edge.test.ts:143` - 测试显式期待目标 top edge `y=200` 时 arrow tip 为 `200 - gap`，说明测试锁定了“悬空”行为。

## 影响

所有带箭头的 edge 都会受影响，尤其是短边、节点间距小的图、`edgeGap` 配置较大时更明显。用户看到的效果会像箭头没有真正指向节点。

## 修复方向

目标端应区分 border intersection、arrow tip、edge path end：arrow tip 在目标边界，path end 在 `arrowTip - (edgeGap + arrowSize)` 或等价位置。

## 建议动作

`cs-issue`，因为这是明确的用户可见渲染错误，并且已有设计文档给出期望行为。
