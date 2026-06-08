---
doc_type: audit-index
audit: 2026-05-24-visual-edge-rendering
scope: SVG visual rendering, edge routing, arrow drawing, layout edge contracts, and related tests
created: 2026-05-24
status: resolved
total_findings: 6
resolved_at: 2026-06-08
---

# visual-edge-rendering 审计报告

## 范围

用户反馈可视化绘制还不够美观，连线绘制细节问题较多。本次审计聚焦：

- `src/renderer/svg.ts`
- `src/renderer/edge.ts`
- `src/types/layout.ts`
- `src/types/theme.ts`
- `crates/xmermaid-layout/src/flowchart.rs`
- `crates/xmermaid-layout/src/types.rs`
- `tests/edge.test.ts`
- `tests/renderer.test.ts`
- `.codestable/features/2026-04-27-arch-redesign/arch-redesign-design.md`

## 总评

共发现 6 条问题。最值得先处理的是 3 条 P1 渲染 bug：箭头尖端被 `edgeGap` 推离节点边界、step path 实际没有按 `arrowSize` 截短、非三角箭头样式被统一画成 `<polygon>`。另外有 1 条 P1 架构偏离：layout 仍主要输出中心点连线，renderer 继续承担几何路由职责，这会限制后续连线美观度。剩余 2 条 P2 主要是标签定位和测试覆盖不足。

## 发现清单

| # | 性质 | 严重度 | 置信度 | 标题 | 文件 |
|---|---|---|---|---|---|
| 1 | bug | P1 | high | 箭头尖端被 `edgeGap` 推离目标节点边界 | [finding-01.md](finding-01.md) |
| 2 | bug | P1 | high | step 连线路径没有真正截短到箭头尾部 | [finding-02.md](finding-02.md) |
| 3 | bug | P1 | high | `open` / `circle` / `cross` 箭头样式都被错误渲染为 polygon | [finding-03.md](finding-03.md) |
| 4 | arch-drift | P1 | high | layout 仍输出粗粒度中心点，renderer 承担路由几何 | [finding-04.md](finding-04.md) |
| 5 | maintainability | P2 | medium | 边标签定位基于未渲染路径，容易与实际连线错位 | [finding-05.md](finding-05.md) |
| 6 | maintainability | P2 | high | 测试没有锁定真实 SVG 几何输出 | [finding-06.md](finding-06.md) |

## 按维度分布

| 性质 | P0 | P1 | P2 | 合计 |
|---|---|---|---|---|
| bug | 0 | 3 | 0 | 3 |
| security | 0 | 0 | 0 | 0 |
| performance | 0 | 0 | 0 | 0 |
| maintainability | 0 | 0 | 2 | 2 |
| arch-drift | 0 | 1 | 0 | 1 |
| **合计** | **0** | **4** | **2** | **6** |

## 关闭记录

本审计的 6 条 finding 已由 `visual-rendering-readiness` roadmap 的后续 feature 收敛：

- `edge-geometry-boundary-contract`：新增 layout edge geometry v1 字段，renderer 优先消费 explicit geometry，保留 fallback。
- `svg-geometry-regression-suite`：新增 DOM 级 SVG 几何回归，覆盖 complex path、label fallback、shape boundary 和 arrow styles。
- `release-verification-contract`：把 `npm run build` 纳入 `npm run verify:release`。
- `codestable-evidence-governance`：确认 `.codestable/**` 属于 repo-spec 并被提交管理。

当前剩余边界：仍不做完整 routing rewrite、obstacle avoidance、port routing、parallel edge bundling 或截图 pixel diff；这些已明确留给后续独立 roadmap，而不是本审计未完成项。
