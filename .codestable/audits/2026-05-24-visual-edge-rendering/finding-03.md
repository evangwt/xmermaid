---
doc_type: audit-finding
audit: 2026-05-24-visual-edge-rendering
finding_id: bug-03
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
status: resolved
resolved_by: 2026-05-25-svg-geometry-regression-suite
---

# Finding 03: `open` / `circle` / `cross` 箭头样式都被错误渲染为 polygon

## 速答

主题类型暴露了多种 arrow style，但 renderer 总是创建 `<polygon>`。这会让 open arrow 被闭合出底边，circle arrow 不是圆，cross arrow 也不是两条交叉线。

## 关键证据

- `src/types/theme.ts:1` - `ArrowStyle` 包含 `triangle`、`filled`、`open`、`circle`、`cross`。
- `src/renderer/svg.ts:213` - `renderEdge` 无条件创建 `polygon` 作为 arrow element。
- `src/renderer/svg.ts:214` - 所有 arrow style 都写入 `points` 属性。
- `src/renderer/edge.ts:737` - `circle` 返回的是“center radius”的特殊字符串，不是 polygon 点列。
- `src/renderer/edge.ts:743` - `cross` 注释说是 two crossing lines。
- `src/renderer/edge.ts:763` - `cross` 实际仍返回三点字符串。
- `src/renderer/edge.ts:782` - `open` 返回三点 V shape，但 `<polygon>` 会闭合最后一段。
- `tests/edge.test.ts:355` - open arrow 测试只检查字符串分段数，没有验证 SVG 元素类型或闭合路径。
- `tests/edge.test.ts:365` - circle arrow 测试只检查返回字符串包含 radius。

## 影响

主题 API 看似支持五种箭头，实际只有 filled/triangle 接近正确。用户切换 minimal/open 风格或自定义 circle/cross 时会看到错误形状。

## 修复方向

按 arrow style 分派 SVG 元素：filled/triangle 用 `polygon`，open/cross 用 `path` 或 `polyline`，circle 用 `circle`，并补 DOM 级断言。

## 建议动作

`cs-issue`，因为这是明确的渲染输出错误，且 API 已经承诺这些样式可用。
